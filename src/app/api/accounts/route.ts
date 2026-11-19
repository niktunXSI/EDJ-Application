import { json, route } from "@/lib/server/http";
import { listAccounts } from "@/lib/server/services/portfolio";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId } = await requireClient(request);
  return json({ accounts: await listAccounts(householdId) });
});
