import { vi } from "vitest";
import { sendEmail } from "@/lib/email";

export function jsonRequest(
  url: string,
  body: unknown,
  init: { method?: string; headers?: Record<string, string> } = {}
): Request {
  return new Request(url, {
    method: init.method ?? "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Header that makes the request look like it came from this address, for the per-IP rate limits. */
export const fromIp = (address: string) => ({ "x-forwarded-for": address });

export interface SentEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const sentEmails = (): SentEmail[] => vi.mocked(sendEmail).mock.calls.map((call) => call[0] as SentEmail);

/** The first http(s) link in an email's plain-text body. */
export const linkIn = (email: SentEmail): string => /https?:\/\/\S+/.exec(email.text)?.[0] ?? "";

export const tokenIn = (email: SentEmail): string => new URL(linkIn(email)).searchParams.get("token") ?? "";
