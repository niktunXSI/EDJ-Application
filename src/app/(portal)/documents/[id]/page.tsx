import { notFound } from "next/navigation";
import { PrintButton } from "@/components/portal/print-button";
import { PageHeader } from "@/components/app/page-header";
import { ACCOUNT_TYPE_LABELS, ACTIVITY_TYPE_LABELS, DOCUMENT_CATEGORY_LABELS } from "@/lib/domain";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";
import { ApiError } from "@/lib/server/http";
import { getDocument } from "@/lib/server/services/documents";
import { getPageContext } from "@/lib/server/session";
import type { DocumentDetail } from "@/lib/types";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-border py-2 text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "tabular font-semibold" : "tabular"}>{value}</span>
    </div>
  );
}

function Body({ doc }: { doc: DocumentDetail }) {
  const c = doc.content;
  switch (c.kind) {
    case "statement":
    case "report":
      return (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Beginning value", c.totals.beginningValue],
              ["Ending value", c.totals.endingValue],
              ["Change in value", c.totals.endingValue - c.totals.beginningValue],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-md bg-cream-50 px-4 py-3">
                <p className="text-[12px] text-muted-foreground">{label}</p>
                <p className="tabular text-[18px] font-semibold">{formatCurrency(value as number)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-forest-800 text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="py-2 font-medium">Account</th>
                  <th className="py-2 text-right font-medium">Beginning</th>
                  <th className="py-2 text-right font-medium">Deposits & withdrawals</th>
                  <th className="py-2 text-right font-medium">Income</th>
                  <th className="py-2 text-right font-medium">Fees</th>
                  <th className="py-2 text-right font-medium">Investment change</th>
                  <th className="py-2 text-right font-medium">Ending</th>
                </tr>
              </thead>
              <tbody>
                {c.lines.map((l) => (
                  <tr key={l.accountId} className="border-b border-border">
                    <td className="py-2 font-medium">{l.accountName}</td>
                    <td className="tabular py-2 text-right">{formatCurrency(l.beginningValue)}</td>
                    <td className="tabular py-2 text-right">{formatCurrency(l.netContributions)}</td>
                    <td className="tabular py-2 text-right">{formatCurrency(l.income)}</td>
                    <td className="tabular py-2 text-right">{formatCurrency(l.fees)}</td>
                    <td className="tabular py-2 text-right">{formatCurrency(l.investmentChange)}</td>
                    <td className="tabular py-2 text-right font-semibold">{formatCurrency(l.endingValue)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="tabular py-2 text-right">{formatCurrency(c.totals.beginningValue)}</td>
                  <td className="tabular py-2 text-right">{formatCurrency(c.totals.netContributions)}</td>
                  <td className="tabular py-2 text-right">{formatCurrency(c.totals.income)}</td>
                  <td className="tabular py-2 text-right">{formatCurrency(c.totals.fees)}</td>
                  <td className="tabular py-2 text-right">{formatCurrency(c.totals.investmentChange)}</td>
                  <td className="tabular py-2 text-right">{formatCurrency(c.totals.endingValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Investment change includes market appreciation and reinvested income. Values are as of the last business day of the period.
          </p>
        </div>
      );
    case "form1099":
      return (
        <div className="max-w-lg">
          <Row label="1a  Total ordinary dividends" value={formatCurrency(c.ordinaryDividends)} strong />
          <Row label="Interest income (1099-INT box 1)" value={formatCurrency(c.interestIncome)} />
          <Row label="Gross proceeds (1099-B)" value={formatCurrency(c.grossProceeds)} />
          <p className="mt-4 text-[11.5px] text-muted-foreground">This is a synthetic tax form for demonstration only and must not be used to file a return.</p>
        </div>
      );
    case "form5498":
      return (
        <div className="max-w-lg">
          <p className="mb-2 text-[13px]">
            {ACCOUNT_TYPE_LABELS[c.accountType]} · tax year {doc.taxYear}
          </p>
          <Row label="1  IRA contributions" value={formatCurrency(c.contributions)} />
          <Row label="2  Rollover contributions" value={formatCurrency(c.rolloverContributions)} />
          <Row label="5  Fair market value of account (Dec 31)" value={formatCurrency(c.fairMarketValue)} strong />
          <Row label="10  Roth IRA contributions" value={formatCurrency(c.rothContributions)} />
          <p className="mt-4 text-[11.5px] text-muted-foreground">
            Contributions include amounts made through the following April filing deadline for this tax year. This is a synthetic tax form for demonstration
            only.
          </p>
        </div>
      );
    case "confirmation":
      return c.trade ? (
        <div className="max-w-lg">
          <Row label="Action" value={ACTIVITY_TYPE_LABELS[c.trade.type]} strong />
          <Row label="Security" value={`${c.trade.symbol ?? ""} — ${c.trade.description.replace(/^(Bought|Sold) /, "")}`} />
          <Row label="Quantity" value={c.trade.quantity !== null ? formatQuantity(Math.abs(c.trade.quantity)) : "—"} />
          <Row label="Price" value={c.trade.price !== null ? formatCurrency(c.trade.price) : "—"} />
          <Row label="Trade date" value={formatDate(c.trade.tradeDate)} />
          <Row label="Settlement date" value={formatDate(c.trade.settleDate)} />
          <Row label="Net amount" value={formatCurrency(Math.abs(c.trade.amount))} strong />
          <Row label="Reference" value={c.trade.id} />
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Trade details are no longer available.</p>
      );
    case "letter":
      return (
        <div className="max-w-2xl space-y-3 text-[13.5px] leading-relaxed">
          <p>Dear {doc.household.clients.join(" and ")},</p>
          {c.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="pt-2">Sincerely,</p>
          <p className="font-serif text-[15px] font-semibold">Edward Jones</p>
        </div>
      );
  }
}

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const context = await getPageContext();
  if (!context) notFound();
  const { id } = await params;
  const doc = await getDocument(context.householdId, id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: doc.title }]}
        title={doc.title}
        description={`${DOCUMENT_CATEGORY_LABELS[doc.category]} · issued ${formatDate(doc.issuedOn)}`}
        actions={<PrintButton />}
      />
      <article className="mx-auto max-w-4xl rounded-md border border-border bg-white shadow-sm print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-4 border-forest-800 px-8 py-6">
          <div>
            <p className="font-serif text-[22px] font-semibold text-forest-900">Edward Jones</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gold-600">{DOCUMENT_CATEGORY_LABELS[doc.category]}</p>
          </div>
          <div className="text-right text-[12.5px] leading-relaxed">
            <p className="font-medium">{doc.household.clients.join(" & ")}</p>
            <p className="text-muted-foreground">{doc.household.addressLine}</p>
            <p className="text-muted-foreground">{doc.household.cityLine}</p>
          </div>
        </header>
        <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border bg-cream-50 px-8 py-3 text-[12px] text-muted-foreground">
          {doc.periodStart && doc.periodEnd && (
            <span>
              Period: {formatDate(doc.periodStart)} – {formatDate(doc.periodEnd)}
            </span>
          )}
          {doc.taxYear && <span>Tax year: {doc.taxYear}</span>}
          {doc.accountName && <span>Account: {doc.accountName}</span>}
          <span>Issued: {formatDate(doc.issuedOn)}</span>
          <span>{doc.id}</span>
        </div>
        <div className="px-8 py-6">
          <Body doc={doc} />
        </div>
        <footer className="border-t border-border px-8 py-4 text-[11px] text-muted-foreground">
          Demonstration document generated from synthetic data. Not an official record.
        </footer>
      </article>
    </div>
  );
}
