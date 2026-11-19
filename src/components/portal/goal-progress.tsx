import { CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import type { Goal } from "@/lib/types";

export function GoalStatus({ goal }: { goal: Goal }) {
  return goal.onTrack ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-forest-100 px-2 py-0.5 text-[11.5px] font-medium text-forest-800">
      <CheckCircle2 className="size-3.5" /> On track
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf0dc] px-2 py-0.5 text-[11.5px] font-medium text-[#8a5a00]">
      <AlertTriangle className="size-3.5" /> Needs attention
    </span>
  );
}

export function GoalProgressBar({ goal }: { goal: Goal }) {
  const projected = Math.min(goal.projectedValue / goal.targetAmount, 1);
  return (
    <div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(goal.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-forest-100" style={{ width: `${projected * 100}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-forest-800" style={{ width: `${goal.progress * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-muted-foreground">
        <span>
          <span className="tabular font-medium text-foreground">{formatCurrency(goal.currentValue, { whole: true })}</span> today
        </span>
        <span>
          Goal <span className="tabular font-medium text-foreground">{formatCurrency(goal.targetAmount, { whole: true })}</span> by {formatMonthYear(goal.targetDate)}
        </span>
      </div>
    </div>
  );
}
