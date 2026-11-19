import "server-only";
import { z } from "zod";
import { ACTIVITY_RANGES, ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, type ActivityRange, type ActivityType } from "@/lib/domain";
import { addDays, todayIso } from "@/lib/dates";
import type { ActivityItem, ActivityPage } from "@/lib/types";
import { sql } from "../db";

export const activityQuerySchema = z.object({
  range: z.enum(ACTIVITY_RANGES).default("90d"),
  accountId: z.string().max(40).optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;

export function parseActivityQuery(params: URLSearchParams): ActivityQuery {
  const raw: Record<string, string> = {};
  for (const key of ["range", "accountId", "type", "q", "limit", "offset"]) {
    const value = params.get(key);
    if (value !== null && value !== "" && value !== "all-accounts" && value !== "all-types") raw[key] = value;
  }
  return activityQuerySchema.parse(raw);
}

export function rangeStart(range: ActivityRange, today = todayIso()): string | null {
  switch (range) {
    case "30d":
      return addDays(today, -30);
    case "90d":
      return addDays(today, -90);
    case "ytd":
      return `${today.slice(0, 4)}-01-01`;
    case "12m":
      return addDays(today, -365);
    case "all":
      return null;
  }
}

interface ActivityRow {
  id: string;
  account_id: string;
  nickname: string;
  trade_date: string;
  settle_date: string;
  activity_type: ActivityType;
  description: string;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  amount: number;
  tax_year: number | null;
}

function toItem(r: ActivityRow): ActivityItem {
  return {
    id: r.id,
    accountId: r.account_id,
    accountName: r.nickname,
    tradeDate: r.trade_date,
    settleDate: r.settle_date,
    type: r.activity_type,
    description: r.description,
    symbol: r.symbol,
    quantity: r.quantity,
    price: r.price,
    amount: r.amount,
    taxYear: r.tax_year,
  };
}

function whereClause(householdId: string, query: Omit<ActivityQuery, "limit" | "offset">) {
  const params: unknown[] = [householdId];
  const clauses = ["a.household_id = $1"];
  const start = rangeStart(query.range);
  if (start) {
    params.push(start);
    clauses.push(`t.trade_date >= $${params.length}`);
  }
  if (query.accountId) {
    params.push(query.accountId);
    clauses.push(`t.account_id = $${params.length}`);
  }
  if (query.type) {
    params.push(query.type);
    clauses.push(`t.activity_type = $${params.length}`);
  }
  if (query.q) {
    params.push(`%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    clauses.push(`(t.description ilike $${params.length} or coalesce(t.symbol, '') ilike $${params.length})`);
  }
  return { where: clauses.join(" and "), params };
}

const SELECT = `select t.id, t.account_id, a.nickname, t.trade_date, t.settle_date, t.activity_type, t.description,
                       t.symbol, t.quantity, t.price, t.amount, t.tax_year
                  from transactions t join accounts a on a.id = t.account_id`;

export async function listActivity(householdId: string, query: ActivityQuery): Promise<ActivityPage> {
  const { where, params } = whereClause(householdId, query);
  const rows = await sql<ActivityRow>(
    `${SELECT} where ${where} order by t.trade_date desc, t.id desc limit ${query.limit} offset ${query.offset}`,
    params,
  );
  const [totals] = await sql<{ total: number; inflows: number; outflows: number }>(
    `select count(*)::int as total,
            coalesce(sum(t.amount) filter (where t.activity_type in ('contribution', 'transfer_in', 'rollover')), 0)::float8 as inflows,
            coalesce(-sum(t.amount) filter (where t.activity_type in ('withdrawal', 'transfer_out')), 0)::float8 as outflows
       from transactions t join accounts a on a.id = t.account_id where ${where}`,
    params,
  );
  return { items: rows.map(toItem), total: totals.total, inflows: totals.inflows, outflows: totals.outflows };
}

export async function recentActivity(householdId: string, limit = 6): Promise<ActivityItem[]> {
  const rows = await sql<ActivityRow>(
    `${SELECT} where a.household_id = $1 and t.activity_type not in ('buy', 'sell')
      order by t.trade_date desc, t.id desc limit $2`,
    [householdId, limit],
  );
  return rows.map(toItem);
}

export async function getTransaction(householdId: string, id: string): Promise<ActivityItem | null> {
  const [row] = await sql<ActivityRow>(`${SELECT} where a.household_id = $1 and t.id = $2`, [householdId, id]);
  return row ? toItem(row) : null;
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportActivityCsv(householdId: string, query: Omit<ActivityQuery, "limit" | "offset">): Promise<string> {
  const { where, params } = whereClause(householdId, query);
  const rows = await sql<ActivityRow>(`${SELECT} where ${where} order by t.trade_date desc, t.id desc limit 10000`, params);
  const header = ["Trade date", "Settle date", "Account", "Activity", "Description", "Symbol", "Quantity", "Price", "Amount", "Tax year"];
  const lines = rows.map((r) =>
    [
      r.trade_date,
      r.settle_date,
      r.nickname,
      ACTIVITY_TYPE_LABELS[r.activity_type],
      r.description,
      r.symbol,
      r.quantity,
      r.price,
      r.amount.toFixed(2),
      r.tax_year,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
