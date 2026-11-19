import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { addDays, todayIso } from "@/lib/dates";
import { withTransaction } from "@/lib/server/db";
import { resetDemoData } from "@/lib/server/seed";
import { REQUEST_HEADER } from "@/lib/request-header";
import { GET as getAccounts } from "@/app/api/accounts/route";
import { GET as getHealth } from "@/app/api/health/route";
import { POST as postTransfer } from "@/app/api/transfers/route";

const BASE = "http://localhost:4318";

function transferRequest(headers: Record<string, string>, body: unknown = validTransfer()) {
  return new Request(`${BASE}/api/transfers`, { method: "POST", headers: { host: "localhost:4318", ...headers }, body: JSON.stringify(body) });
}

function validTransfer() {
  return { kind: "deposit", bankAccountId: "BANK-6612", toAccountId: "ACC-4471", amount: 250, scheduledFor: addDays(todayIso(), 2) };
}

beforeAll(async () => {
  await withTransaction((tx) => resetDemoData(tx));
});

afterEach(() => {
  process.env.CURSOR_APP_ID = "";
});

describe("API routes", () => {
  it("reports health without signing in", async () => {
    process.env.CURSOR_APP_ID = "test-app";
    const res = await getHealth();
    expect(res.status).toBe(200);
  });

  it("returns 401 on a deployed host when the identity header is missing", async () => {
    process.env.CURSOR_APP_ID = "test-app";
    const res = await getAccounts(new Request(`${BASE}/api/accounts`));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  it("serves the simulated viewer on a local dev server", async () => {
    const res = await getAccounts(new Request(`${BASE}/api/accounts`));
    expect(res.status).toBe(200);
    expect((await res.json()).accounts).toHaveLength(5);
  });

  it("rejects state changes without the portal request header", async () => {
    const res = await postTransfer(transferRequest({ "content-type": "application/json" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("csrf_failed");
  });

  it("rejects cross-site state changes", async () => {
    const crossSite = await postTransfer(transferRequest({ "content-type": "application/json", [REQUEST_HEADER]: "1", "sec-fetch-site": "cross-site" }));
    expect(crossSite.status).toBe(403);
    const otherOrigin = await postTransfer(transferRequest({ "content-type": "application/json", [REQUEST_HEADER]: "1", origin: "https://evil.example" }));
    expect(otherOrigin.status).toBe(403);
  });

  it("requires a JSON body", async () => {
    const res = await postTransfer(transferRequest({ "content-type": "text/plain", [REQUEST_HEADER]: "1" }));
    expect(res.status).toBe(415);
  });

  it("creates a transfer from the same origin and reports validation errors by field", async () => {
    const ok = await postTransfer(transferRequest({ "content-type": "application/json", [REQUEST_HEADER]: "1", origin: BASE, "sec-fetch-site": "same-origin" }));
    expect(ok.status).toBe(201);

    const bad = await postTransfer(transferRequest({ "content-type": "application/json", [REQUEST_HEADER]: "1" }, { ...validTransfer(), amount: -5 }));
    expect(bad.status).toBe(422);
    const body = await bad.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details.fields[0].path).toBe("amount");
  });
});
