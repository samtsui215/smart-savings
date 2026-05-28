import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Centralised error handler for API routes. Mapping rules:
 *   - ZodError              -> 400 with field-level details
 *   - Error w/ .status      -> that status, with the message
 *   - Known business errors -> 409 (data inconsistency, insufficient funds)
 *   - Everything else       -> 500 (logged, message generic)
 */
export function apiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "validation_error", issues: err.flatten() },
      { status: 400 },
    );
  }

  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    if (typeof status === "number") {
      return NextResponse.json({ error: err.message }, { status });
    }
    if (/insufficient funds/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (/data inconsistency/i.test(err.message)) {
      // The invariant failed — this is a server-side bug, not client error.
      console.error("INVARIANT_VIOLATION:", err);
      return NextResponse.json({ error: "Server consistency error" }, { status: 500 });
    }
    // Unmapped error → log the detail server-side, but never return the raw
    // message to the client in production (it can leak stack/internal info).
    console.error(err);
    const message =
      process.env.NODE_ENV === "production" ? "Internal server error" : err.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.error("Unknown error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
