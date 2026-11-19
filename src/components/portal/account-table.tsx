import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ACCOUNT_TYPE_LABELS } from "@/lib/domain";
import { formatCurrency } from "@/lib/format";
import type { AccountSummary } from "@/lib/types";
import { Change } from "./change";

export function AccountTable({ accounts, showDetails = false }: { accounts: AccountSummary[]; showDetails?: boolean }) {
  const total = accounts.reduce((s, a) => s + a.marketValue, 0);
  const dayChange = accounts.reduce((s, a) => s + a.dayChange, 0);
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13.5px]">
        <thead>
          <tr className="border-b border-border/70 text-left text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
            <th className="px-5 pb-2 font-medium">Account</th>
            {showDetails && <th className="px-3 pb-2 font-medium">Objective</th>}
            {showDetails && <th className="px-3 pb-2 text-right font-medium">Cash available</th>}
            <th className="px-3 pb-2 text-right font-medium">Today&apos;s change</th>
            <th className="px-5 pb-2 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="group border-b border-border/50 last:border-0 hover:bg-muted/40">
              <td className="px-5 py-3">
                <Link href={`/accounts/${account.id}`} className="flex items-center gap-2 font-medium text-forest-900 hover:underline underline-offset-4">
                  {account.nickname}
                  <ChevronRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span>{ACCOUNT_TYPE_LABELS[account.type]}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular">{account.maskedNumber}</span>
                  {account.isAdvisory && (
                    <Badge variant="outline" className="h-[18px] border-gold-500/40 bg-gold-100 px-1.5 text-[10.5px] text-gold-600">
                      Advisory
                    </Badge>
                  )}
                </div>
              </td>
              {showDetails && <td className="px-3 py-3 text-muted-foreground">{account.objective}</td>}
              {showDetails && <td className="tabular px-3 py-3 text-right">{formatCurrency(account.cashBalance)}</td>}
              <td className="px-3 py-3 text-right">
                <Change amount={account.dayChange} percent={account.dayChangePercent} className="text-[12.5px]" showIcon={false} />
              </td>
              <td className="tabular px-5 py-3 text-right font-semibold">{formatCurrency(account.marketValue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="px-5 pt-3 font-semibold" colSpan={showDetails ? 3 : 1}>
              Total
            </td>
            <td className="px-3 pt-3 text-right">
              <Change amount={dayChange} className="text-[12.5px]" showIcon={false} />
            </td>
            <td className="tabular px-5 pt-3 text-right font-semibold">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
