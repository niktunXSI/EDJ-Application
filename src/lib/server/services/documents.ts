import "server-only";
import { z } from "zod";
import { DOCUMENT_CATEGORIES, type AccountType, type DocumentCategory } from "@/lib/domain";
import { addDays } from "@/lib/dates";
import type { DocumentContent, DocumentDetail, DocumentItem, StatementLine } from "@/lib/types";
import { sql } from "../db";
import { notFound } from "../http";
import { getTransaction } from "./activity";
import { getHousehold } from "./household";

export const documentQuerySchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  accountId: z.string().max(40).optional(),
});

export type DocumentQuery = z.infer<typeof documentQuerySchema>;

export function parseDocumentQuery(params: URLSearchParams): DocumentQuery {
  const raw: Record<string, string> = {};
  for (const key of ["category", "year", "accountId"]) {
    const value = params.get(key);
    if (value && value !== "all") raw[key] = value;
  }
  return documentQuerySchema.parse(raw);
}

interface DocumentRow {
  id: string;
  category: DocumentCategory;
  title: string;
  account_id: string | null;
  nickname: string | null;
  account_type: AccountType | null;
  period_start: string | null;
  period_end: string | null;
  tax_year: number | null;
  issued_on: string;
  page_count: number;
  transaction_id: string | null;
  viewed_at: Date | string | null;
}

function toItem(r: DocumentRow): DocumentItem {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    accountId: r.account_id,
    accountName: r.nickname,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    taxYear: r.tax_year,
    issuedOn: r.issued_on,
    pageCount: r.page_count,
    viewed: r.viewed_at !== null,
  };
}

const SELECT = `select d.*, a.nickname, a.account_type from documents d left join accounts a on a.id = d.account_id`;

export async function listDocuments(householdId: string, query: DocumentQuery = {}) {
  const params: unknown[] = [householdId];
  const clauses = ["d.household_id = $1"];
  if (query.category) {
    params.push(query.category);
    clauses.push(`d.category = $${params.length}`);
  }
  if (query.year) {
    params.push(query.year);
    clauses.push(`extract(year from d.issued_on) = $${params.length}`);
  }
  if (query.accountId) {
    params.push(query.accountId);
    clauses.push(`d.account_id = $${params.length}`);
  }
  const rows = await sql<DocumentRow>(`${SELECT} where ${clauses.join(" and ")} order by d.issued_on desc, d.id desc limit 500`, params);
  const years = await sql<{ year: number }>(
    "select distinct extract(year from issued_on)::int as year from documents where household_id = $1 order by year desc",
    [householdId],
  );
  return { items: rows.map(toItem), years: years.map((y) => y.year) };
}

export async function countUnviewedDocuments(householdId: string) {
  const [{ count }] = await sql<{ count: number }>(
    "select count(*)::int as count from documents where household_id = $1 and viewed_at is null",
    [householdId],
  );
  return count;
}

async function valuesAt(householdId: string, date: string) {
  const rows = await sql<{ account_id: string; market_value: number }>(
    `select distinct on (v.account_id) v.account_id, v.market_value
       from account_values v join accounts a on a.id = v.account_id
      where a.household_id = $1 and v.as_of <= $2
      order by v.account_id, v.as_of desc`,
    [householdId, date],
  );
  return new Map(rows.map((r) => [r.account_id, r.market_value]));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function statementContent(householdId: string, kind: "statement" | "report", start: string, end: string): Promise<DocumentContent> {
  const [accounts, begin, finish, flows] = await Promise.all([
    sql<{ id: string; nickname: string }>("select id, nickname from accounts where household_id = $1 order by sort_order", [householdId]),
    valuesAt(householdId, addDays(start, -1)),
    valuesAt(householdId, end),
    sql<{ account_id: string; contributions: number; income: number; fees: number }>(
      `select t.account_id,
              coalesce(sum(t.amount) filter (where t.activity_type in ('contribution', 'transfer_in', 'rollover', 'withdrawal', 'transfer_out')), 0)::float8 as contributions,
              coalesce(sum(t.amount) filter (where t.activity_type in ('dividend', 'interest')), 0)::float8 as income,
              coalesce(sum(t.amount) filter (where t.activity_type = 'fee'), 0)::float8 as fees
         from transactions t join accounts a on a.id = t.account_id
        where a.household_id = $1 and t.trade_date between $2 and $3
        group by t.account_id`,
      [householdId, start, end],
    ),
  ]);
  const flowMap = new Map(flows.map((f) => [f.account_id, f]));
  const lines: StatementLine[] = accounts.map((a) => {
    const beginningValue = begin.get(a.id) ?? 0;
    const endingValue = finish.get(a.id) ?? 0;
    const f = flowMap.get(a.id);
    const netContributions = round2(f?.contributions ?? 0);
    const income = round2(f?.income ?? 0);
    const fees = round2(f?.fees ?? 0);
    return {
      accountId: a.id,
      accountName: a.nickname,
      beginningValue,
      endingValue,
      netContributions,
      income,
      fees,
      investmentChange: round2(endingValue - beginningValue - netContributions - fees),
    };
  });
  const sum = (key: keyof Omit<StatementLine, "accountId" | "accountName">) => round2(lines.reduce((s, l) => s + l[key], 0));
  return {
    kind,
    lines,
    totals: {
      beginningValue: sum("beginningValue"),
      endingValue: sum("endingValue"),
      netContributions: sum("netContributions"),
      income: sum("income"),
      fees: sum("fees"),
      investmentChange: sum("investmentChange"),
    },
  };
}

async function taxContent(row: DocumentRow): Promise<DocumentContent> {
  const year = row.tax_year!;
  const accountId = row.account_id!;
  if (row.account_type === "traditional_ira" || row.account_type === "roth_ira") {
    const [totals] = await sql<{ contributions: number; rollovers: number }>(
      `select coalesce(sum(amount) filter (where activity_type = 'contribution' and tax_year = $2), 0)::float8 as contributions,
              coalesce(sum(amount) filter (where activity_type = 'rollover' and extract(year from trade_date) = $2), 0)::float8 as rollovers
         from transactions where account_id = $1`,
      [accountId, year],
    );
    const [fmv] = await sql<{ market_value: number }>(
      "select market_value from account_values where account_id = $1 and as_of <= $2 order by as_of desc limit 1",
      [accountId, `${year}-12-31`],
    );
    const isRoth = row.account_type === "roth_ira";
    return {
      kind: "form5498",
      accountType: row.account_type,
      contributions: isRoth ? 0 : totals.contributions,
      rothContributions: isRoth ? totals.contributions : 0,
      rolloverContributions: totals.rollovers,
      fairMarketValue: fmv?.market_value ?? 0,
    };
  }
  const [totals] = await sql<{ dividends: number; interest: number; proceeds: number }>(
    `select coalesce(sum(amount) filter (where activity_type = 'dividend'), 0)::float8 as dividends,
            coalesce(sum(amount) filter (where activity_type = 'interest'), 0)::float8 as interest,
            coalesce(sum(amount) filter (where activity_type = 'sell'), 0)::float8 as proceeds
       from transactions where account_id = $1 and extract(year from trade_date) = $2`,
    [accountId, year],
  );
  return { kind: "form1099", ordinaryDividends: totals.dividends, interestIncome: totals.interest, grossProceeds: totals.proceeds };
}

const LETTERS: Record<string, string[]> = {
  "Annual privacy notice": [
    "We are committed to protecting the privacy of your personal and financial information. This notice explains what information we collect, how we use it, and the choices you have.",
    "We collect information you provide on applications and forms, information about your transactions with us, and information needed to verify your identity.",
    "We do not sell your personal information. We share it only as permitted by law, such as with service providers that help us maintain your accounts and who are bound to keep it confidential.",
    "You can limit certain sharing at any time by contacting your branch team.",
  ],
  "Updated advisory fee schedule": [
    "Effective at the start of next quarter, the program fee schedule for advisory accounts is updated as shown on the enclosed pages.",
    "For your Joint Investment Account, the annual program fee remains 1.25% on the first $250,000 of assets.",
    "No action is needed. Please contact Grace Lindqvist with any questions.",
  ],
  "Beneficiary review reminder": [
    "Life changes such as marriage, the birth of a child, or a move can affect who you want to inherit your accounts.",
    "Our records show the primary beneficiaries on your retirement accounts were last reviewed more than a year ago. We recommend confirming them at your next review.",
  ],
};

export async function getDocument(householdId: string, id: string): Promise<DocumentDetail> {
  const [row] = await sql<DocumentRow>(`${SELECT} where d.household_id = $1 and d.id = $2`, [householdId, id]);
  if (!row) throw notFound("Document");

  let content: DocumentContent;
  if ((row.category === "statement" || row.category === "report") && row.period_start && row.period_end) {
    content = await statementContent(householdId, row.category, row.period_start, row.period_end);
  } else if (row.category === "tax" && row.tax_year && row.account_id) {
    content = await taxContent(row);
  } else if (row.category === "confirmation") {
    content = { kind: "confirmation", trade: row.transaction_id ? await getTransaction(householdId, row.transaction_id) : null };
  } else {
    content = { kind: "letter", paragraphs: LETTERS[row.title] ?? ["This document is available from your branch on request."] };
  }

  if (row.viewed_at === null) {
    await sql("update documents set viewed_at = now() where household_id = $1 and id = $2", [householdId, id]);
  }
  const household = await getHousehold(householdId);
  const primary = household.clients[0];
  return {
    ...toItem(row),
    viewed: true,
    household: {
      name: household.name,
      clients: household.clients.map((c) => c.fullName),
      addressLine: primary?.addressLine ?? "",
      cityLine: primary ? `${primary.city}, ${primary.state} ${primary.postalCode}` : "",
    },
    content,
  };
}
