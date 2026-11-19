import { json, route } from "@/lib/server/http";
import { listDocuments, parseDocumentQuery } from "@/lib/server/services/documents";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json(await listDocuments(householdId, parseDocumentQuery(new URL(request.url).searchParams)));
});
