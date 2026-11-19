import { json, route } from "@/lib/server/http";
import { getDocument } from "@/lib/server/services/documents";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { householdId } = await requireClient(request);
  const { id } = await params;
  return json(await getDocument(householdId, id));
});
