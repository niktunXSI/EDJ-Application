import "server-only";

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export const config = {
  /** Seed the synthetic demo household automatically when the database is empty. */
  get seedOnEmpty() {
    return flag("SEED_ON_EMPTY", true);
  },
  get appBaseUrl() {
    return process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") || "";
  },
};

/** The synthetic household every signed-in viewer sees in this demo. */
export const DEMO_HOUSEHOLD_ID = "HH-3113";

/** Largest single movement the portal accepts online; larger amounts go through the branch. */
export const MAX_ONLINE_MOVEMENT = 250_000;
/** Open (scheduled or processing) movements a household may have at once. */
export const MAX_OPEN_MOVEMENTS = 25;
export const MAX_THREADS = 200;
export const MAX_MESSAGES_PER_THREAD = 100;
