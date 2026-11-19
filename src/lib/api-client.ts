import { REQUEST_HEADER } from "./request-header";

export interface FieldError {
  path: string;
  message: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields: FieldError[] = [],
  ) {
    super(message);
  }
}

/** Calls a portal API route with JSON in and out and normalised errors. */
export async function apiFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(method !== "GET" ? { "content-type": "application/json", [REQUEST_HEADER]: "1" } : {}),
      },
      body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("We couldn't reach Online Access. Check your connection and try again.", 0, "network_error");
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: { fields?: FieldError[] } } } | null)?.error ?? {};
    const fields = error.details?.fields ?? [];
    throw new ApiClientError(error.message ?? `Request failed (${response.status}).`, response.status, error.code ?? "unknown_error", fields);
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.code === "validation_failed" && error.fields.length ? error.fields.map((f) => f.message).join(" ") : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiClientError)) return {};
  return Object.fromEntries(error.fields.map((f) => [f.path, f.message]));
}
