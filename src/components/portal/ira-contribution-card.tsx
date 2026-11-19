import { CalendarClock } from "lucide-react";
import { Panel } from "@/components/app/page-header";
import { ACCOUNT_TYPE_LABELS } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import type { IraContributionSummary, IraContributions } from "@/lib/types";

function IraContributionProgress({ member }: { member: IraContributionSummary }) {
  const percent = Math.round(member.progress * 100);
  return (
    <div
      className="relative h-2.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${member.firstName}'s ${member.taxYear} IRA contributions`}
      aria-valuetext={`${formatCurrency(member.contributed)} of ${formatCurrency(member.limit, { whole: true })}${member.excess > 0 ? `, ${formatCurrency(member.excess)} over the limit` : ""}`}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-forest-800" style={{ width: `${member.progress * 100}%` }} />
    </div>
  );
}

function IraContributionCard({ member }: { member: IraContributionSummary }) {
  const atLimit = member.remaining === 0 && member.excess === 0;
  const overLimit = member.excess > 0;

  return (
    <Panel title={`${member.taxYear} IRA contributions`} description={member.clientName}>
      <div className="space-y-4">
        <div>
          <p className="tabular font-serif text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#18231d]">
            {formatCurrency(member.contributed)}
          </p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">of {formatCurrency(member.limit, { whole: true })} limit</p>
        </div>

        <IraContributionProgress member={member} />

        <div className="flex justify-between gap-4 text-[12.5px]">
          <div>
            <p className="text-muted-foreground">Contributed</p>
            <p className="tabular mt-0.5 font-medium text-foreground">{formatCurrency(member.contributed)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Remaining</p>
            <p className="tabular mt-0.5 font-medium text-foreground">{formatCurrency(member.remaining)}</p>
          </div>
        </div>

        <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-forest-800" aria-hidden />
          <span>Contribute by {formatDate(member.deadline)}</span>
        </p>

        {member.catchUpEligible && (
          <p className="text-[12px] text-muted-foreground">
            Includes {formatCurrency(member.catchUpAmount, { whole: true })} age 50+ catch-up
          </p>
        )}

        {member.accounts.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No Traditional or Roth IRA at Edward Jones</p>
        ) : (
          <ul className="space-y-1.5 border-t border-border/60 pt-3 text-[12.5px]">
            {member.accounts.map((account) => (
              <li key={account.id} className="flex justify-between gap-3">
                <span className="min-w-0 text-muted-foreground">
                  {account.nickname}
                  <span className="text-[12px]"> · {ACCOUNT_TYPE_LABELS[account.type]}</span>
                </span>
                <span className="tabular shrink-0 font-medium text-foreground">{formatCurrency(account.contributed)}</span>
              </li>
            ))}
          </ul>
        )}

        {overLimit && (
          <p className="rounded-md bg-[#fdf0dc] px-3 py-2 text-[12px] leading-relaxed text-[#8a5a00]">
            {formatCurrency(member.excess)} over the limit. Contact your financial advisor about correcting an excess contribution.
          </p>
        )}

        {atLimit && (
          <p className="rounded-md bg-forest-100 px-3 py-2 text-[12px] font-medium text-forest-800">
            {member.firstName} has reached the {member.taxYear} limit.
          </p>
        )}
      </div>
    </Panel>
  );
}

export function IraContributionCards({ contributions }: { contributions: IraContributions }) {
  const { members } = contributions;
  if (members.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-6 md:grid-cols-2">
        {members.map((member) => (
          <IraContributionCard key={member.clientId} member={member} />
        ))}
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Totals include contributions recorded at Edward Jones for the tax year. Contributions to IRAs held elsewhere are not included.
      </p>
    </div>
  );
}