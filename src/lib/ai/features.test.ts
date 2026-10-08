import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { AI_FEATURES, AiOutputError, type AiContext } from "./features";
import { jsonResponse, openAiCompletion, startServer, type TestServer } from "../../../test/helpers/http";
import type { FakePrisma } from "../../../test/fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../../../test/fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
let server: TestServer;
let reply = "";
let ctx: AiContext;

beforeEach(async () => {
  db.__reset();
  server = await startServer((_req, res) => jsonResponse(res, openAiCompletion(reply)));
  ctx = { userId: "u1", providerId: "custom", model: "mock", credentials: { baseUrl: `${server.url}/v1` } };
});
afterEach(async () => {
  await server.close();
});

const run = (id: string, input: unknown) => AI_FEATURES[id].run(ctx, AI_FEATURES[id].parse(input)) as Promise<any>;
const lastBody = () => server.requests.at(-1)!.body;
const userPrompt = () => lastBody().messages.find((m: any) => m.role === "user").content as string;

describe("fixtures", () => {
  it("unwraps fenced JSON arrays", async () => {
    reply = '```json\n[{"id":1},{"id":2}]\n```';
    expect(await run("fixtures", { schema: "interface X { id: number }", count: 2 })).toEqual({ records: [{ id: 1 }, { id: 2 }] });
  });

  it("wraps a lone object, and salvages JSON buried in chatter", async () => {
    reply = 'Sure! Here you go:\n{"id":1}\nHope that helps.';
    expect(await run("fixtures", { schema: "x", count: 1 })).toEqual({ records: [{ id: 1 }] });
  });

  it("fails clearly when the model doesn't return JSON", async () => {
    reply = "I'm sorry, I can't help with that.";
    await expect(run("fixtures", { schema: "x", count: 1 })).rejects.toBeInstanceOf(AiOutputError);
  });

  it("tells the model the count and shape, and budgets tokens by count", async () => {
    reply = "[]";
    await run("fixtures", { schema: "interface Order { id: string }", count: 7 });
    expect(userPrompt()).toContain("N = 7");
    expect(userPrompt()).toContain("interface Order");
    expect(lastBody().max_tokens).toBe(400 + 7 * 180);
    await run("fixtures", { schema: "x", count: 25 });
    expect(lastBody().max_tokens).toBe(3500); // capped
  });
});

describe("api-mock", () => {
  it("normalises the method and fills defaults", async () => {
    reply = '{"method":"get","path":"/users/42","body":{"id":42}}';
    expect(await run("api-mock", { description: "get a user" })).toEqual({ method: "GET", path: "/users/42", status: 200, body: { id: 42 } });
  });

  it("keeps an explicit error status", async () => {
    reply = '{"method":"POST","path":"/login","status":401,"body":{"error":"nope"}}';
    expect((await run("api-mock", { description: "failed login" })).status).toBe(401);
  });

  it("rejects an answer with no body, or no object at all", async () => {
    reply = '{"method":"GET","path":"/x","status":200}';
    await expect(run("api-mock", { description: "x" })).rejects.toBeInstanceOf(AiOutputError);
    reply = "[1,2,3]";
    await expect(run("api-mock", { description: "x" })).rejects.toBeInstanceOf(AiOutputError);
  });
});

describe("cron", () => {
  it("returns the expression, explanation and notes, and passes the mode through", async () => {
    reply = '{"cron":"0 9 * * 1-5","explanation":"Weekdays at 9.","notes":"UTC assumed"}';
    expect(await run("cron", { mode: "toCron", text: "weekdays at 9" })).toEqual({ cron: "0 9 * * 1-5", explanation: "Weekdays at 9.", notes: "UTC assumed" });
    expect(userPrompt()).toContain("Mode: toCron");
    await run("cron", { mode: "explain", text: "0 9 * * 1-5" });
    expect(userPrompt()).toContain("Mode: explain");
  });

  it("rejects an answer with no expression", async () => {
    reply = '{"explanation":"hmm"}';
    await expect(run("cron", { mode: "toCron", text: "x" })).rejects.toBeInstanceOf(AiOutputError);
  });
});

describe("error-explainer", () => {
  it("maps the answer, caps the steps, and includes optional context", async () => {
    reply = JSON.stringify({ summary: "Undefined array", cause: "data is undefined", steps: ["a", "b", "", "c", "d", "e", "f", "g"], search_query: "react map undefined" });
    const r = await run("error-explainer", { text: "TypeError: x", context: "React 19" });
    expect(r.summary).toBe("Undefined array");
    expect(r.searchQuery).toBe("react map undefined");
    expect(r.steps).toEqual(["a", "b", "c", "d", "e", "f"]); // blanks dropped, at most 6
    expect(userPrompt()).toContain("Context: React 19");
  });
});

describe("json-assist", () => {
  it("strips code fences from generated code, but leaves an explanation as plain text", async () => {
    reply = "```typescript\ninterface Root { a: number }\n```";
    expect((await run("json-assist", { json: '{"a":1}', mode: "typescript" })).output).toBe("interface Root { a: number }");
    reply = "A single object with one number field.";
    expect((await run("json-assist", { json: '{"a":1}', mode: "explain" })).output).toBe("A single object with one number field.");
  });
});

describe("profile", () => {
  it("fills missing fields with empty strings and derives the full name", async () => {
    reply = JSON.stringify({ firstName: "Keiko", lastName: "Tanaka", email: "keiko@example.com", city: "Nagano" });
    const { profile } = await run("profile", { description: "a teacher in Nagano" });
    expect(profile).toMatchObject({ fullName: "Keiko Tanaka", city: "Nagano", phone: "", username: "" });
  });

  it("rejects non-object answers", async () => {
    reply = '["not","a","profile"]';
    await expect(run("profile", { description: "x" })).rejects.toBeInstanceOf(AiOutputError);
  });
});

describe("palette", () => {
  it("lowercases the color and falls back to analogous for an unknown harmony", async () => {
    reply = '{"name":"Neon Rain","base":"#7A5CFF","harmony":"chaotic"}';
    expect(await run("palette", { vibe: "cyberpunk" })).toEqual({ name: "Neon Rain", base: "#7a5cff", harmony: "analogous" });
  });

  it("rejects a color that isn't a hex value, and defaults a missing name", async () => {
    reply = '{"name":"X","base":"rebeccapurple","harmony":"triadic"}';
    await expect(run("palette", { vibe: "x" })).rejects.toBeInstanceOf(AiOutputError);
    reply = '{"base":"#112233","harmony":"triadic"}';
    expect((await run("palette", { vibe: "x" })).name).toBe("Custom palette");
  });
});

describe("history-search", () => {
  beforeEach(async () => {
    await db.historyItem.create({ data: { id: "h1", userId: "u1", tool: "password-generator", label: "24-char password", payload: { value: "SECRET-PAYLOAD-VALUE" }, createdAt: new Date("2026-09-20") } });
    await db.historyItem.create({ data: { id: "h2", userId: "u1", tool: "qr-generator", label: "wifi qr", payload: { text: "SECRET-PAYLOAD-VALUE" }, createdAt: new Date("2026-09-25") } });
    await db.historyItem.create({ data: { id: "h3", userId: "u2", tool: "qr-generator", label: "another user's entry", payload: {}, createdAt: new Date("2026-09-26") } });
  });

  it("returns matches in the model's order, dropping invented ids and other users' entries", async () => {
    reply = '{"ids":["h2","bogus","h3","h1"]}';
    const { items } = await run("history-search", { query: "wifi" });
    expect(items.map((i: any) => i.id)).toEqual(["h2", "h1"]);
    expect(items[0]).toMatchObject({ tool: "qr-generator", label: "wifi qr" });
  });

  it("sends only ids, tools, dates and labels to the provider - never saved values or other users' data", async () => {
    reply = '{"ids":[]}';
    await run("history-search", { query: "anything" });
    const sent = JSON.stringify(lastBody());
    expect(sent).toContain("24-char password");
    expect(sent).not.toContain("SECRET-PAYLOAD-VALUE");
    expect(sent).not.toContain("another user");
  });

  it("doesn't call the provider at all when there's nothing to search", async () => {
    db.__reset();
    expect(await run("history-search", { query: "x" })).toEqual({ items: [] });
    expect(server.requests).toHaveLength(0);
  });
});

describe("input validation", () => {
  const bad: [string, unknown][] = [
    ["fixtures", { schema: "", count: 5 }],
    ["fixtures", { schema: "x", count: 0 }],
    ["fixtures", { schema: "x", count: 26 }],
    ["fixtures", { schema: "x", count: 2.5 }],
    ["fixtures", { schema: "x".repeat(6001), count: 5 }],
    ["api-mock", { description: "" }],
    ["api-mock", { description: "x".repeat(801) }],
    ["cron", { mode: "nope", text: "x" }],
    ["cron", { mode: "toCron", text: "x".repeat(301) }],
    ["error-explainer", { text: "" }],
    ["error-explainer", { text: "x".repeat(6001) }],
    ["error-explainer", { text: "x", context: "x".repeat(201) }],
    ["json-assist", { json: "x".repeat(8001), mode: "explain" }],
    ["json-assist", { json: "{}", mode: "haiku" }],
    ["profile", { description: "" }],
    ["palette", { vibe: "x".repeat(201) }],
    ["history-search", { query: "" }],
  ];

  it.each(bad)("%s rejects %j", (id, input) => {
    expect(() => AI_FEATURES[id].parse(input)).toThrow();
  });

  it("is a closed set: prototype keys aren't features", () => {
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(Object.prototype.hasOwnProperty.call(AI_FEATURES, key)).toBe(false);
    }
  });
});
