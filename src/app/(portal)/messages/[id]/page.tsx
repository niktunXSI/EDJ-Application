import { notFound } from "next/navigation";
import { MessageComposer } from "@/components/portal/message-composer";
import { PageHeader, Panel } from "@/components/app/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateTime, initials } from "@/lib/format";
import { ApiError } from "@/lib/server/http";
import { getThread } from "@/lib/server/services/messages";
import { getPageContext } from "@/lib/server/session";
import { cn } from "@/lib/utils";

export default async function ThreadPage({ params }: PageProps<"/messages/[id]">) {
  const context = await getPageContext();
  if (!context) notFound();
  const { id } = await params;
  const thread = await getThread(context.householdId, id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader breadcrumbs={[{ label: "Messages", href: "/messages" }, { label: thread.subject }]} title={thread.subject} />
      <ol className="space-y-4">
        {thread.messages.map((m) => {
          const mine = m.sender === "client";
          return (
            <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <Avatar className="size-9">
                <AvatarFallback className={cn("text-[12px] font-semibold", mine ? "bg-gold-100 text-[#6b4f12]" : "bg-forest-800 text-white")}>
                  {initials(m.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className={cn("max-w-[85%] rounded-lg border px-4 py-3", mine ? "border-gold-100 bg-[#fbf7ee]" : "border-border bg-card")}>
                <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-semibold text-foreground">{m.authorName}</span>
                  <span className="text-muted-foreground">{formatDateTime(m.sentAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <Panel className="mt-6" bodyClassName="p-5">
        <MessageComposer threadId={thread.id} />
      </Panel>
    </div>
  );
}
