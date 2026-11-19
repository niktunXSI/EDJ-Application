import { json, route } from "@/lib/server/http";
import { getValueHistory } from "@/lib/server/services/portfolio";
import { requireClient } from "@/lib/server/session";
import { historyRangeSchema } from "@/lib/validation";

export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { householdId } = await requireClient(request);
  const { id } = await params;
  const range = historyRangeSchema.parse(new URL(request.url).searchParams.get("range") ?? undefined);
  return json(await getValueHistory(householdId, range, id));
});
