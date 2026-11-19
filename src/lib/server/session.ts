import "server-only";
import { headers } from "next/headers";
import { getIdentity, type VerifiedIdentity } from "../../../cursor/identity";
import { REQUEST_HEADER } from "@/lib/request-header";
import { config, DEMO_HOUSEHOLD_ID } from "./config";
import { ApiError } from "./http";

export interface Viewer {
  name: string;
  email: string;
  kind: "person" | "key";
  simulated: boolean;
}

export interface ClientContext {
  householdId: string;
  viewer: Viewer;
}

function toViewer(identity: VerifiedIdentity): Viewer {
  return {
    name: identity.name || identity.email || (identity.kind === "key" ? "API key" : "Signed-in viewer"),
    email: identity.email,
    kind: identity.kind,
    simulated: identity.simulated,
  };
}

/**
 * Every signed-in viewer (a person, or an API key the hosting gate admitted) sees the same synthetic
 * demo household. All data access is still scoped by household id, so a real deployment only has to
 * map the verified viewer to their own household here.
 */
function contextFor(identity: VerifiedIdentity): ClientContext {
  return { householdId: DEMO_HOUSEHOLD_ID, viewer: toViewer(identity) };
}

/** For server components. Null when the hosting gate did not supply a verified viewer. */
export async function getPageContext(): Promise<ClientContext | null> {
  const identity = await getIdentity(await headers());
  return identity.verified ? contextFor(identity) : null;
}

/**
 * Guards API route handlers. Requires a verified viewer, and for state changes a same-origin request
 * carrying the portal's custom header, which a cross-site page cannot send without a CORS preflight
 * this app never approves.
 */
export async function requireClient(request: Request): Promise<ClientContext> {
  const identity = await getIdentity(request);
  if (!identity.verified) {
    throw new ApiError(401, "unauthenticated", "Sign in to view your accounts.");
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    assertSameOrigin(request);
    if (request.headers.get(REQUEST_HEADER) !== "1") {
      throw new ApiError(403, "csrf_failed", "The request could not be verified. Reload the page and try again.");
    }
  }
  return contextFor(identity);
}

/**
 * Rejects cross-site state changes. Browsers send Sec-Fetch-Site, which page scripts cannot set, so it
 * is checked first. Behind a hosting proxy the Host header can differ from the browser's address, so
 * the Origin fallback accepts any forwarded host name.
 */
export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) {
    if (fetchSite !== "same-origin" && fetchSite !== "none") {
      throw new ApiError(403, "cross_origin", "Cross-site requests are not allowed.");
    }
    return;
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set<string>();
  for (const name of ["host", "x-forwarded-host", "x-original-host"]) {
    for (const value of request.headers.get(name)?.split(",") ?? []) {
      if (value.trim()) allowed.add(value.trim().toLowerCase());
    }
  }
  if (config.appBaseUrl) allowed.add(new URL(config.appBaseUrl).host.toLowerCase());
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new ApiError(403, "cross_origin", "Cross-origin requests are not allowed.");
  }
  if (!allowed.has(originHost)) {
    throw new ApiError(403, "cross_origin", "Cross-origin requests are not allowed.");
  }
}
