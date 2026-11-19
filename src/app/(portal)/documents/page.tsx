import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { FilterSelect } from "@/components/portal/filter-select";
import { EmptyState, PageHeader, Panel } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS } from "@/lib/domain";
import { formatDate, pluralize } from "@/lib/format";
import { documentQuerySchema, listDocuments } from "@/lib/server/services/documents";
import { getPreferences } from "@/lib/server/services/profile";
import { getPageContext } from "@/lib/server/session";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const context = await getPageContext();
  if (!context) notFound();
  const sp = await searchParams;
  const pick = (key: string) => (typeof sp[key] === "string" && sp[key] !== "" ? (sp[key] as string) : undefined);
  const parsed = documentQuerySchema.safeParse({ category: pick("category"), year: pick("year") });
  const query = parsed.success ? parsed.data : {};
  const [{ items, years }, preferences] = await Promise.all([listDocuments(context.householdId, query), getPreferences(context.householdId)]);
  const unviewed = items.filter((d) => !d.viewed).length;

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Statements, tax forms, trade confirmations, and letters for your household."
        actions={
          <Badge variant="outline" className="border-forest-800/20 bg-forest-50 text-forest-800">
            Paperless statements {preferences.paperlessStatements ? "on" : "off"}
          </Badge>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <FilterSelect
          param="category"
          label="Document type"
          allLabel="All document types"
          options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABELS[c] }))}
        />
        <FilterSelect param="year" label="Year" allLabel="All years" options={years.map((y) => ({ value: String(y), label: String(y) }))} />
        <p className="text-[12.5px] text-muted-foreground sm:ml-auto">
          {pluralize(items.length, "document")}
          {unviewed > 0 && ` · ${unviewed} new`}
        </p>
      </div>
      <Panel bodyClassName="p-0">
        {items.length === 0 ? (
          <EmptyState icon={<FileText className="size-5" />} title="No documents match these filters" />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((d) => (
              <li key={d.id}>
                <Link href={`/documents/${d.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-cream-50 text-forest-800">
                    <FileText className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[14px] font-medium">
                      <span className="truncate">{d.title}</span>
                      {!d.viewed && <Badge className="h-[18px] bg-forest-800 px-1.5 text-[10.5px]">New</Badge>}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {DOCUMENT_CATEGORY_LABELS[d.category]}
                      {d.accountName ? ` · ${d.accountName}` : " · All accounts"} · {pluralize(d.pageCount, "page")}
                    </p>
                  </div>
                  <span className="tabular whitespace-nowrap text-[12.5px] text-muted-foreground">{formatDate(d.issuedOn)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
