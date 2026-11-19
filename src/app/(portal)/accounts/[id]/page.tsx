import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, FileText } from "lucide-react";
import { ActivityList } from "@/components/portal/activity-list";
import { AllocationDonut } from "@/components/portal/allocation-donut";
import { Change } from "@/components/portal/change";
import { ValueChart } from "@/components/portal/value-chart";
import { FieldRow, PageHeader, Panel } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IraContributionCards } from "@/components/portal/ira-contribution-card";
import { ACCOUNT_TYPE_LABELS, ASSET_CLASS_COLORS, ASSET_CLASS_LABELS, RETIREMENT_ACCOUNT_TYPES } from "@/lib/domain";
import { formatCurrency, formatDate, formatPercent, formatQuantity } from "@/lib/format";
import { ApiError } from "@/lib/server/http";
import { listActivity } from "@/lib/server/services/activity";
import { listDocuments } from "@/lib/server/services/documents";
import { getIraContributions } from "@/lib/server/services/ira-contributions";
import { getAccount, getValueHistory } from "@/lib/server/services/portfolio";
import { getPageContext } from "@/lib/server/session";
import { cn } from "@/lib/utils";

export default async function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  const context = await getPageContext();
  if (!context) notFound();
  const { id } = await params;
  const account = await getAccount(context.householdId, id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  const isIra = RETIREMENT_ACCOUNT_TYPES.includes(account.type);
  const [history, activity, documents, iraContributions] = await Promise.all([
    getValueHistory(context.householdId, "1y", id),
    listActivity(context.householdId, { range: "12m", accountId: id, limit: 12, offset: 0 }),
    listDocuments(context.householdId, { accountId: id }),
    isIra ? getIraContributions(context.householdId) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Accounts", href: "/accounts" }, { label: account.nickname }]}
        title={account.nickname}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span>{ACCOUNT_TYPE_LABELS[account.type]}</span>
            <span aria-hidden>·</span>
            <span className="tabular">Account {account.maskedNumber}</span>
            {account.isAdvisory && (
              <Badge variant="outline" className="border-gold-500/40 bg-gold-100 text-gold-600">
                Advisory program
              </Badge>
            )}
          </div>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/activity?accountId=${account.id}&range=12m`}>
                <FileText /> Activity
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/transfers?to=${account.id}`}>
                <ArrowLeftRight /> Move money
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" bodyClassName="p-5">
          <div className="mb-4 flex flex-wrap gap-8">
            <div>
              <p className="text-[12.5px] text-muted-foreground">Account value</p>
              <p className="tabular mt-1 font-serif text-[32px] font-semibold leading-none">{formatCurrency(account.marketValue)}</p>
            </div>
            <div>
              <p className="text-[12.5px] text-muted-foreground">Today</p>
              <p className="mt-2">
                <Change amount={account.dayChange} percent={account.dayChangePercent} />
              </p>
            </div>
            <div>
              <p className="text-[12.5px] text-muted-foreground">Unrealized gain</p>
              <p className="tabular mt-2 font-medium">{formatCurrency(account.unrealizedGain, { signed: true })}</p>
            </div>
            <div>
              <p className="text-[12.5px] text-muted-foreground">Cash available</p>
              <p className="tabular mt-2 font-medium">{formatCurrency(account.cashBalance)}</p>
            </div>
          </div>
          <ValueChart initial={history} endpoint={`/api/accounts/${account.id}/history`} />
        </Panel>
        <div className="space-y-6">
          <Panel title="Account details">
            <dl>
              <FieldRow label="Registration">{account.registration}</FieldRow>
              <FieldRow label="Objective">{account.objective}</FieldRow>
              {account.ownerName && <FieldRow label="Owner">{account.ownerName}</FieldRow>}
              {account.beneficiaryName && <FieldRow label="Beneficiary">{account.beneficiaryName}</FieldRow>}
              <FieldRow label="Opened">{formatDate(account.openedOn)}</FieldRow>
              <FieldRow label="Account no.">
                <span className="tabular">{account.maskedNumber}</span>
              </FieldRow>
            </dl>
          </Panel>
          <Panel title="Allocation">
            <AllocationDonut slices={account.allocation} size={120} label="Value" />
          </Panel>
        </div>
      </div>

      {iraContributions ? (
        <div className="mt-6">
          <IraContributionCards contributions={iraContributions} />
        </div>
      ) : null}

      <Tabs defaultValue="holdings" className="mt-6">
        <TabsList>
          <TabsTrigger value="holdings">Holdings ({account.holdings.length})</TabsTrigger>
          <TabsTrigger value="activity">Recent activity</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.items.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="holdings">
          <Panel bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Investment</th>
                    <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                    <th className="px-3 py-2.5 text-right font-medium">Price</th>
                    <th className="px-3 py-2.5 text-right font-medium">Today</th>
                    <th className="px-3 py-2.5 text-right font-medium">Cost basis</th>
                    <th className="px-3 py-2.5 text-right font-medium">Gain / loss</th>
                    <th className="px-3 py-2.5 text-right font-medium">Value</th>
                    <th className="px-5 py-2.5 text-right font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {account.holdings.map((h) => (
                    <tr key={h.symbol} className="border-b border-border/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span aria-hidden className="h-8 w-1 rounded-full" style={{ background: ASSET_CLASS_COLORS[h.assetClass] }} />
                          <div>
                            <p className="font-semibold">{h.symbol}</p>
                            <p className="text-[12px] text-muted-foreground">
                              {h.name} · {ASSET_CLASS_LABELS[h.assetClass]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="tabular px-3 py-3 text-right">{formatQuantity(h.quantity)}</td>
                      <td className="tabular px-3 py-3 text-right">{formatCurrency(h.price)}</td>
                      <td className="px-3 py-3 text-right">
                        <Change amount={h.dayChange} showIcon={false} className="text-[12.5px]" />
                      </td>
                      <td className="tabular px-3 py-3 text-right">{formatCurrency(h.costBasis)}</td>
                      <td className={cn("tabular px-3 py-3 text-right", h.gain >= 0 ? "text-[#1f7a4d]" : "text-[#b42318]")}>
                        {formatCurrency(h.gain, { signed: true })}
                        <span className="block text-[11.5px]">{formatPercent(h.gainPercent, { signed: true })}</span>
                      </td>
                      <td className="tabular px-3 py-3 text-right font-semibold">{formatCurrency(h.marketValue)}</td>
                      <td className="tabular px-5 py-3 text-right text-muted-foreground">{formatPercent(h.weight)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span aria-hidden className="h-8 w-1 rounded-full" style={{ background: ASSET_CLASS_COLORS.cash }} />
                        <div>
                          <p className="font-semibold">Cash</p>
                          <p className="text-[12px] text-muted-foreground">Money market sweep</p>
                        </div>
                      </div>
                    </td>
                    <td colSpan={5} />
                    <td className="tabular px-3 py-3 text-right font-semibold">{formatCurrency(account.cashBalance)}</td>
                    <td className="tabular px-5 py-3 text-right text-muted-foreground">
                      {formatPercent(account.marketValue > 0 ? account.cashBalance / account.marketValue : 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="activity">
          <Panel
            bodyClassName="px-5 py-1"
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href={`/activity?accountId=${account.id}&range=all`}>View all</Link>
              </Button>
            }
            title="Last 12 months"
          >
            {activity.items.length ? <ActivityList items={activity.items} /> : <p className="py-6 text-[13px] text-muted-foreground">No activity in the last 12 months.</p>}
          </Panel>
        </TabsContent>
        <TabsContent value="documents">
          <Panel bodyClassName="px-0 py-1">
            {documents.items.length ? (
              <ul className="divide-y divide-border/60">
                {documents.items.map((d) => (
                  <li key={d.id}>
                    <Link href={`/documents/${d.id}`} className="flex items-center gap-3 px-5 py-3 text-[13.5px] hover:bg-muted/40">
                      <FileText className="size-4 text-forest-800" />
                      <span className="flex-1 font-medium">{d.title}</span>
                      <span className="text-[12px] text-muted-foreground">{formatDate(d.issuedOn)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-[13px] text-muted-foreground">
                Account documents are included in your consolidated monthly statements.
              </p>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
