import { json, route } from "@/lib/server/http";
import { getHousehold } from "@/lib/server/services/household";
import { getPreferences } from "@/lib/server/services/profile";
import { listBankAccounts } from "@/lib/server/services/transfers";
import { requireClient } from "@/lib/server/session";

export const GET = route(async (request: Request) => {
  const { householdId, viewer } = await requireClient(request);
  const [household, preferences, banks] = await Promise.all([
    getHousehold(householdId),
    getPreferences(householdId),
    listBankAccounts(householdId),
  ]);
  return json({ viewer, household, preferences, banks });
});
