import { json, readJson, route } from "@/lib/server/http";
import { updateGoal } from "@/lib/server/services/goals";
import { requireClient } from "@/lib/server/session";

export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { householdId } = await requireClient(request);
  const { id } = await params;
  return json(await updateGoal(householdId, id, await readJson(request)));
});
