import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Landmark, LifeBuoy, Mail, MapPin, Phone } from "lucide-react";
import { PreferencesForm } from "@/components/portal/preferences-form";
import { FieldRow, PageHeader, Panel } from "@/components/app/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, initials } from "@/lib/format";
import { getHousehold } from "@/lib/server/services/household";
import { getPreferences } from "@/lib/server/services/profile";
import { listBankAccounts } from "@/lib/server/services/transfers";
import { getPageContext } from "@/lib/server/session";

export const metadata = { title: "Profile & settings" };

const HELP = [
  { q: "When do contributions show in my account?", a: "Deposits scheduled before 4 p.m. ET on a business day usually appear the next business day." },
  { q: "How do I change a beneficiary?", a: "Beneficiary changes need a signed form. Send your branch a message and they'll prepare it for you." },
  { q: "Why can't I withdraw from my IRA online?", a: "IRA and 529 distributions have tax reporting and withholding elections, so your branch processes them with you." },
  { q: "How do I add a bank account?", a: "Call your branch to link a new bank. For your security, new banks are verified before first use." },
];

export default async function ProfilePage() {
  const context = await getPageContext();
  if (!context) notFound();
  const [household, preferences, banks] = await Promise.all([
    getHousehold(context.householdId),
    getPreferences(context.householdId),
    listBankAccounts(context.householdId),
  ]);
  const { advisor } = household;

  return (
    <div>
      <PageHeader
        title="Profile & settings"
        description={`${household.name} · client since ${formatDate(household.clientSince)}`}
        eyebrow={
          <p className="text-[12px] text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{context.viewer.email}</span>
          </p>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title="Account owners" description="To update legal names or addresses, contact your branch.">
            <div className="grid gap-4 sm:grid-cols-2">
              {household.clients.map((c) => (
                <div key={c.id} className="rounded-md border border-border/70 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-forest-800 text-[13px] font-semibold text-white">{initials(c.fullName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[14px] font-semibold">{c.fullName}</p>
                      {c.isPrimary && <Badge variant="outline">Primary</Badge>}
                    </div>
                  </div>
                  <dl>
                    <FieldRow label="Date of birth">{formatDate(c.dateOfBirth)}</FieldRow>
                    <FieldRow label="Email">{c.email}</FieldRow>
                    <FieldRow label="Phone">{c.phone}</FieldRow>
                    <FieldRow label="Address">
                      {c.addressLine}
                      <br />
                      {c.city}, {c.state} {c.postalCode}
                    </FieldRow>
                  </dl>
                </div>
              ))}
            </div>
          </Panel>
          <Panel id="preferences" title="Delivery and alert preferences">
            <PreferencesForm initial={preferences} />
          </Panel>
          <Panel id="help" title="Help" actions={<LifeBuoy className="size-4 text-muted-foreground" />}>
            <dl className="divide-y divide-border/60">
              {HELP.map((h) => (
                <div key={h.q} className="py-3 first:pt-0 last:pb-0">
                  <dt className="text-[13.5px] font-medium">{h.q}</dt>
                  <dd className="mt-1 text-[13px] text-muted-foreground">{h.a}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/messages/new">Ask your branch a question</Link>
            </Button>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Your financial advisor">
            <div className="mb-3 flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="bg-forest-800 text-[14px] font-semibold text-white">{initials(advisor.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[15px] font-semibold">{advisor.name}</p>
                <p className="text-[12.5px] text-muted-foreground">{advisor.title}</p>
              </div>
            </div>
            <ul className="space-y-2 text-[13px]">
              <li className="flex gap-2">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {advisor.branch}
              </li>
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {advisor.addressLine}, {advisor.city}, {advisor.state}
                </span>
              </li>
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {advisor.phone}
              </li>
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {advisor.email}
              </li>
            </ul>
            {household.serviceTeam.length > 0 && (
              <div className="mt-4 border-t border-border/70 pt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Branch team</p>
                <ul className="space-y-2">
                  {household.serviceTeam.map((m) => (
                    <li key={m.name} className="text-[13px]">
                      <span className="font-medium">{m.name}</span> · <span className="text-muted-foreground">{m.role}</span>
                      <br />
                      <span className="text-muted-foreground">{m.phone}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
          <Panel title="Linked bank accounts" description="Used for deposits and withdrawals.">
            <ul className="space-y-3">
              {banks.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-cream-50 text-forest-800">
                    <Landmark className="size-4" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium">{b.bankName}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {b.accountKind} ••••{b.lastFour}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
