import { ArrowDownLeft, ArrowUpRight, Banknote, CircleDollarSign, Landmark, Receipt, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityType, typeof Banknote> = {
  buy: TrendingUp,
  sell: TrendingDown,
  dividend: CircleDollarSign,
  interest: Banknote,
  contribution: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  transfer_in: ArrowDownLeft,
  transfer_out: ArrowUpRight,
  fee: Receipt,
  rollover: RefreshCcw,
};

export function ActivityIcon({ type }: { type: ActivityType }) {
  const Icon = ICONS[type] ?? Landmark;
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-800">
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="divide-y divide-border/60">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-2.5">
          <ActivityIcon type={item.type} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{item.description}</p>
            <p className="truncate text-[12px] text-muted-foreground">
              {ACTIVITY_TYPE_LABELS[item.type]} · {item.accountName} · {formatDate(item.tradeDate)}
            </p>
          </div>
          <span className={cn("tabular text-[13.5px] font-medium", item.amount >= 0 ? "text-[#1f7a4d]" : "text-foreground")}>
            {formatCurrency(item.amount, { signed: true })}
          </span>
        </li>
      ))}
    </ul>
  );
}
