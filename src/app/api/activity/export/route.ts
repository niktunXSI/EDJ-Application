import { todayIso } from "@/lib/dates";
import { route } from "@/lib/server/http";
import { exportActivityCsv, parseActivityQuery } from "@/lib/server/services/activity";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  const csv = await exportActivityCsv(householdId, parseActivityQuery(new URL(request.url).searchParams));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="account-activity-${todayIso()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
