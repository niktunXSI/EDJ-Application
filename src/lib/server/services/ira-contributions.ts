import "server-only";
import { RETIREMENT_ACCOUNT_TYPES, type AccountType } from "@/lib/domain";
import { todayIso } from "@/lib/dates";
import type { IraContributionAccount, IraContributionSummary, IraContributions } from "@/lib/types";
import { sql } from "../db";
import { listClients } from "./household";

/** IRS annual limit shared by a person's Traditional and Roth IRAs, and the age-50 catch-up. */
export const IRA_LIMITS: Record<number, { base: number; catchUp: number }> = {
  2025: { base: 7_000, catchUp: 1_000 },
  2026: { base: 7_500, catchUp: 1_100 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Limits for a tax year; years not yet published use the most recent known year. */
export function iraLimitsFor(taxYear: number) {
  const years = Object.keys(IRA_LIMITS)
    .map(Number)
    .sort((a, b) => a - b);
  const year = years.filter((y) => y <= taxYear).at(-1) ?? years[0];
  return IRA_LIMITS[year];
}

/** Catch-up applies when the person turns 50 on or before December 31 of the tax year. */
export function isCatchUpEligible(dateOfBirth: string, taxYear: number) {
  return Number(dateOfBirth.slice(0, 4)) <= taxYear - 50;
}

export function contributionDeadline(taxYear: number) {
  return `${taxYear + 1}-04-15`;
}

/** The tax year whose contributions the portal tracks: the current calendar year. */
export function currentContributionYear(today = todayIso()) {
  return Number(today.slice(0, 4));
}

export function calculateIraRoom({ taxYear, dateOfBirth, contributed }: { taxYear: number; dateOfBirth: string; contributed: number }) {
  const { base, catchUp } = iraLimitsFor(taxYear);
  const catchUpEligible = isCatchUpEligible(dateOfBirth, taxYear);
  const limit = base + (catchUpEligible ? catchUp : 0);
  const total = round2(contributed);
  return {
    taxYear,
    deadline: contributionDeadline(taxYear),
    baseLimit: base,
    catchUpAmount: catchUp,
    catchUpEligible,
    limit,
    contributed: total,
    remaining: round2(Math.max(limit - total, 0)),
    excess: round2(Math.max(total - limit, 0)),
    progress: limit > 0 ? Math.min(total / limit, 1) : 0,
  };
}

interface IraAccountRow {
  id: string;
  nickname: string;
  account_type: AccountType;
  owner_client_id: string;
  contributed: number;
}

/** Each household member's contributions for the tax year across all of their Traditional and Roth IRAs. */
export async function getIraContributions(householdId: string, taxYear = currentContributionYear()): Promise<IraContributions> {
  const [clients, rows] = await Promise.all([
    listClients(householdId),
    sql<IraAccountRow>(
      `select a.id, a.nickname, a.account_type, a.owner_client_id,
              coalesce(sum(t.amount) filter (where t.activity_type = 'contribution' and t.tax_year = $2), 0)::float as contributed
         from accounts a
         left join transactions t on t.account_id = a.id
        where a.household_id = $1 and a.owner_client_id is not null and a.account_type = any($3::text[])
        group by a.id
        order by a.sort_order, a.id`,
      [householdId, taxYear, RETIREMENT_ACCOUNT_TYPES],
    ),
  ]);
  const members: IraContributionSummary[] = clients.map((client) => {
    const accounts: IraContributionAccount[] = rows
      .filter((r) => r.owner_client_id === client.id)
      .map((r) => ({ id: r.id, nickname: r.nickname, type: r.account_type, contributed: round2(r.contributed) }));
    return {
      clientId: client.id,
      clientName: client.fullName,
      firstName: client.firstName,
      ...calculateIraRoom({ taxYear, dateOfBirth: client.dateOfBirth, contributed: accounts.reduce((sum, a) => sum + a.contributed, 0) }),
      accounts,
    };
  });
  return { taxYear, deadline: contributionDeadline(taxYear), members };
}
