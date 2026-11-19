import { ShieldCheck } from "lucide-react";
import { PortalHeader } from "@/components/portal/portal-header";
import { getHousehold } from "@/lib/server/services/household";
import { countUnreadMessages } from "@/lib/server/services/messages";
import { getPageContext } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const context = await getPageContext();
  if (!context) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-100 px-6">
        <div className="max-w-md rounded-md border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-forest-800" />
          <h1 className="font-serif text-2xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            This demo portal is available to signed-in viewers only. Open it from the link you were given and sign in when prompted.
          </p>
        </div>
      </main>
    );
  }

  const [household, unread] = await Promise.all([getHousehold(context.householdId), countUnreadMessages(context.householdId)]);
  const primary = household.clients.find((c) => c.isPrimary) ?? household.clients[0];
  const displayName = primary?.fullName ?? context.viewer.name;

  return (
    <div className="flex min-h-screen flex-col">
      <PortalHeader
        viewerName={displayName}
        householdName={household.name}
        unreadMessages={unread}
        advisorName={household.advisor.name}
      />
      <div className="border-b border-[#e7dcc0] bg-gold-100">
        <p className="mx-auto max-w-[1240px] px-4 py-1.5 text-[12px] text-[#6b5520] sm:px-6">
          <span className="font-semibold">Demo environment.</span> Every client, account, and figure shown is synthetic. Signed in as{" "}
          {context.viewer.email || context.viewer.name}
          {context.viewer.simulated ? " (local preview)" : ""}.
        </p>
      </div>
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border bg-cream-50">
        <div className="mx-auto max-w-[1240px] space-y-2 px-4 py-6 text-[11.5px] leading-relaxed text-muted-foreground sm:px-6">
          <p>
            Investments are not FDIC insured, may lose value, and are not bank guaranteed. Past performance does not guarantee future results.
            Values shown are as of the most recent market close.
          </p>
          <p>This is a demonstration application. It is not connected to any brokerage system and contains no real client information.</p>
        </div>
      </footer>
    </div>
  );
}
