import { NextResponse } from "next/server";
import { aiErrorInfo } from "@/lib/ai/errors";

/** Turns anything thrown while handling an AI request into a consistent JSON error response. */
export function aiErrorResponse(err: unknown): NextResponse {
  const info = aiErrorInfo(err);
  return NextResponse.json(
    { error: info.message },
    {
      status: info.status,
      headers: info.retryAfterSeconds ? { "Retry-After": String(info.retryAfterSeconds) } : undefined,
    }
  );
}
