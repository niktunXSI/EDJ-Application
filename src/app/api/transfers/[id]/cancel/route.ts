import { json, route } from "@/lib/server/http";
import { cancelMovement } from "@/lib/server/services/transfers";
import { requireClient } from "@/lib/server/session";

export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { householdId } = await requireClient(request);
  const { id } = await params;
  return json(await cancelMovement(householdId, id));
});
