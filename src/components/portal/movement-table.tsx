"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { FREQUENCY_LABELS, MOVEMENT_STATUS_LABELS, type MovementStatus } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Movement } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<MovementStatus, string> = {
  scheduled: "border-forest-800/20 bg-forest-50 text-forest-800",
  processing: "border-gold-500/30 bg-gold-100 text-gold-600",
  completed: "border-border bg-muted text-muted-foreground",
  cancelled: "border-border bg-card text-muted-foreground line-through",
};

export function MovementTable({ movements, cancellable = false, empty }: { movements: Movement[]; cancellable?: boolean; empty: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<Movement | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!target) return;
    setBusy(true);
    try {
      await apiFetch(`/api/transfers/${target.id}/cancel`, { method: "POST" });
      toast.success("Transfer cancelled", { description: `${formatCurrency(target.amount)} to ${target.toLabel}` });
      setTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (movements.length === 0) return <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">{empty}</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">{cancellable ? "Next date" : "Date"}</th>
              <th className="px-3 py-2.5 font-medium">From → To</th>
              <th className="px-3 py-2.5 font-medium">Frequency</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              {cancellable && <th className="px-5 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-border/50 last:border-0">
                <td className="tabular whitespace-nowrap px-5 py-3">{formatDate(m.scheduledFor)}</td>
                <td className="px-3 py-3">
                  <p className="font-medium">{m.fromLabel}</p>
                  <p className="text-[12px] text-muted-foreground">
                    to {m.toLabel}
                    {m.memo ? ` · ${m.memo}` : ""}
                  </p>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{FREQUENCY_LABELS[m.frequency]}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[m.status])}>
                    {MOVEMENT_STATUS_LABELS[m.status]}
                  </Badge>
                </td>
                <td className="tabular px-3 py-3 text-right font-semibold">{formatCurrency(m.amount)}</td>
                {cancellable && (
                  <td className="px-5 py-3 text-right">
                    {m.status === "scheduled" && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setTarget(m)}>
                        Cancel
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AlertDialog open={target !== null} onOpenChange={(open) => !open && !busy && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              {target &&
                `${formatCurrency(target.amount)} ${target.frequency === "monthly" ? "every month " : ""}from ${target.fromLabel} to ${target.toLabel}. ${
                  target.frequency === "monthly" ? "All future occurrences will stop." : ""
                }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep transfer</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void cancel();
              }}
            >
              Cancel transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
