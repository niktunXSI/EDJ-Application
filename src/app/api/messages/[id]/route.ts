import { json, readJson, route } from "@/lib/server/http";
import { getThread, replyToThread } from "@/lib/server/services/messages";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { householdId } = await requireClient(request);
  const { id } = await params;
  return json(await getThread(householdId, id));
});

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { householdId, viewer } = await requireClient(request);
  const { id } = await params;
  return json(await replyToThread(householdId, id, viewer.name, await readJson(request)), 201);
});
