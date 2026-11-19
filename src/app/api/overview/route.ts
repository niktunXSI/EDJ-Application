import { json, route } from "@/lib/server/http";
import { getOverview } from "@/lib/server/services/overview";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json(await getOverview(householdId));
});
