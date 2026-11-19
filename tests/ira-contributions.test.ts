import { beforeEach, describe, expect, it } from "vitest";
import { sql, withTransaction } from "@/lib/server/db";
import { resetDemoData } from "@/lib/server/seed";
import {
  calculateIraRoom,
  contributionDeadline,
  currentContributionYear,
  getIraContributions,
  iraLimitsFor,
  isCatchUpEligible,
} from "@/lib/server/services/ira-contributions";

const HH = "HH-3113";
const TODAY = "2026-11-19";

describe("IRA limit calculation", () => {
  it("uses the $7,500 limit for a member under 50", () => {
    const room = calculateIraRoom({ taxYear: 2026, dateOfBirth: "1979-10-21", contributed: 5500 });
    expect(room.catchUpEligible).toBe(false);
    expect(room.limit).toBe(7500);
    expect(room.remaining).toBe(2000);
    expect(room.excess).toBe(0);
    expect(room.progress).toBeCloseTo(5500 / 7500);
  });

  it("adds the $1,100 catch-up for a member age 50 or older", () => {
    const room = calculateIraRoom({ taxYear: 2026, dateOfBirth: "1975-03-08", contributed: 6500 });
    expect(room.catchUpEligible).toBe(true);
    expect(room.limit).toBe(8600);
    expect(room.baseLimit + room.catchUpAmount).toBe(8600);
    expect(room.remaining).toBe(2100);
  });

  it("counts a member who turns 50 on or before December 31 of the tax year as catch-up eligible", () => {
    expect(isCatchUpEligible("1976-12-31", 2026)).toBe(true);
    expect(isCatchUpEligible("1976-01-01", 2026)).toBe(true);
    expect(isCatchUpEligible("1977-01-01", 2026)).toBe(false);
  });

  it("shows zero remaining and reports the excess when contributions pass the limit", () => {
    const room = calculateIraRoom({ taxYear: 2026, dateOfBirth: "1990-05-01", contributed: 8000.5 });
    expect(room.remaining).toBe(0);
    expect(room.excess).toBe(500.5);
    expect(room.progress).toBe(1);
  });

  it("reports exactly zero remaining at the limit", () => {
    const room = calculateIraRoom({ taxYear: 2026, dateOfBirth: "1990-05-01", contributed: 7500 });
    expect(room.remaining).toBe(0);
    expect(room.excess).toBe(0);
  });

  it("uses the April 15 deadline of the following year and the latest published limits", () => {
    expect(contributionDeadline(2026)).toBe("2027-04-15");
    expect(currentContributionYear("2026-11-19")).toBe(2026);
    expect(iraLimitsFor(2026)).toEqual({ base: 7500, catchUp: 1100 });
    expect(iraLimitsFor(2030)).toEqual({ base: 7500, catchUp: 1100 });
  });
});

describe("household IRA contributions", () => {
  beforeEach(async () => {
    await withTransaction((tx) => resetDemoData(tx, TODAY));
  });

  it("returns a summary for every household member", async () => {
    const { taxYear, deadline, members } = await getIraContributions(HH, 2026);
    expect(taxYear).toBe(2026);
    expect(deadline).toBe("2027-04-15");
    expect(members.map((m) => m.clientName)).toEqual(["Simran Kaur", "Arjun Singh"]);
  });

  it("sums current-year contributions across all of a member's Traditional and Roth IRAs", async () => {
    const { members } = await getIraContributions(HH, 2026);
    const simran = members.find((m) => m.clientId === "CL-1")!;
    expect(simran.accounts.map((a) => [a.id, a.contributed])).toEqual([
      ["ACC-2208", 1000],
      ["ACC-2215", 5500],
    ]);
    expect(simran.contributed).toBe(6500);
    expect(simran.catchUpEligible).toBe(true);
    expect(simran.limit).toBe(8600);
    expect(simran.remaining).toBe(2100);
  });

  it("applies the base limit to a member under 50 and ignores prior-year and 529 contributions", async () => {
    const { members } = await getIraContributions(HH, 2026);
    const arjun = members.find((m) => m.clientId === "CL-2")!;
    expect(arjun.accounts.map((a) => a.id)).toEqual(["ACC-3092"]);
    expect(arjun.contributed).toBe(5500);
    expect(arjun.limit).toBe(7500);
    expect(arjun.remaining).toBe(2000);
  });

  it("reports the excess when a member contributes over the limit", async () => {
    await sql(
      `insert into transactions (id, account_id, trade_date, settle_date, activity_type, description, amount, tax_year)
       values ('TX-TEST-1', 'ACC-3092', '2026-11-18', '2026-11-18', 'contribution', 'Extra contribution', 2500, 2026)`,
    );
    const arjun = (await getIraContributions(HH, 2026)).members.find((m) => m.clientId === "CL-2")!;
    expect(arjun.contributed).toBe(8000);
    expect(arjun.remaining).toBe(0);
    expect(arjun.excess).toBe(500);
  });

  it("gives a member with no IRA a card with the full limit and no accounts", async () => {
    await sql("update accounts set owner_client_id = 'CL-1' where id = 'ACC-3092'");
    const arjun = (await getIraContributions(HH, 2026)).members.find((m) => m.clientId === "CL-2")!;
    expect(arjun.accounts).toEqual([]);
    expect(arjun.contributed).toBe(0);
    expect(arjun.remaining).toBe(7500);
  });

  it("returns no members for another household", async () => {
    expect((await getIraContributions("HH-0000", 2026)).members).toEqual([]);
  });
});
