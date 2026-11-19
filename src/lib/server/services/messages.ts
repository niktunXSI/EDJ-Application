import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Message, Thread, ThreadSummary } from "@/lib/types";
import { MAX_MESSAGES_PER_THREAD, MAX_THREADS } from "../config";
import { sql, withTransaction } from "../db";
import { conflict, notFound } from "../http";
import { iso } from "./household";

const body = z.string().trim().min(1, "Write a message.").max(4000, "Keep messages under 4,000 characters.");

export const newThreadSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject.").max(120, "Keep the subject under 120 characters."),
  body,
});

export const replySchema = z.object({ body });

interface SummaryRow {
  id: string;
  subject: string;
  last_message_at: Date | string;
  preview: string | null;
  last_author: string | null;
  unread_count: number;
  message_count: number;
}

function toSummary(r: SummaryRow): ThreadSummary {
  return {
    id: r.id,
    subject: r.subject,
    lastMessageAt: iso(r.last_message_at),
    preview: (r.preview ?? "").replace(/\s+/g, " ").slice(0, 160),
    lastAuthor: r.last_author ?? "",
    unreadCount: r.unread_count,
    messageCount: r.message_count,
  };
}

const SUMMARY_SELECT = `
  select t.id, t.subject, t.last_message_at,
         (select m.body from messages m where m.thread_id = t.id order by m.sent_at desc limit 1) as preview,
         (select m.author_name from messages m where m.thread_id = t.id order by m.sent_at desc limit 1) as last_author,
         (select count(*)::int from messages m where m.thread_id = t.id and m.sender = 'branch' and m.read_at is null) as unread_count,
         (select count(*)::int from messages m where m.thread_id = t.id) as message_count
    from message_threads t`;

export async function listThreads(householdId: string): Promise<ThreadSummary[]> {
  const rows = await sql<SummaryRow>(`${SUMMARY_SELECT} where t.household_id = $1 order by t.last_message_at desc limit 200`, [householdId]);
  return rows.map(toSummary);
}

export async function countUnreadMessages(householdId: string) {
  const [{ count }] = await sql<{ count: number }>(
    `select count(*)::int as count from messages m join message_threads t on t.id = m.thread_id
      where t.household_id = $1 and m.sender = 'branch' and m.read_at is null`,
    [householdId],
  );
  return count;
}

async function loadThread(householdId: string, id: string): Promise<Thread> {
  const [summary] = await sql<SummaryRow>(`${SUMMARY_SELECT} where t.household_id = $1 and t.id = $2`, [householdId, id]);
  if (!summary) throw notFound("Conversation");
  const rows = await sql<{ id: string; sender: "client" | "branch"; author_name: string; body: string; sent_at: Date | string; read_at: Date | string | null }>(
    "select id, sender, author_name, body, sent_at, read_at from messages where thread_id = $1 order by sent_at, id",
    [id],
  );
  const messages: Message[] = rows.map((m) => ({
    id: m.id,
    sender: m.sender,
    authorName: m.author_name,
    body: m.body,
    sentAt: iso(m.sent_at),
    read: m.sender === "client" || m.read_at !== null,
  }));
  return { ...toSummary(summary), messages };
}

/** Opens a conversation and marks the branch's messages in it as read. */
export async function getThread(householdId: string, id: string): Promise<Thread> {
  const thread = await loadThread(householdId, id);
  if (thread.unreadCount > 0) {
    await sql("update messages set read_at = now() where thread_id = $1 and sender = 'branch' and read_at is null", [id]);
  }
  return thread;
}

const newId = (prefix: string) => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

export async function createThread(householdId: string, authorName: string, raw: unknown): Promise<Thread> {
  const input = newThreadSchema.parse(raw);
  const id = newId("MT");
  await withTransaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [`threads:${householdId}`]);
    const [{ count }] = await tx.query<{ count: number }>("select count(*)::int as count from message_threads where household_id = $1", [householdId]);
    if (count >= MAX_THREADS) throw conflict("too_many_threads", "You have reached the conversation limit. Please call your branch.");
    await tx.query("insert into message_threads (id, household_id, subject) values ($1, $2, $3)", [id, householdId, input.subject]);
    await tx.query("insert into messages (id, thread_id, sender, author_name, body) values ($1, $2, 'client', $3, $4)", [
      newId("MSG"),
      id,
      authorName,
      input.body,
    ]);
  });
  return loadThread(householdId, id);
}

export async function replyToThread(householdId: string, threadId: string, authorName: string, raw: unknown): Promise<Thread> {
  const input = replySchema.parse(raw);
  await withTransaction(async (tx) => {
    const [thread] = await tx.query<{ id: string }>(
      "select id from message_threads where household_id = $1 and id = $2 for update",
      [householdId, threadId],
    );
    if (!thread) throw notFound("Conversation");
    const [{ count }] = await tx.query<{ count: number }>("select count(*)::int as count from messages where thread_id = $1", [threadId]);
    if (count >= MAX_MESSAGES_PER_THREAD) throw conflict("thread_full", "This conversation is full. Start a new message instead.");
    await tx.query("insert into messages (id, thread_id, sender, author_name, body) values ($1, $2, 'client', $3, $4)", [
      newId("MSG"),
      threadId,
      authorName,
      input.body,
    ]);
    await tx.query("update message_threads set last_message_at = now() where id = $1", [threadId]);
  });
  return loadThread(householdId, threadId);
}
