import { AiProvider } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PROVIDER_INFO, PROVIDER_INFO_LIST } from "./provider-meta";
import { PROVIDERS, getProviderMeta } from "./registry";

describe("provider registry", () => {
  it("has an adapter for every described provider, and ids match their keys", () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(Object.keys(PROVIDER_INFO).sort());
    for (const [key, meta] of Object.entries(PROVIDERS)) {
      expect(meta.id).toBe(key);
      expect(typeof meta.adapter.chat).toBe("function");
    }
  });

  it("matches the database's AiProvider enum - a provider missing there would fail on save", () => {
    expect(PROVIDER_INFO_LIST.map((p) => p.id.toUpperCase()).sort()).toEqual(Object.values(AiProvider).sort());
  });

  it("gives every real provider a default model and a well-formed default URL", () => {
    for (const info of PROVIDER_INFO_LIST) {
      expect(info.label.length).toBeGreaterThan(2);
      if (info.id !== "custom") {
        expect(info.defaultModel, info.id).toBeTruthy();
        expect(() => new URL(info.defaultBaseUrl), info.id).not.toThrow();
      } else {
        expect(info.defaultBaseUrl).toBe(""); // custom has no sensible default: the user must supply one
      }
    }
  });

  it("makes the URL editable wherever there's no fixed default", () => {
    for (const info of PROVIDER_INFO_LIST) if (!info.defaultBaseUrl) expect(info.baseUrlConfigurable).toBe(true);
  });

  it("requires a key for the hosted providers and not for local ones", () => {
    expect(PROVIDER_INFO.anthropic.keyRequired).toBe(true);
    expect(PROVIDER_INFO.openai.keyRequired).toBe(true);
    expect(PROVIDER_INFO.nim.keyRequired).toBe(true);
    expect(PROVIDER_INFO.ollama.keyRequired).toBe(false);
  });

  it("throws on an unknown provider instead of failing later", () => {
    expect(() => getProviderMeta("nope" as never)).toThrow(/Unknown AI provider/);
  });
});
