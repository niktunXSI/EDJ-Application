import { json, readJson, route } from "@/lib/server/http";
import { createThread, listThreads } from "@/lib/server/services/messages";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json({ threads: await listThreads(householdId) });
});

export const POST = route(async (request: Request) => {
  const { householdId, viewer } = await requireClient(request);
  return json(await createThread(householdId, viewer.name, await readJson(request)), 201);
});
