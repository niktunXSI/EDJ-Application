import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} was not found.`);
export const unprocessable = (code: string, message: string, details?: unknown) => new ApiError(422, code, message, details);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);

export function json<T>(body: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(body, {
    ...responseInit,
    headers: { "Cache-Control": "no-store", ...(responseInit?.headers ?? {}) },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      error.status,
    );
  }
  if (error instanceof ZodError) {
    return json(
      {
        error: {
          code: "validation_failed",
          message: "Some fields need attention.",
          details: { fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
        },
      },
      422,
    );
  }
  console.error("[api] unhandled error:", error instanceof Error ? error.message : "unknown error");
  return json({ error: { code: "internal_error", message: "Something went wrong on our side. Please try again." } }, 500);
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Send the request body as application/json.");
  }
  const text = await request.text();
  if (text.length > 64_000) throw new ApiError(413, "payload_too_large", "The request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "bad_request", "The request body is not valid JSON.");
  }
}

/** Wraps a route handler so thrown ApiError / ZodError values become consistent JSON errors. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
