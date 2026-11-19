import { json, readJson, route } from "@/lib/server/http";
import { updatePreferences } from "@/lib/server/services/profile";
import { requireClient } from "@/lib/server/session";

export const PATCH = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json(await updatePreferences(householdId, await readJson(request)));
});
