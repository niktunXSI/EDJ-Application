import { json, route } from "@/lib/server/http";
import { getHousehold } from "@/lib/server/services/household";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json(await getHousehold(householdId));
});
