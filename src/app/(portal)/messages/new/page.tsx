import { notFound } from "next/navigation";
import { MessageComposer } from "@/components/portal/message-composer";
import { PageHeader, Panel } from "@/components/app/page-header";
import { getHousehold } from "@/lib/server/services/household";
import { getPageContext } from "@/lib/server/session";

export const metadata = { title: "New message" };

export default async function NewMessagePage({ searchParams }: PageProps<"/messages/new">) {
  const context = await getPageContext();
  if (!context) notFound();
  const { subject } = await searchParams;
  const household = await getHousehold(context.householdId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Messages", href: "/messages" }, { label: "New message" }]}
        title="New message"
        description={`To ${household.advisor.name} and the ${household.advisor.branch} team.`}
      />
      <Panel bodyClassName="p-6">
        <MessageComposer defaultSubject={typeof subject === "string" ? subject.slice(0, 120) : ""} />
      </Panel>
      <p className="mt-4 text-[12px] text-muted-foreground">
        For your security, never include full account numbers, Social Security numbers, or passwords in a message. Trade and transfer requests sent by message are
        not processed until your branch confirms them with you.
      </p>
    </div>
  );
}
