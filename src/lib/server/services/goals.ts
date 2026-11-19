import "server-only";
import { z } from "zod";
import { addDays, isIsoDate, monthsBetween, todayIso } from "@/lib/dates";
import { projectValue } from "@/lib/projection";
import type { AccountSummary, Goal } from "@/lib/types";
import { sql } from "../db";
import { notFound, unprocessable } from "../http";
import { listAccounts } from "./portfolio";

interface GoalRow {
  id: string;
  name: string;
  goal_type: Goal["type"];
  target_amount: number;
  target_date: string;
  monthly_contribution: number;
  assumed_return: number;
  account_ids: string[] | string;
}

function parseIds(value: string[] | string): string[] {
  if (Array.isArray(value)) return value;
  return value.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
}

function toGoal(row: GoalRow, accounts: AccountSummary[], today: string): Goal {
  const ids = parseIds(row.account_ids);
  const linked = accounts.filter((a) => ids.includes(a.id));
  const currentValue = Math.round(linked.reduce((sum, a) => sum + a.marketValue, 0) * 100) / 100;
  const monthsRemaining = Math.max(0, monthsBetween(today, row.target_date));
  const projectedValue = Math.round(projectValue(currentValue, row.monthly_contribution, row.assumed_return, monthsRemaining));
  return {
    id: row.id,
    name: row.name,
    type: row.goal_type,
    targetAmount: row.target_amount,
    targetDate: row.target_date,
    monthlyContribution: row.monthly_contribution,
    assumedReturn: row.assumed_return,
    accountIds: ids,
    accountNames: linked.map((a) => a.nickname),
    currentValue,
    projectedValue,
    progress: row.target_amount > 0 ? Math.min(currentValue / row.target_amount, 1) : 0,
    onTrack: projectedValue >= row.target_amount,
    monthsRemaining,
  };
}

export async function listGoals(householdId: string): Promise<Goal[]> {
  const [rows, accounts] = await Promise.all([
    sql<GoalRow>("select * from goals where household_id = $1 order by target_date", [householdId]),
    listAccounts(householdId),
  ]);
  const today = todayIso();
  return rows.map((row) => toGoal(row, accounts, today));
}

export const goalUpdateSchema = z
  .object({
    targetAmount: z.number().positive("Enter a target greater than $0.").max(100_000_000).optional(),
    targetDate: z.string().refine(isIsoDate, "Choose a valid date.").optional(),
    monthlyContribution: z.number().min(0, "Monthly savings cannot be negative.").max(1_000_000).optional(),
  })
  .strict();

export async function updateGoal(householdId: string, id: string, raw: unknown): Promise<Goal> {
  const input = goalUpdateSchema.parse(raw);
  const today = todayIso();
  if (input.targetDate && input.targetDate <= addDays(today, 30)) {
    throw unprocessable("validation_failed", "Choose a target date at least a month away.", {
      fields: [{ path: "targetDate", message: "Choose a target date at least a month away." }],
    });
  }
  const [row] = await sql<GoalRow>(
    `update goals set target_amount = coalesce($3, target_amount),
                      target_date = coalesce($4, target_date),
                      monthly_contribution = coalesce($5, monthly_contribution)
      where household_id = $1 and id = $2 returning *`,
    [householdId, id, input.targetAmount ?? null, input.targetDate ?? null, input.monthlyContribution ?? null],
  );
  if (!row) throw notFound("Goal");
  return toGoal(row, await listAccounts(householdId), today);
}
