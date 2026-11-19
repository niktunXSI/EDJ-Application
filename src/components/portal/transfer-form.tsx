"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { FREQUENCIES, FREQUENCY_LABELS, MOVEMENT_KINDS, RETIREMENT_ACCOUNT_TYPES, type AccountType, type Frequency, type MovementKind } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BankAccount, IraContributionSummary, IraContributions, Movement } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TransferAccount {
  id: string;
  nickname: string;
  maskedNumber: string;
  type: AccountType;
  cashBalance: number;
  ownerClientId: string | null;
}

function iraOwnerSummary(
  kind: MovementKind,
  toAccountId: string,
  accounts: TransferAccount[],
  iraContributions: IraContributions,
): IraContributionSummary | undefined {
  if (kind === "withdrawal" || !toAccountId) return undefined;
  const to = accounts.find((a) => a.id === toAccountId);
  if (!to || !RETIREMENT_ACCOUNT_TYPES.includes(to.type) || !to.ownerClientId) return undefined;
  return iraContributions.members.find((m) => m.clientId === to.ownerClientId);
}

/** Monthly transfers are totalled through December, since every payment counts toward the same year's limit. */
function iraOverLimitWarning(summary: IraContributionSummary, numericAmount: number, frequency: Frequency, scheduledFor: string): string | null {
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;
  if (Number(scheduledFor.slice(0, 4)) !== summary.taxYear) return null;
  const payments = frequency === "monthly" ? 13 - Number(scheduledFor.slice(5, 7)) : 1;
  const total = Math.round(numericAmount * payments * 100) / 100;
  if (total <= summary.remaining) return null;
  const { firstName, taxYear } = summary;
  const penalty = "Contributions over the limit can owe a 6% excess-contribution tax each year until corrected.";
  if (summary.excess > 0) {
    return `${firstName} is already ${formatCurrency(summary.excess)} over the ${taxYear} IRA contribution limit. ${penalty}`;
  }
  if (summary.remaining === 0) {
    return `${firstName} has already reached the ${taxYear} IRA contribution limit. ${penalty}`;
  }
  const what = payments > 1 ? `These ${payments} monthly transfers through December total ${formatCurrency(total)}, which is` : "This is";
  return `${what} ${formatCurrency(total - summary.remaining)} more than ${firstName}'s remaining ${taxYear} IRA contribution room. ${penalty}`;
}

const KIND_TABS: Record<MovementKind, string> = {
  internal: "Between my accounts",
  deposit: "Deposit from bank",
  withdrawal: "Withdraw to bank",
};

const BRANCH_ONLY: readonly AccountType[] = ["traditional_ira", "roth_ira", "education_529"];

export function TransferForm({
  accounts,
  banks,
  iraContributions,
  today,
  defaultTo,
}: {
  accounts: TransferAccount[];
  banks: BankAccount[];
  iraContributions: IraContributions;
  today: string;
  defaultTo?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<MovementKind>(defaultTo ? "deposit" : "internal");
  const [fromAccountId, setFrom] = useState("");
  const [toAccountId, setTo] = useState(defaultTo ?? "");
  const [bankAccountId, setBank] = useState(banks[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [scheduledFor, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fromOptions = useMemo(() => accounts.filter((a) => !BRANCH_ONLY.includes(a.type)), [accounts]);
  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.nickname} ${a.maskedNumber}` : "";
  };
  const bankLabel = (id: string) => banks.find((b) => b.id === id)?.label ?? "";
  const from = accounts.find((a) => a.id === fromAccountId);
  const numericAmount = Number(amount.replace(/[$,\s]/g, ""));
  const iraSummary = useMemo(
    () => iraOwnerSummary(kind, toAccountId, accounts, iraContributions),
    [kind, toAccountId, accounts, iraContributions],
  );
  const iraWarning = iraSummary ? iraOverLimitWarning(iraSummary, numericAmount, frequency, scheduledFor) : null;
  const iraOtherYear = iraSummary && scheduledFor && Number(scheduledFor.slice(0, 4)) !== iraSummary.taxYear ? scheduledFor.slice(0, 4) : null;

  function validate() {
    const next: Record<string, string> = {};
    if (kind !== "deposit" && !fromAccountId) next.fromAccountId = "Choose an account to move money from.";
    if (kind !== "withdrawal" && !toAccountId) next.toAccountId = "Choose an account to move money to.";
    if (kind === "internal" && fromAccountId && fromAccountId === toAccountId) next.toAccountId = "Choose a different account.";
    if (kind !== "internal" && !bankAccountId) next.bankAccountId = "Choose a linked bank account.";
    if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) next.amount = "Enter an amount greater than $0.";
    if (!scheduledFor || scheduledFor < today) next.scheduledFor = "Choose today or a future date.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function reset() {
    setAmount("");
    setMemo("");
    setFrequency("once");
    setDate(today);
    setErrors({});
  }

  async function submit() {
    setSubmitting(true);
    try {
      const movement = await apiFetch<Movement>("/api/transfers", {
        body: {
          kind,
          fromAccountId: kind === "deposit" ? null : fromAccountId,
          toAccountId: kind === "withdrawal" ? null : toAccountId,
          bankAccountId: kind === "internal" ? null : bankAccountId,
          amount: Math.round(numericAmount * 100) / 100,
          frequency,
          scheduledFor,
          memo: memo.trim() || null,
        },
      });
      toast.success(`${formatCurrency(movement.amount)} ${movement.frequency === "monthly" ? "monthly transfer" : "transfer"} scheduled`, {
        description: `${movement.fromLabel} → ${movement.toLabel}, ${formatDate(movement.scheduledFor)}. Reference ${movement.id}.`,
      });
      setReviewing(false);
      reset();
      router.refresh();
    } catch (error) {
      setReviewing(false);
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (key: string) => errors[key] && <p className="mt-1 text-[12px] text-destructive">{errors[key]}</p>;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (validate()) setReviewing(true);
      }}
      noValidate
    >
      <div role="tablist" aria-label="Transfer type" className="mb-5 grid grid-cols-3 rounded-md border border-border bg-muted/60 p-0.5">
        {MOVEMENT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              setErrors({});
            }}
            className={cn(
              "rounded px-2 py-1.5 text-[12.5px] font-medium transition-colors",
              kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {KIND_TABS[k]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="transfer-from" className="mb-1.5">
            From
          </Label>
          {kind === "deposit" ? (
            <Select value={bankAccountId} onValueChange={setBank}>
              <SelectTrigger id="transfer-from" className="w-full">
                <SelectValue placeholder="Choose a linked bank" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={fromAccountId} onValueChange={setFrom}>
              <SelectTrigger id="transfer-from" className="w-full" aria-invalid={!!errors.fromAccountId}>
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {fromOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nickname} {a.maskedNumber} · {formatCurrency(a.cashBalance)} available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {fieldError(kind === "deposit" ? "bankAccountId" : "fromAccountId")}
          {kind !== "deposit" && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Withdrawals from IRAs and 529 plans are handled by your branch team because they can have tax consequences.
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <span className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <ArrowDown className="size-3.5" />
          </span>
        </div>

        <div>
          <Label htmlFor="transfer-to" className="mb-1.5">
            To
          </Label>
          {kind === "withdrawal" ? (
            <Select value={bankAccountId} onValueChange={setBank}>
              <SelectTrigger id="transfer-to" className="w-full">
                <SelectValue placeholder="Choose a linked bank" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={toAccountId} onValueChange={setTo}>
              <SelectTrigger id="transfer-to" className="w-full" aria-invalid={!!errors.toAccountId}>
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => kind !== "internal" || a.id !== fromAccountId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nickname} {a.maskedNumber}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          {fieldError(kind === "withdrawal" ? "bankAccountId" : "toAccountId")}
          {iraSummary && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {iraSummary.firstName} has {formatCurrency(iraSummary.remaining)} of {iraSummary.taxYear} IRA contribution room left (limit{" "}
              {formatCurrency(iraSummary.limit, { whole: true })}, {formatCurrency(iraSummary.contributed)} contributed). Contribute by{" "}
              {formatDate(iraSummary.deadline)}.
              {iraOtherYear && ` Transfers dated in ${iraOtherYear} count toward the ${iraOtherYear} limit instead.`}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="transfer-amount" className="mb-1.5">
              Amount
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">$</span>
              <Input
                id="transfer-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="tabular pl-6"
                aria-invalid={!!errors.amount}
              />
            </div>
            {fieldError("amount")}
            {from && kind !== "deposit" && <p className="mt-1 text-[12px] text-muted-foreground">{formatCurrency(from.cashBalance)} cash available</p>}
            {iraWarning && !reviewing && (
              <p
                role="alert"
                className="mt-2 rounded-md bg-[#fdf0dc] px-3 py-2 text-[12px] leading-relaxed text-[#8a5a00]"
              >
                {iraWarning}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="transfer-frequency" className="mb-1.5">
              Frequency
            </Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger id="transfer-frequency" className="w-full">
                <SelectValue>{FREQUENCY_LABELS[frequency]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="transfer-date" className="mb-1.5">
            {frequency === "monthly" ? "First transfer on" : "Transfer date"}
          </Label>
          <Input id="transfer-date" type="date" min={today} value={scheduledFor} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.scheduledFor} />
          {fieldError("scheduledFor")}
        </div>

        <div>
          <Label htmlFor="transfer-memo" className="mb-1.5">
            Memo <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="transfer-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={140} rows={2} placeholder="For your records" />
        </div>

        <Button type="submit" className="w-full">
          Review transfer
        </Button>
      </div>

      <AlertDialog open={reviewing} onOpenChange={(open) => !submitting && setReviewing(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review your transfer</AlertDialogTitle>
            <AlertDialogDescription>Check the details below before you submit.</AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="divide-y divide-border rounded-md border border-border text-[13.5px]">
            {[
              ["From", kind === "deposit" ? bankLabel(bankAccountId) : accountLabel(fromAccountId)],
              ["To", kind === "withdrawal" ? bankLabel(bankAccountId) : accountLabel(toAccountId)],
              ["Amount", Number.isFinite(numericAmount) ? formatCurrency(numericAmount) : "—"],
              ["Frequency", FREQUENCY_LABELS[frequency]],
              [frequency === "monthly" ? "Starts" : "Date", formatDate(scheduledFor)],
              ...(memo.trim() ? [["Memo", memo.trim()]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {iraWarning && (
            <p
              role="alert"
              className="rounded-md bg-[#fdf0dc] px-3 py-2 text-[12px] leading-relaxed text-[#8a5a00]"
            >
              {iraWarning}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Edit</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {submitting && <Loader2 className="animate-spin" />} Submit transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
