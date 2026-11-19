import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Change({
  amount,
  percent,
  className,
  showIcon = true,
}: {
  amount: number;
  percent?: number;
  className?: string;
  showIcon?: boolean;
}) {
  const positive = amount >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("tabular inline-flex items-center gap-0.5 font-medium", positive ? "text-[#1f7a4d]" : "text-[#b42318]", className)}>
      {showIcon && <Icon aria-hidden className="size-3.5" />}
      {formatCurrency(amount, { signed: true })}
      {percent !== undefined && <span className="ml-1">({formatPercent(percent, { signed: true })})</span>}
    </span>
  );
}

export function Money({ value, className, whole }: { value: number; className?: string; whole?: boolean }) {
  return <span className={cn("tabular", className)}>{formatCurrency(value, { whole })}</span>;
}
