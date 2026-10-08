import { AiProviderError } from "@/lib/ai/types";

/** The request was refused before any provider work (auth, unknown key, or a usage/rate limit). */
export class AiRequestDenied extends Error {
  status: number;
  retryAfterSeconds?: number;
  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "AiRequestDenied";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The model answered, but not in a shape we can use. Surfaced to the user as a retry-able 502. */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

export interface AiErrorInfo {
  message: string;
  status: number;
  retryAfterSeconds?: number;
}

/** Maps anything thrown while handling an AI request to a user-facing message + HTTP status. */
export function aiErrorInfo(err: unknown): AiErrorInfo {
  if (err instanceof AiRequestDenied) {
    return { message: err.message, status: err.status, retryAfterSeconds: err.retryAfterSeconds };
  }
  if (err instanceof AiOutputError) {
    return { message: err.message, status: 502 };
  }
  if (err instanceof AiProviderError) {
    return { message: err.message, status: err.status && err.status >= 400 ? err.status : 502 };
  }
  // fetch() throws a TypeError ("fetch failed") when the provider host is unreachable, which is the
  // common failure for a mistyped or not-running Ollama/custom base URL.
  if (err instanceof TypeError && /fetch failed|network|ECONNREFUSED|ENOTFOUND/i.test(String(err.message + (err.cause ?? "")))) {
    return { message: "Couldn't reach the AI provider. Check the base URL and that the server is running.", status: 502 };
  }
  return { message: "Something went wrong talking to the model.", status: 500 };
}
