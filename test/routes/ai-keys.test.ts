import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createKey } from "@/app/api/ai/keys/route";
import { prisma } from "@/lib/prisma";
import type { FakePrisma } from "../fake-prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
const post = (body: Record<string, unknown>) =>
  createKey(new Request("http://localhost/api/ai/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const custom = (baseUrl: string) => ({ provider: "custom", label: "mine", baseUrl, defaultModel: "some-model" });

beforeEach(() => {
  db.__reset();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ai/keys: the base URL is something the server will call", () => {
  it("requires sign-in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await post(custom("https://api.example.com/v1"))).status).toBe(401);
  });

  it.each(["http://169.254.169.254/latest/meta-data", "https://127.0.0.1:8080/v1", "https://10.0.0.5/v1", "http://api.example.com/v1", "https://api.example.com/v1?x="])(
    "in production, refuses %s and stores nothing",
    async (baseUrl) => {
      vi.stubEnv("NODE_ENV", "production");
      const res = await post(custom(baseUrl));
      expect(res.status).toBe(400);
      expect(db.apiKey.__rows).toHaveLength(0);
    }
  );

  it("in production, saves a public https URL in its normalised form", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await post(custom("https://api.example.com/v1/"));
    expect(res.status).toBe(200);
    expect(db.apiKey.__rows.map((r) => r.baseUrl)).toEqual(["https://api.example.com/v1"]);
  });

  it("in development, still allows a local Ollama", async () => {
    const res = await post({ provider: "ollama", label: "local", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1" });
    expect(res.status).toBe(200);
  });

  it("in production, a self-hoster can opt in to private hosts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GENIFY_ALLOW_PRIVATE_AI_HOSTS", "true");
    const res = await post({ provider: "ollama", label: "local", baseUrl: "http://192.168.1.20:11434/v1", defaultModel: "llama3.1" });
    expect(res.status).toBe(200);
  });
});
