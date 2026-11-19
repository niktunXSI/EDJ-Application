import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, PenSquare } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { formatRelative, pluralize } from "@/lib/format";
import { getHousehold } from "@/lib/server/services/household";
import { listThreads } from "@/lib/server/services/messages";
import { getPageContext } from "@/lib/server/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const context = await getPageContext();
  if (!context) notFound();
  const [threads, household] = await Promise.all([listThreads(context.householdId), getHousehold(context.householdId)]);

  return (
    <div>
      <PageHeader
        title="Messages"
        description={`Secure messages with ${household.advisor.name} and your branch team. Please don't use messages for time-sensitive trade requests.`}
        actions={
          <Button asChild>
            <Link href="/messages/new">
              <PenSquare /> New message
            </Link>
          </Button>
        }
      />
      <Panel bodyClassName="p-0">
        {threads.length === 0 ? (
          <EmptyState icon={<MessageSquare className="size-5" />} title="No messages yet" description="Start a conversation with your branch." />
        ) : (
          <ul className="divide-y divide-border/60">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/messages/${t.id}`} className="flex gap-4 px-5 py-4 hover:bg-muted/40">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", t.unreadCount > 0 ? "bg-forest-700" : "bg-transparent")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={cn("truncate text-[14px]", t.unreadCount > 0 ? "font-semibold" : "font-medium")}>{t.subject}</p>
                      <span className="shrink-0 text-[12px] text-muted-foreground">{formatRelative(t.lastMessageAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      <span className="text-foreground/80">{t.lastAuthor}:</span> {t.preview}
                    </p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {pluralize(t.messageCount, "message")}
                      {t.unreadCount > 0 && ` · ${t.unreadCount} unread`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
