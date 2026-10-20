import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicAdapter } from "./anthropic";
import { createOpenAiCompatibleAdapter } from "./openai-compatible";
import { UnsafeProviderUrlError } from "./url-safety";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const request = { model: "m", messages: [{ role: "user" as const, content: "hi" }] };
const adapters = [
  ["Anthropic", anthropicAdapter],
  ["OpenAI-compatible", createOpenAiCompatibleAdapter("https://api.openai.com/v1")],
] as const;

describe("adapters refuse to call internal addresses in production", () => {
  for (const [name, adapter] of adapters) {
    it(`${name}: never even attempts the request`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      await expect(adapter.chat(request, { apiKey: "k", baseUrl: "http://169.254.169.254/latest" })).rejects.toBeInstanceOf(UnsafeProviderUrlError);
      await expect(adapter.chat(request, { apiKey: "k", baseUrl: "https://127.0.0.1:9/v1" })).rejects.toBeInstanceOf(UnsafeProviderUrlError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it(`${name}: does not follow redirects (a public host can't bounce the request inward)`, async () => {
      vi.stubEnv("NODE_ENV", "development");
      const fetchSpy = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
      vi.stubGlobal("fetch", fetchSpy);
      await adapter.chat(request, { apiKey: "k", baseUrl: "http://localhost:9/v1" }).catch(() => {});
      expect(fetchSpy.mock.calls[0][1].redirect).toBe("error");
    });
  }
});
