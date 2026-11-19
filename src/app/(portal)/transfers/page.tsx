import { notFound } from "next/navigation";
import { Building2, Info } from "lucide-react";
import { MovementTable } from "@/components/portal/movement-table";
import { TransferForm } from "@/components/portal/transfer-form";
import { PageHeader, Panel } from "@/components/app/page-header";
import { todayIso } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { MAX_ONLINE_MOVEMENT } from "@/lib/server/config";
import { getIraContributions } from "@/lib/server/services/ira-contributions";
import { listAccounts } from "@/lib/server/services/portfolio";
import { listBankAccounts, listMovements } from "@/lib/server/services/transfers";
import { getPageContext } from "@/lib/server/session";

export const metadata = { title: "Transfers" };

export default async function TransfersPage({ searchParams }: PageProps<"/transfers">) {
  const context = await getPageContext();
  if (!context) notFound();
  const sp = await searchParams;
  const [accounts, banks, movements, iraContributions] = await Promise.all([
    listAccounts(context.householdId),
    listBankAccounts(context.householdId),
    listMovements(context.householdId),
    getIraContributions(context.householdId),
  ]);
  const requestedTo = typeof sp.to === "string" && accounts.some((a) => a.id === sp.to) ? sp.to : undefined;

  return (
    <div>
      <PageHeader title="Transfers" description="Move money between your accounts and linked banks, and manage scheduled transfers." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Move money" className="lg:col-span-3" bodyClassName="p-5">
          <TransferForm
            accounts={accounts.map((a) => ({
              id: a.id,
              nickname: a.nickname,
              maskedNumber: a.maskedNumber,
              type: a.type,
              cashBalance: a.cashBalance,
              ownerClientId: a.ownerClientId,
            }))}
            banks={banks}
            iraContributions={iraContributions}
            today={todayIso()}
            defaultTo={requestedTo}
          />
        </Panel>
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Linked bank accounts">
            <ul className="space-y-3">
              {banks.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-forest-50 text-forest-800">
                    <Building2 className="size-4" />
                  </span>
                  <div className="text-[13px]">
                    <p className="font-medium">{b.bankName}</p>
                    <p className="text-muted-foreground">
                      {b.accountKind} ••{b.lastFour}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] text-muted-foreground">To link another bank, contact your branch team.</p>
          </Panel>
          <Panel title="Good to know">
            <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-forest-800" />
                Transfers submitted before 4 p.m. ET on a business day begin processing the same day.
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-forest-800" />
                Online transfers are limited to {formatCurrency(MAX_ONLINE_MOVEMENT, { whole: true })} each. Your branch can help with larger amounts.
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-forest-800" />
                Deposits to an IRA are recorded as contributions for the current tax year.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Scheduled transfers" description="Upcoming one-time and recurring transfers" className="mt-6" bodyClassName="p-0">
        <MovementTable movements={movements.upcoming} cancellable empty="You have no scheduled transfers." />
      </Panel>
      <Panel
        title="Transfer history"
        description={movements.history.length ? `Since ${formatDate(movements.history.at(-1)!.scheduledFor)}` : undefined}
        className="mt-6"
        bodyClassName="p-0"
      >
        <MovementTable movements={movements.history} empty="Completed and cancelled transfers will appear here." />
      </Panel>
    </div>
  );
}
