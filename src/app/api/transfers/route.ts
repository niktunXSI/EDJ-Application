import { json, readJson, route } from "@/lib/server/http";
import { createMovement, listBankAccounts, listMovements } from "@/lib/server/services/transfers";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  const [movements, banks] = await Promise.all([listMovements(householdId), listBankAccounts(householdId)]);
  return json({ ...movements, banks });
});

export const POST = route(async (request: Request) => {
  const { householdId, viewer } = await requireClient(request);
  return json(await createMovement(householdId, viewer.name, await readJson(request)), 201);
});
