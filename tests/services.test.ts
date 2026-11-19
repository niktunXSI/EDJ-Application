import { beforeEach, describe, expect, it } from "vitest";
import { addDays, todayIso } from "@/lib/dates";
import { withTransaction } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { resetDemoData } from "@/lib/server/seed";
import { exportActivityCsv, listActivity } from "@/lib/server/services/activity";
import { getDocument, listDocuments } from "@/lib/server/services/documents";
import { listGoals, updateGoal } from "@/lib/server/services/goals";
import { countUnreadMessages, createThread, getThread, listThreads, replyToThread } from "@/lib/server/services/messages";
import { getOverview } from "@/lib/server/services/overview";
import { getAccount } from "@/lib/server/services/portfolio";
import { getPreferences, updatePreferences } from "@/lib/server/services/profile";
import { cancelMovement, createMovement, listMovements } from "@/lib/server/services/transfers";

const HH = "HH-3113";

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("Expected the call to fail");
}

beforeEach(async () => {
  await withTransaction((tx) => resetDemoData(tx));
});

describe("overview and accounts", () => {
  it("totals the household across every account", async () => {
    const overview = await getOverview(HH);
    expect(overview.accounts).toHaveLength(5);
    const sum = overview.accounts.reduce((s, a) => s + a.marketValue, 0);
    expect(overview.totalValue).toBeCloseTo(sum, 1);
    expect(overview.totalValue).toBeGreaterThan(700_000);
    expect(overview.unreadMessages).toBeGreaterThan(0);
  });

  it("masks account numbers and keeps holdings consistent with market value", async () => {
    const account = await getAccount(HH, "ACC-2215");
    expect(account.maskedNumber).toBe("••••2215");
    const invested = account.holdings.reduce((s, h) => s + h.marketValue, 0);
    expect(invested + account.cashBalance).toBeCloseTo(account.marketValue, 0);
  });

  it("returns 404 for an account outside the household", async () => {
    const error = await rejection(getAccount("HH-0000", "ACC-2215"));
    expect(error.status).toBe(404);
  });
});

describe("activity", () => {
  it("filters by account and type", async () => {
    const page = await listActivity(HH, { range: "all", accountId: "ACC-2215", type: "contribution", limit: 500, offset: 0 });
    expect(page.total).toBeGreaterThan(10);
    expect(page.items.every((i) => i.accountId === "ACC-2215" && i.type === "contribution")).toBe(true);
    expect(page.outflows).toBe(0);
  });

  it("searches descriptions and symbols", async () => {
    const page = await listActivity(HH, { range: "all", q: "rollover", limit: 50, offset: 0 });
    expect(page.items.some((i) => i.type === "rollover")).toBe(true);
  });

  it("exports CSV with a header and neutralises formula cells", async () => {
    const csv = await exportActivityCsv(HH, { range: "90d" });
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Trade date,Settle date,Account,Activity,Description,Symbol,Quantity,Price,Amount,Tax year");
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.slice(1).every((l) => !/(^|,)[=+@]/.test(l))).toBe(true);
  });
});

describe("transfers", () => {
  const tomorrow = () => addDays(todayIso(), 1);

  it("schedules a deposit and lists it as upcoming", async () => {
    const movement = await createMovement(HH, "Simran Kaur", {
      kind: "deposit",
      bankAccountId: "BANK-6612",
      toAccountId: "ACC-4471",
      amount: 2500,
      frequency: "once",
      scheduledFor: tomorrow(),
    });
    expect(movement.status).toBe("scheduled");
    expect(movement.fromLabel).toContain("Lakeside");
    const { upcoming } = await listMovements(HH);
    expect(upcoming.map((m) => m.id)).toContain(movement.id);
  });

  it("marks a transfer dated today as processing", async () => {
    const movement = await createMovement(HH, "Simran Kaur", {
      kind: "internal",
      fromAccountId: "ACC-4471",
      toAccountId: "ACC-5530",
      amount: 100,
      scheduledFor: todayIso(),
    });
    expect(movement.status).toBe("processing");
    expect((await rejection(cancelMovement(HH, movement.id))).code).toBe("not_cancellable");
  });

  it("refuses online withdrawals from an IRA", async () => {
    const error = await rejection(
      createMovement(HH, "Simran Kaur", { kind: "withdrawal", fromAccountId: "ACC-2208", bankAccountId: "BANK-6612", amount: 500, scheduledFor: tomorrow() }),
    );
    expect(error.status).toBe(422);
    expect(error.message).toMatch(/branch team/);
  });

  it("refuses one-time transfers above the available cash", async () => {
    const error = await rejection(
      createMovement(HH, "Simran Kaur", { kind: "internal", fromAccountId: "ACC-4471", toAccountId: "ACC-2215", amount: 200_000, scheduledFor: tomorrow() }),
    );
    expect(error.status).toBe(422);
  });

  it("refuses past dates, the same account twice, and accounts from another household", async () => {
    expect((await rejection(createMovement(HH, "x", { kind: "internal", fromAccountId: "ACC-4471", toAccountId: "ACC-5530", amount: 10, scheduledFor: addDays(todayIso(), -1) }))).status).toBe(422);
    expect((await rejection(createMovement(HH, "x", { kind: "internal", fromAccountId: "ACC-4471", toAccountId: "ACC-4471", amount: 10, scheduledFor: tomorrow() }))).status).toBe(422);
    expect((await rejection(createMovement("HH-0000", "x", { kind: "internal", fromAccountId: "ACC-4471", toAccountId: "ACC-5530", amount: 10, scheduledFor: tomorrow() }))).status).toBe(422);
  });

  it("cancels a scheduled transfer", async () => {
    const { upcoming } = await listMovements(HH);
    const scheduled = upcoming.find((m) => m.status === "scheduled")!;
    const cancelled = await cancelMovement(HH, scheduled.id);
    expect(cancelled.status).toBe("cancelled");
    expect((await rejection(cancelMovement("HH-0000", scheduled.id))).status).toBe(404);
  });
});

describe("documents", () => {
  it("builds Form 5498 Roth contributions from the tax year, including prior-year contributions", async () => {
    const { items } = await listDocuments(HH, { category: "tax" });
    const form = items.find((d) => d.accountId === "ACC-2215")!;
    const detail = await getDocument(HH, form.id);
    expect(detail.content.kind).toBe("form5498");
    if (detail.content.kind === "form5498") {
      expect(detail.content.rothContributions).toBe(8000);
      expect(detail.content.contributions).toBe(0);
    }
  });

  it("marks a document viewed when opened", async () => {
    const { items } = await listDocuments(HH);
    const unviewed = items.find((d) => !d.viewed)!;
    await getDocument(HH, unviewed.id);
    const after = await listDocuments(HH);
    expect(after.items.find((d) => d.id === unviewed.id)!.viewed).toBe(true);
  });

  it("renders a statement whose lines add up", async () => {
    const { items } = await listDocuments(HH, { category: "statement" });
    const detail = await getDocument(HH, items[0].id);
    if (detail.content.kind !== "statement") throw new Error("expected a statement");
    for (const line of detail.content.lines) {
      expect(line.beginningValue + line.netContributions + line.fees + line.investmentChange).toBeCloseTo(line.endingValue, 1);
    }
  });
});

describe("goals", () => {
  it("raises the projection when monthly savings increase", async () => {
    const [before] = await listGoals(HH);
    const after = await updateGoal(HH, before.id, { monthlyContribution: before.monthlyContribution + 1000 });
    expect(after.projectedValue).toBeGreaterThan(before.projectedValue);
  });

  it("rejects target dates less than a month away and unknown fields", async () => {
    const [goal] = await listGoals(HH);
    expect((await rejection(updateGoal(HH, goal.id, { targetDate: addDays(todayIso(), 5) }))).status).toBe(422);
    await expect(updateGoal(HH, goal.id, { assumedReturn: 0.2 })).rejects.toThrow();
  });
});

describe("messages", () => {
  it("marks branch messages read when a conversation is opened", async () => {
    const unread = await countUnreadMessages(HH);
    expect(unread).toBeGreaterThan(0);
    const [latest] = await listThreads(HH);
    await getThread(HH, latest.id);
    expect(await countUnreadMessages(HH)).toBeLessThan(unread);
  });

  it("creates a conversation and replies to it", async () => {
    const thread = await createThread(HH, "Simran Kaur", { subject: "Question", body: "Hello" });
    expect(thread.messages).toHaveLength(1);
    const replied = await replyToThread(HH, thread.id, "Simran Kaur", { body: "One more thing" });
    expect(replied.messages.map((m) => m.body)).toEqual(["Hello", "One more thing"]);
    expect((await rejection(replyToThread("HH-0000", thread.id, "x", { body: "hi" }))).status).toBe(404);
  });
});

describe("preferences", () => {
  it("updates one alert channel without touching the others", async () => {
    const before = await getPreferences(HH);
    const after = await updatePreferences(HH, { alerts: { messages: { text: !before.alerts.messages.text } } });
    expect(after.alerts.messages.text).toBe(!before.alerts.messages.text);
    expect(after.alerts.messages.email).toBe(before.alerts.messages.email);
    expect(after.paperlessStatements).toBe(before.paperlessStatements);
  });

  it("rejects unknown preference keys", async () => {
    await expect(updatePreferences(HH, { marketing: true })).rejects.toThrow();
  });
});
