import "server-only";
import { ASSET_CLASSES, type AccountType, type AssetClass, type HistoryRange } from "@/lib/domain";
import { addDays, todayIso } from "@/lib/dates";
import type { AccountDetail, AccountSummary, AllocationSlice, Holding, ValueHistory } from "@/lib/types";
import { sql } from "../db";
import { notFound } from "../http";
import { maskAccountNumber } from "./household";

interface AccountRow {
  id: string;
  nickname: string;
  account_type: AccountType;
  account_number: string;
  registration: string;
  objective: string;
  is_advisory: boolean;
  beneficiary_name: string | null;
  owner_client_id: string | null;
  owner_name: string | null;
  opened_on: string;
  cash_balance: number;
}

interface HoldingRow {
  account_id: string;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  security_type: string;
  quantity: number;
  price: number;
  previous_close: number;
  cost_basis: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function loadAccounts(householdId: string, accountId?: string) {
  const params: unknown[] = [householdId];
  let filter = "";
  if (accountId) {
    params.push(accountId);
    filter = "and a.id = $2";
  }
  const accounts = await sql<AccountRow>(
    `select a.id, a.nickname, a.account_type, a.account_number, a.registration, a.objective, a.is_advisory,
            a.beneficiary_name, a.owner_client_id, a.opened_on, a.cash_balance,
            case when c.id is null then null else c.first_name || ' ' || c.last_name end as owner_name
       from accounts a left join clients c on c.id = a.owner_client_id
      where a.household_id = $1 ${filter}
      order by a.sort_order, a.id`,
    params,
  );
  const holdings = await sql<HoldingRow>(
    `select h.account_id, h.symbol, s.name, s.asset_class, s.security_type, h.quantity, s.price, s.previous_close, h.cost_basis
       from holdings h
       join accounts a on a.id = h.account_id
       join securities s on s.symbol = h.symbol
      where a.household_id = $1 ${filter.replace("a.id", "h.account_id")}
      order by h.quantity * s.price desc`,
    params,
  );
  return accounts.map((account) => buildAccount(account, holdings.filter((h) => h.account_id === account.id)));
}

function buildAccount(row: AccountRow, holdingRows: HoldingRow[]): AccountDetail {
  const invested = holdingRows.reduce((sum, h) => sum + h.quantity * h.price, 0);
  const marketValue = round2(invested + row.cash_balance);
  const holdings: Holding[] = holdingRows.map((h) => {
    const value = h.quantity * h.price;
    return {
      symbol: h.symbol,
      name: h.name,
      assetClass: h.asset_class,
      securityType: h.security_type,
      quantity: h.quantity,
      price: h.price,
      previousClose: h.previous_close,
      marketValue: round2(value),
      costBasis: h.cost_basis,
      gain: round2(value - h.cost_basis),
      gainPercent: h.cost_basis > 0 ? (value - h.cost_basis) / h.cost_basis : 0,
      dayChange: round2(h.quantity * (h.price - h.previous_close)),
      weight: marketValue > 0 ? value / marketValue : 0,
    };
  });
  const costBasis = round2(holdings.reduce((sum, h) => sum + h.costBasis, 0));
  const dayChange = round2(holdings.reduce((sum, h) => sum + h.dayChange, 0));
  return {
    id: row.id,
    nickname: row.nickname,
    type: row.account_type,
    accountNumber: row.account_number,
    maskedNumber: maskAccountNumber(row.account_number),
    registration: row.registration,
    objective: row.objective,
    isAdvisory: row.is_advisory,
    beneficiaryName: row.beneficiary_name,
    ownerClientId: row.owner_client_id,
    ownerName: row.owner_name,
    openedOn: row.opened_on,
    marketValue,
    cashBalance: row.cash_balance,
    costBasis,
    unrealizedGain: round2(invested - costBasis),
    dayChange,
    dayChangePercent: marketValue - dayChange > 0 ? dayChange / (marketValue - dayChange) : 0,
    holdings,
    allocation: allocationOf([{ holdings, cashBalance: row.cash_balance }]),
  };
}

export function allocationOf(accounts: Array<{ holdings: Holding[]; cashBalance: number }>): AllocationSlice[] {
  const totals = new Map<AssetClass, number>(ASSET_CLASSES.map((c) => [c, 0]));
  for (const account of accounts) {
    totals.set("cash", totals.get("cash")! + account.cashBalance);
    for (const h of account.holdings) totals.set(h.assetClass, totals.get(h.assetClass)! + h.marketValue);
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  return ASSET_CLASSES.map((assetClass) => ({
    assetClass,
    value: round2(totals.get(assetClass)!),
    weight: grand > 0 ? totals.get(assetClass)! / grand : 0,
  })).filter((slice) => slice.value > 0);
}

function toSummary({ holdings: _holdings, allocation: _allocation, ...summary }: AccountDetail): AccountSummary {
  return summary;
}

export async function listAccountDetails(householdId: string): Promise<AccountDetail[]> {
  return loadAccounts(householdId);
}

export async function listAccounts(householdId: string): Promise<AccountSummary[]> {
  return (await loadAccounts(householdId)).map(toSummary);
}

export async function getAccount(householdId: string, accountId: string): Promise<AccountDetail> {
  const [account] = await loadAccounts(householdId, accountId);
  if (!account) throw notFound("Account");
  return account;
}

export function historyStart(range: HistoryRange, today = todayIso()): string {
  switch (range) {
    case "1m":
      return addDays(today, -30);
    case "3m":
      return addDays(today, -91);
    case "ytd":
      return `${today.slice(0, 4)}-01-01`;
    case "1y":
      return addDays(today, -365);
    case "3y":
      return addDays(today, -3 * 365);
  }
}

/**
 * Daily market value for the household (or one account). The YTD and longer ranges start from the
 * last close before the range so the change matches what a statement would show.
 */
export async function getValueHistory(householdId: string, range: HistoryRange, accountId?: string): Promise<ValueHistory> {
  const start = historyStart(range);
  const params: unknown[] = [householdId, start];
  let filter = "";
  if (accountId) {
    params.push(accountId);
    filter = "and a.id = $3";
    const [exists] = await sql("select 1 from accounts where household_id = $1 and id = $2", [householdId, accountId]);
    if (!exists) throw notFound("Account");
  }
  const points = await sql<{ date: string; value: number }>(
    `select v.as_of as date, sum(v.market_value)::float8 as value
       from account_values v join accounts a on a.id = v.account_id
      where a.household_id = $1 ${filter}
        and v.as_of >= coalesce(
          (select max(v2.as_of) from account_values v2 join accounts a2 on a2.id = v2.account_id
            where a2.household_id = $1 and v2.as_of < $2), $2)
      group by v.as_of
      order by v.as_of`,
    params,
  );
  const startValue = points[0]?.value ?? 0;
  const endValue = points.at(-1)?.value ?? 0;
  return {
    points: points.map((p) => ({ date: p.date, value: round2(p.value) })),
    startValue: round2(startValue),
    endValue: round2(endValue),
    change: round2(endValue - startValue),
    changePercent: startValue > 0 ? (endValue - startValue) / startValue : 0,
  };
}
