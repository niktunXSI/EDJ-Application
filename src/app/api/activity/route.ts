import { json, route } from "@/lib/server/http";
import { listActivity, parseActivityQuery } from "@/lib/server/services/activity";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json(await listActivity(householdId, parseActivityQuery(new URL(request.url).searchParams)));
});
