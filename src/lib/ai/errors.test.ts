import { describe, expect, it } from "vitest";
import { AiOutputError, isRefundableAiError } from "./errors";
import { AiProviderError } from "./types";
import { UnsafeProviderUrlError } from "./url-safety";

describe("isRefundableAiError: only failures that cost the operator nothing", () => {
  it("refunds a network failure and a provider 5xx (no tokens were billed)", () => {
    expect(isRefundableAiError(new TypeError("fetch failed"))).toBe(true);
    expect(isRefundableAiError(new AiProviderError("down", 503))).toBe(true);
    expect(isRefundableAiError(new AiProviderError("bad gateway", 502))).toBe(true);
  });

  it("refunds a request that was refused before it left (unsafe URL)", () => {
    expect(isRefundableAiError(new UnsafeProviderUrlError("no"))).toBe(true);
  });

  it("does NOT refund anything where the model may already have run", () => {
    expect(isRefundableAiError(new AiProviderError("bad key", 401))).toBe(false);
    expect(isRefundableAiError(new AiProviderError("bad request", 400))).toBe(false);
    expect(isRefundableAiError(new AiProviderError("error mid-stream"))).toBe(false); // no status: tokens may have been generated
    expect(isRefundableAiError(new AiOutputError("not json"))).toBe(false);
  });

  it("does NOT refund an aborted request (otherwise disconnecting would make requests free)", () => {
    const abort = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
    expect(isRefundableAiError(abort)).toBe(false);
    expect(isRefundableAiError("weird")).toBe(false);
  });
});
