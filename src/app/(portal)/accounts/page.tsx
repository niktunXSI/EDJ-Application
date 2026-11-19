import { notFound } from "next/navigation";
import { AccountTable } from "@/components/portal/account-table";
import { AllocationDonut } from "@/components/portal/allocation-donut";
import { PageHeader, Panel } from "@/components/app/page-header";
import { ACCOUNT_TYPE_LABELS, RETIREMENT_ACCOUNT_TYPES } from "@/lib/domain";
import { formatCurrency } from "@/lib/format";
import { allocationOf, listAccountDetails } from "@/lib/server/services/portfolio";
import { getPageContext } from "@/lib/server/session";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const context = await getPageContext();
  if (!context) notFound();
  const accounts = await listAccountDetails(context.householdId);
  const summaries = accounts.map(({ holdings: _h, allocation: _a, ...s }) => s);
  const groups = [
    { label: "Retirement", value: accounts.filter((a) => RETIREMENT_ACCOUNT_TYPES.includes(a.type)).reduce((s, a) => s + a.marketValue, 0) },
    { label: "Investment", value: accounts.filter((a) => a.type === "joint" || a.type === "individual").reduce((s, a) => s + a.marketValue, 0) },
    { label: "Education", value: accounts.filter((a) => a.type === "education_529").reduce((s, a) => s + a.marketValue, 0) },
  ];
  const unrealized = accounts.reduce((s, a) => s + a.unrealizedGain, 0);

  return (
    <div>
      <PageHeader title="Accounts" description="Balances, positions, and details for every account in your household." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => (
          <div key={g.label} className="rounded-md border border-border bg-card px-5 py-4">
            <p className="text-[12.5px] text-muted-foreground">{g.label}</p>
            <p className="tabular mt-1 text-[22px] font-semibold">{formatCurrency(g.value, { whole: true })}</p>
          </div>
        ))}
        <div className="rounded-md border border-border bg-card px-5 py-4">
          <p className="text-[12.5px] text-muted-foreground">Unrealized gain</p>
          <p className="tabular mt-1 text-[22px] font-semibold text-[#1f7a4d]">{formatCurrency(unrealized, { whole: true, signed: true })}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="All accounts" className="lg:col-span-2">
          <AccountTable accounts={summaries} showDetails />
        </Panel>
        <div className="space-y-6">
          <Panel title="Household allocation">
            <AllocationDonut slices={allocationOf(accounts)} size={140} label="Total" />
          </Panel>
          <Panel title="Account types">
            <ul className="space-y-2 text-[13px]">
              {accounts.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{a.nickname}</span>
                  <span>{ACCOUNT_TYPE_LABELS[a.type]}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
