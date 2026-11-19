import { notFound } from "next/navigation";
import { GraduationCap, Home, Palmtree } from "lucide-react";
import { AdjustGoalDialog } from "@/components/portal/adjust-goal-dialog";
import { GoalProgressBar, GoalStatus } from "@/components/portal/goal-progress";
import { FieldRow, PageHeader, Panel } from "@/components/app/page-header";
import { todayIso } from "@/lib/dates";
import { GOAL_TYPE_LABELS } from "@/lib/domain";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { listGoals } from "@/lib/server/services/goals";
import { getPageContext } from "@/lib/server/session";

export const metadata = { title: "Goals" };

const ICONS = { retirement: Palmtree, education: GraduationCap, major_purchase: Home };

export default async function GoalsPage() {
  const context = await getPageContext();
  if (!context) notFound();
  const goals = await listGoals(context.householdId);
  const today = todayIso();

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Track progress toward the goals you set with your financial advisor. Projections are hypothetical and not guaranteed."
      />
      <div className="space-y-6">
        {goals.map((goal) => {
          const Icon = ICONS[goal.type];
          const gap = goal.targetAmount - goal.projectedValue;
          return (
            <Panel key={goal.id} bodyClassName="p-6">
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex-1">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-full bg-forest-50 text-forest-800">
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <h2 className="font-serif text-[20px] font-semibold">{goal.name}</h2>
                        <p className="text-[12.5px] text-muted-foreground">
                          {GOAL_TYPE_LABELS[goal.type]} · target {formatMonthYear(goal.targetDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <GoalStatus goal={goal} />
                      <AdjustGoalDialog goal={goal} today={today} />
                    </div>
                  </div>
                  <GoalProgressBar goal={goal} />
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md bg-cream-50 px-4 py-3">
                      <p className="text-[12px] text-muted-foreground">Projected at target date</p>
                      <p className="tabular text-[18px] font-semibold">{formatCurrency(goal.projectedValue, { whole: true })}</p>
                    </div>
                    <div className="rounded-md bg-cream-50 px-4 py-3">
                      <p className="text-[12px] text-muted-foreground">{gap > 0 ? "Projected shortfall" : "Projected surplus"}</p>
                      <p className={`tabular text-[18px] font-semibold ${gap > 0 ? "text-[#8a5a00]" : "text-[#1f7a4d]"}`}>
                        {formatCurrency(Math.abs(gap), { whole: true })}
                      </p>
                    </div>
                    <div className="rounded-md bg-cream-50 px-4 py-3">
                      <p className="text-[12px] text-muted-foreground">Time remaining</p>
                      <p className="tabular text-[18px] font-semibold">
                        {Math.floor(goal.monthsRemaining / 12)} yr {goal.monthsRemaining % 12} mo
                      </p>
                    </div>
                  </div>
                </div>
                <dl className="w-full shrink-0 rounded-md border border-border/70 p-4 lg:w-80">
                  <FieldRow label="Monthly savings">{formatCurrency(goal.monthlyContribution, { whole: true })}</FieldRow>
                  <FieldRow label="Assumed return">{(goal.assumedReturn * 100).toFixed(1)}% a year</FieldRow>
                  <FieldRow label="Funded by">
                    <ul className="space-y-0.5">
                      {goal.accountNames.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </FieldRow>
                </dl>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
