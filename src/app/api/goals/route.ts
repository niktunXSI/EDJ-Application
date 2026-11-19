import { json, route } from "@/lib/server/http";
import { listGoals } from "@/lib/server/services/goals";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json({ goals: await listGoals(householdId) });
});
