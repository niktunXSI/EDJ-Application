import "server-only";
import type { Overview } from "@/lib/types";
import { recentActivity } from "./activity";
import { countUnviewedDocuments } from "./documents";
import { listGoals } from "./goals";
import { getHousehold } from "./household";
import { getIraContributions } from "./ira-contributions";
import { countUnreadMessages } from "./messages";
import { allocationOf, listAccountDetails } from "./portfolio";
import { listMovements } from "./transfers";

export async function getOverview(householdId: string): Promise<Overview> {
  const [household, details, activity, goals, movements, iraContributions, unreadMessages, newDocuments] = await Promise.all([
    getHousehold(householdId),
    listAccountDetails(householdId),
    recentActivity(householdId),
    listGoals(householdId),
    listMovements(householdId),
    getIraContributions(householdId),
    countUnreadMessages(householdId),
    countUnviewedDocuments(householdId),
  ]);
  const totalValue = Math.round(details.reduce((sum, a) => sum + a.marketValue, 0) * 100) / 100;
  const dayChange = Math.round(details.reduce((sum, a) => sum + a.dayChange, 0) * 100) / 100;
  return {
    household,
    totalValue,
    dayChange,
    dayChangePercent: totalValue - dayChange > 0 ? dayChange / (totalValue - dayChange) : 0,
    accounts: details.map(({ holdings: _h, allocation: _a, ...summary }) => summary),
    allocation: allocationOf(details),
    recentActivity: activity,
    goals,
    upcomingMovements: movements.upcoming.slice(0, 4),
    iraContributions,
    unreadMessages,
    newDocuments,
  };
}
