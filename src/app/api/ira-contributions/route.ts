import { json, route } from "@/lib/server/http";
import { getIraContributions } from "@/lib/server/services/ira-contributions";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json(await getIraContributions(householdId));
});
