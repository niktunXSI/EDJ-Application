import { beforeAll, describe, expect, it } from "vitest";
import { sql, withTransaction } from "@/lib/server/db";
import { resetDemoData } from "@/lib/server/seed";

const TODAY = "2026-11-19";

describe("demo seed", () => {
  beforeAll(async () => {
    await withTransaction((tx) => resetDemoData(tx, TODAY));
  });

  it("creates the household with five accounts", async () => {
    const accounts = await sql<{ id: string }>("select id from accounts where household_id = 'HH-3113' order by sort_order");
    expect(accounts.map((a) => a.id)).toEqual(["ACC-4471", "ACC-2208", "ACC-2215", "ACC-3092", "ACC-5530"]);
  });

  it("ends each value history at today's market value", async () => {
    const rows = await sql<{ account_id: string; as_of: string; market_value: number }>(
      "select distinct on (account_id) account_id, as_of, market_value from account_values order by account_id, as_of desc",
    );
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row.as_of).toBe(TODAY);
    const joint = rows.find((r) => r.account_id === "ACC-4471")!;
    expect(joint.market_value).toBeGreaterThan(180_000);
    expect(joint.market_value).toBeLessThan(195_000);
  });

  it("records IRA contributions with their tax year", async () => {
    const rows = await sql<{ account_id: string; tax_year: number; total: number }>(
      `select account_id, tax_year, sum(amount)::float as total from transactions
        where activity_type = 'contribution' and account_id in ('ACC-2208', 'ACC-2215', 'ACC-3092')
        group by account_id, tax_year order by account_id, tax_year`,
    );
    expect(rows).toEqual([
      { account_id: "ACC-2208", tax_year: 2026, total: 1000 },
      { account_id: "ACC-2215", tax_year: 2025, total: 8000 },
      { account_id: "ACC-2215", tax_year: 2026, total: 5500 },
      { account_id: "ACC-3092", tax_year: 2025, total: 7000 },
      { account_id: "ACC-3092", tax_year: 2026, total: 5500 },
    ]);
  });

  it("only issues documents dated on or before today", async () => {
    const [{ future }] = await sql<{ future: number }>("select count(*)::int as future from documents where issued_on > $1", [TODAY]);
    expect(future).toBe(0);
    const [{ count }] = await sql<{ count: number }>("select count(*)::int as count from documents");
    expect(count).toBeGreaterThan(20);
  });
});
