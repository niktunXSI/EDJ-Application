import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { FREQUENCIES, MOVEMENT_KINDS, type AccountType, type Frequency, type MovementKind, type MovementStatus } from "@/lib/domain";
import { addDays, isIsoDate, todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import type { BankAccount, Movement } from "@/lib/types";
import { MAX_ONLINE_MOVEMENT, MAX_OPEN_MOVEMENTS } from "../config";
import { sql, withTransaction } from "../db";
import { conflict, notFound, unprocessable } from "../http";
import { maskAccountNumber, iso } from "./household";

/** Account types whose money can only leave through a branch-assisted distribution request. */
const BRANCH_ONLY_WITHDRAWAL_TYPES: readonly AccountType[] = ["traditional_ira", "roth_ira", "education_529"];

export const movementInputSchema = z.object({
  kind: z.enum(MOVEMENT_KINDS),
  fromAccountId: z.string().max(40).nullish(),
  toAccountId: z.string().max(40).nullish(),
  bankAccountId: z.string().max(40).nullish(),
  amount: z
    .number({ error: "Enter an amount." })
    .positive("Enter an amount greater than $0.")
    .max(MAX_ONLINE_MOVEMENT, `Online transfers are limited to ${formatCurrency(MAX_ONLINE_MOVEMENT, { whole: true })}. Contact your branch for larger amounts.`)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use dollars and cents only."),
  frequency: z.enum(FREQUENCIES).default("once"),
  scheduledFor: z.string().refine(isIsoDate, "Choose a valid date."),
  memo: z.string().trim().max(140, "Keep the memo under 140 characters.").nullish(),
});

export type MovementInput = z.infer<typeof movementInputSchema>;

interface MovementRow {
  id: string;
  kind: MovementKind;
  from_account_id: string | null;
  to_account_id: string | null;
  bank_account_id: string | null;
  amount: number;
  frequency: Frequency;
  scheduled_for: string;
  status: MovementStatus;
  memo: string | null;
  requested_by: string;
  created_at: Date | string;
  cancelled_at: Date | string | null;
}

interface AccountRef {
  id: string;
  nickname: string;
  account_type: AccountType;
  account_number: string;
  cash_balance: number;
}

export async function listBankAccounts(householdId: string): Promise<BankAccount[]> {
  const rows = await sql<{ id: string; bank_name: string; account_kind: string; last_four: string }>(
    "select id, bank_name, account_kind, last_four from linked_bank_accounts where household_id = $1 order by verified_on",
    [householdId],
  );
  return rows.map((r) => ({
    id: r.id,
    bankName: r.bank_name,
    accountKind: r.account_kind,
    lastFour: r.last_four,
    label: `${r.bank_name} ${r.account_kind} ••${r.last_four}`,
  }));
}

async function accountRefs(householdId: string) {
  const rows = await sql<AccountRef>(
    "select id, nickname, account_type, account_number, cash_balance from accounts where household_id = $1",
    [householdId],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

function toMovement(r: MovementRow, accounts: Map<string, AccountRef>, banks: Map<string, BankAccount>): Movement {
  const accountLabel = (id: string | null) => {
    const a = id ? accounts.get(id) : undefined;
    return a ? `${a.nickname} ${maskAccountNumber(a.account_number)}` : "—";
  };
  const bankLabel = (id: string | null) => (id ? (banks.get(id)?.label ?? "Linked bank") : "—");
  return {
    id: r.id,
    kind: r.kind,
    fromAccountId: r.from_account_id,
    toAccountId: r.to_account_id,
    bankAccountId: r.bank_account_id,
    fromLabel: r.kind === "deposit" ? bankLabel(r.bank_account_id) : accountLabel(r.from_account_id),
    toLabel: r.kind === "withdrawal" ? bankLabel(r.bank_account_id) : accountLabel(r.to_account_id),
    amount: r.amount,
    frequency: r.frequency,
    scheduledFor: r.scheduled_for,
    status: r.status,
    memo: r.memo,
    requestedBy: r.requested_by,
    createdAt: iso(r.created_at),
    cancelledAt: r.cancelled_at ? iso(r.cancelled_at) : null,
  };
}

export async function listMovements(householdId: string): Promise<{ upcoming: Movement[]; history: Movement[] }> {
  const [rows, accounts, bankList] = await Promise.all([
    sql<MovementRow>("select * from money_movements where household_id = $1 order by scheduled_for desc, created_at desc limit 200", [householdId]),
    accountRefs(householdId),
    listBankAccounts(householdId),
  ]);
  const banks = new Map(bankList.map((b) => [b.id, b]));
  const movements = rows.map((r) => toMovement(r, accounts, banks));
  return {
    upcoming: movements
      .filter((m) => m.status === "scheduled" || m.status === "processing")
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    history: movements.filter((m) => m.status === "completed" || m.status === "cancelled"),
  };
}

function fieldError(path: string, message: string) {
  return unprocessable("validation_failed", message, { fields: [{ path, message }] });
}

export async function createMovement(householdId: string, requestedBy: string, raw: unknown): Promise<Movement> {
  const input = movementInputSchema.parse(raw);
  const today = todayIso();
  if (input.scheduledFor < today) throw fieldError("scheduledFor", "Choose today or a future date.");
  if (input.scheduledFor > addDays(today, 365)) throw fieldError("scheduledFor", "Transfers can be scheduled up to one year ahead.");

  const accounts = await accountRefs(householdId);
  const banks = new Map((await listBankAccounts(householdId)).map((b) => [b.id, b]));
  const account = (id: string | null | undefined, path: string) => {
    if (!id) throw fieldError(path, "Choose an account.");
    const found = accounts.get(id);
    if (!found) throw fieldError(path, "Choose one of your accounts.");
    return found;
  };
  const bank = (id: string | null | undefined) => {
    if (!id || !banks.has(id)) throw fieldError("bankAccountId", "Choose a linked bank account.");
    return id;
  };

  let fromAccountId: string | null = null;
  let toAccountId: string | null = null;
  let bankAccountId: string | null = null;
  if (input.kind === "internal") {
    const from = account(input.fromAccountId, "fromAccountId");
    const to = account(input.toAccountId, "toAccountId");
    if (from.id === to.id) throw fieldError("toAccountId", "Choose a different account to transfer to.");
    fromAccountId = from.id;
    toAccountId = to.id;
  } else if (input.kind === "deposit") {
    bankAccountId = bank(input.bankAccountId);
    toAccountId = account(input.toAccountId, "toAccountId").id;
  } else {
    fromAccountId = account(input.fromAccountId, "fromAccountId").id;
    bankAccountId = bank(input.bankAccountId);
  }

  if (fromAccountId) {
    const from = accounts.get(fromAccountId)!;
    if (BRANCH_ONLY_WITHDRAWAL_TYPES.includes(from.account_type)) {
      throw fieldError(
        "fromAccountId",
        "Withdrawals from retirement and education accounts have tax consequences, so your branch team processes them. Send your advisor a message to start one.",
      );
    }
    if (input.frequency === "once" && input.amount > from.cash_balance) {
      throw fieldError("amount", `The amount is more than the ${formatCurrency(from.cash_balance)} cash available in ${from.nickname}.`);
    }
  }

  const id = `MM-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const status: MovementStatus = input.scheduledFor === today ? "processing" : "scheduled";
  const row = await withTransaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [`movements:${householdId}`]);
    const [{ open }] = await tx.query<{ open: number }>(
      "select count(*)::int as open from money_movements where household_id = $1 and status in ('scheduled', 'processing')",
      [householdId],
    );
    if (open >= MAX_OPEN_MOVEMENTS) {
      throw conflict("too_many_open_transfers", `You already have ${MAX_OPEN_MOVEMENTS} open transfers. Cancel one before adding another.`);
    }
    const [inserted] = await tx.query<MovementRow>(
      `insert into money_movements (id, household_id, kind, from_account_id, to_account_id, bank_account_id, amount, frequency,
                                    scheduled_for, status, memo, requested_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning *`,
      [id, householdId, input.kind, fromAccountId, toAccountId, bankAccountId, input.amount, input.frequency, input.scheduledFor, status, input.memo || null, requestedBy],
    );
    return inserted;
  });
  return toMovement(row, accounts, banks);
}

export async function cancelMovement(householdId: string, id: string): Promise<Movement> {
  const [existing] = await sql<MovementRow>("select * from money_movements where household_id = $1 and id = $2", [householdId, id]);
  if (!existing) throw notFound("Transfer");
  if (existing.status !== "scheduled") {
    throw conflict("not_cancellable", existing.status === "processing" ? "This transfer is already processing and can no longer be cancelled." : "Only scheduled transfers can be cancelled.");
  }
  const [row] = await sql<MovementRow>(
    "update money_movements set status = 'cancelled', cancelled_at = now() where household_id = $1 and id = $2 and status = 'scheduled' returning *",
    [householdId, id],
  );
  if (!row) throw conflict("not_cancellable", "Only scheduled transfers can be cancelled.");
  const banks = new Map((await listBankAccounts(householdId)).map((b) => [b.id, b]));
  return toMovement(row, await accountRefs(householdId), banks);
}
