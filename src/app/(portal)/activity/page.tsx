import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { ActivityIcon } from "@/components/portal/activity-list";
import { FilterSelect, SearchFilter } from "@/components/portal/filter-select";
import { EmptyState, PageHeader, Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { ACTIVITY_RANGES, ACTIVITY_RANGE_LABELS, ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@/lib/domain";
import { formatCurrency, formatDate, formatQuantity, pluralize } from "@/lib/format";
import { activityQuerySchema, listActivity } from "@/lib/server/services/activity";
import { listAccounts } from "@/lib/server/services/portfolio";
import { getPageContext } from "@/lib/server/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Activity" };

const PAGE_SIZE = 50;

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const context = await getPageContext();
  if (!context) notFound();
  const sp = await searchParams;
  const pick = (key: string) => (typeof sp[key] === "string" && sp[key] !== "" ? (sp[key] as string) : undefined);
  const page = Math.max(1, Math.min(2000, Number(pick("page") ?? 1) || 1));
  const parsed = activityQuerySchema.safeParse({
    range: pick("range"),
    accountId: pick("accountId"),
    type: pick("type"),
    q: pick("q"),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const query = parsed.success ? parsed.data : activityQuerySchema.parse({});
  const [result, accounts] = await Promise.all([listActivity(context.householdId, query), listAccounts(context.householdId)]);

  const exportParams = new URLSearchParams();
  exportParams.set("range", query.range);
  if (query.accountId) exportParams.set("accountId", query.accountId);
  if (query.type) exportParams.set("type", query.type);
  if (query.q) exportParams.set("q", query.q);
  const pageHref = (n: number) => {
    const next = new URLSearchParams(exportParams);
    if (n > 1) next.set("page", String(n));
    return `/activity?${next}`;
  };
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Trades, contributions, income, and transfers across your accounts."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={`/api/activity/export?${exportParams}`} download>
              <Download /> Download CSV
            </a>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FilterSelect
          param="range"
          label="Date range"
          defaultValue="90d"
          options={ACTIVITY_RANGES.map((r) => ({ value: r, label: ACTIVITY_RANGE_LABELS[r] }))}
        />
        <FilterSelect
          param="accountId"
          label="Account"
          allLabel="All accounts"
          options={accounts.map((a) => ({ value: a.id, label: `${a.nickname} ${a.maskedNumber}` }))}
          className="sm:min-w-[240px]"
        />
        <FilterSelect
          param="type"
          label="Activity type"
          allLabel="All activity types"
          options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t] }))}
        />
        <div className="sm:ml-auto">
          <SearchFilter placeholder="Search description or symbol" />
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <p className="text-[12px] text-muted-foreground">Transactions</p>
          <p className="tabular text-[18px] font-semibold">{result.total.toLocaleString("en-US")}</p>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <p className="text-[12px] text-muted-foreground">Money in (contributions, deposits, rollovers)</p>
          <p className="tabular text-[18px] font-semibold text-[#1f7a4d]">{formatCurrency(result.inflows)}</p>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <p className="text-[12px] text-muted-foreground">Money out (withdrawals, transfers out)</p>
          <p className="tabular text-[18px] font-semibold">{formatCurrency(result.outflows)}</p>
        </div>
      </div>

      <Panel bodyClassName="p-0">
        {result.items.length === 0 ? (
          <EmptyState title="No activity matches these filters" description="Try a longer date range or clear the account and type filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Description</th>
                  <th className="px-3 py-2.5 font-medium">Account</th>
                  <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="tabular whitespace-nowrap px-5 py-2.5 text-muted-foreground">{formatDate(item.tradeDate)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <ActivityIcon type={item.type} />
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {ACTIVITY_TYPE_LABELS[item.type]}
                            {item.symbol ? ` · ${item.symbol}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.accountName}</td>
                    <td className="tabular px-3 py-2.5 text-right">{item.quantity !== null ? formatQuantity(item.quantity) : "—"}</td>
                    <td className="tabular px-3 py-2.5 text-right">{item.price !== null ? formatCurrency(item.price) : "—"}</td>
                    <td className={cn("tabular px-5 py-2.5 text-right font-medium", item.amount >= 0 ? "text-[#1f7a4d]" : "text-foreground")}>
                      {formatCurrency(item.amount, { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-[13px] text-muted-foreground" aria-label="Pagination">
          <span>
            Page {page} of {pages} · {pluralize(result.total, "transaction")}
          </span>
          <div className="flex gap-2">
            <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
              {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
            </Button>
            <Button asChild={page < pages} variant="outline" size="sm" disabled={page >= pages}>
              {page < pages ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
