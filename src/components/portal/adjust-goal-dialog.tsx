"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { monthsBetween } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { projectValue } from "@/lib/projection";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdjustGoalDialog({ goal, today }: { goal: Goal; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [monthly, setMonthly] = useState(String(goal.monthlyContribution));
  const [target, setTarget] = useState(String(goal.targetAmount));
  const [date, setDate] = useState(goal.targetDate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const monthlyNum = Number(monthly) || 0;
  const targetNum = Number(target) || 0;
  const projected = projectValue(goal.currentValue, monthlyNum, goal.assumedReturn, Math.max(0, monthsBetween(today, date)));
  const onTrack = targetNum > 0 && projected >= targetNum;

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      await apiFetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        body: { monthlyContribution: monthlyNum, targetAmount: targetNum, targetDate: date },
      });
      toast.success(`${goal.name} updated`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal /> Adjust plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {goal.name}</DialogTitle>
          <DialogDescription>Try different savings amounts and dates. Your advisor will see the changes before your next review.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${goal.id}-monthly`} className="mb-1.5">
              Monthly savings
            </Label>
            <Input id={`${goal.id}-monthly`} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="tabular" />
            {errors.monthlyContribution && <p className="mt-1 text-[12px] text-destructive">{errors.monthlyContribution}</p>}
          </div>
          <div>
            <Label htmlFor={`${goal.id}-target`} className="mb-1.5">
              Goal amount
            </Label>
            <Input id={`${goal.id}-target`} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="tabular" />
            {errors.targetAmount && <p className="mt-1 text-[12px] text-destructive">{errors.targetAmount}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`${goal.id}-date`} className="mb-1.5">
              Target date
            </Label>
            <Input id={`${goal.id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {errors.targetDate && <p className="mt-1 text-[12px] text-destructive">{errors.targetDate}</p>}
          </div>
        </div>
        <div className={cn("rounded-md px-4 py-3 text-[13px]", onTrack ? "bg-forest-50 text-forest-900" : "bg-[#fdf0dc] text-[#6b4500]")}>
          Projected value: <span className="tabular font-semibold">{formatCurrency(projected, { whole: true })}</span> at an assumed{" "}
          {(goal.assumedReturn * 100).toFixed(1)}% annual return. {onTrack ? "You're on track." : "This falls short of your goal."}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
