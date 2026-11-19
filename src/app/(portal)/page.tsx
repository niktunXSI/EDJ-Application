import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, FileText, Mail, MessageSquare, Phone } from "lucide-react";
import { AccountTable } from "@/components/portal/account-table";
import { ActivityList } from "@/components/portal/activity-list";
import { AllocationDonut } from "@/components/portal/allocation-donut";
import { Change } from "@/components/portal/change";
import { GoalProgressBar, GoalStatus } from "@/components/portal/goal-progress";
import { ValueChart } from "@/components/portal/value-chart";
import { Panel } from "@/components/app/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FREQUENCY_LABELS } from "@/lib/domain";
import { formatCurrency, formatDate, initials, partOfDay, pluralize } from "@/lib/format";
import { getOverview } from "@/lib/server/services/overview";
import { getValueHistory } from "@/lib/server/services/portfolio";
import { getPageContext } from "@/lib/server/session";

export default async function OverviewPage() {
  const context = await getPageContext();
  if (!context) notFound();
  const [overview, history] = await Promise.all([getOverview(context.householdId), getValueHistory(context.householdId, "1y")]);
  const { household } = overview;
  const primary = household.clients.find((c) => c.isPrimary) ?? household.clients[0];
  const asOf = history.points.at(-1)?.date;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-gold-600">
          {household.name} · Client since {new Date(`${household.clientSince}T00:00:00Z`).getUTCFullYear()}
        </p>
        <h1 className="font-serif text-[30px] font-semibold tracking-[-0.015em] text-[#18231d]">
          Good {partOfDay()}, {primary?.firstName ?? "there"}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" bodyClassName="px-5 pb-5 pt-5">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-medium text-muted-foreground">Total household value</p>
              <p className="tabular mt-1 font-serif text-[38px] font-semibold leading-none tracking-[-0.02em] text-[#18231d]">
                {formatCurrency(overview.totalValue)}
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Today <Change amount={overview.dayChange} percent={overview.dayChangePercent} className="text-[13px]" />
                {asOf && <span className="ml-2">· as of market close {formatDate(asOf)}</span>}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/accounts">
                View all accounts <ArrowRight />
              </Link>
            </Button>
          </div>
          <ValueChart initial={history} endpoint="/api/history" />
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Your financial advisor">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="bg-forest-800 text-[14px] font-semibold text-white">{initials(household.advisor.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{household.advisor.name}</p>
                <p className="text-[12.5px] text-muted-foreground">
                  {household.advisor.title}, {household.advisor.branch}
                </p>
              </div>
            </div>
            <dl className="mt-4 space-y-1.5 text-[13px]">
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-muted-foreground" />
                <dd className="tabular">{household.advisor.phone}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-muted-foreground" />
                <dd>{household.advisor.email}</dd>
              </div>
            </dl>
            <Button asChild className="mt-4 w-full" size="sm">
              <Link href="/messages/new">
                <MessageSquare /> Send a secure message
              </Link>
            </Button>
          </Panel>

          <Panel title="For your attention" bodyClassName="px-0 py-1">
            <ul className="divide-y divide-border/60 text-[13px]">
              <li>
                <Link href="/messages" className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                  <MessageSquare className="size-4 text-forest-800" />
                  <span className="flex-1">{overview.unreadMessages > 0 ? pluralize(overview.unreadMessages, "unread message") : "No unread messages"}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              </li>
              <li>
                <Link href="/documents" className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                  <FileText className="size-4 text-forest-800" />
                  <span className="flex-1">{overview.newDocuments > 0 ? pluralize(overview.newDocuments, "new document") : "No new documents"}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              </li>
              {overview.upcomingMovements.slice(0, 2).map((m) => (
                <li key={m.id}>
                  <Link href="/transfers" className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                    <CalendarClock className="size-4 text-forest-800" />
                    <span className="flex-1">
                      <span className="tabular font-medium">{formatCurrency(m.amount)}</span> to {m.toLabel.replace(/ ••••\d+$/, "")}
                      <span className="block text-[12px] text-muted-foreground">
                        {FREQUENCY_LABELS[m.frequency]} · next {formatDate(m.scheduledFor)}
                      </span>
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Accounts" description={`${overview.accounts.length} accounts in your household`} className="lg:col-span-2">
          <AccountTable accounts={overview.accounts} />
        </Panel>
        <Panel title="Asset allocation" description="Across all accounts">
          <AllocationDonut slices={overview.allocation} size={150} label="Total" />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Goals"
          className="lg:col-span-2"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/goals">
                Plan details <ArrowRight />
              </Link>
            </Button>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            {overview.goals.map((goal) => (
              <div key={goal.id} className="rounded-md border border-border/70 p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="font-semibold">{goal.name}</p>
                  <GoalStatus goal={goal} />
                </div>
                <GoalProgressBar goal={goal} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Recent activity"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/activity">
                All activity <ArrowRight />
              </Link>
            </Button>
          }
          bodyClassName="px-5 py-1"
        >
          <ActivityList items={overview.recentActivity} />
        </Panel>
      </div>
    </div>
  );
}
