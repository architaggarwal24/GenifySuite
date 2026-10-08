import { NextResponse } from "next/server";

export function tooManyRequests(retryAfterSeconds: number, message?: string): NextResponse {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const wait = retryAfterSeconds < 90 ? `${retryAfterSeconds} seconds` : `${minutes} minutes`;
  return NextResponse.json(
    { error: message ?? `Too many attempts. Please try again in about ${wait}.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}
