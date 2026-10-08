import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { AGENT_TOOLS, getAgentTool } from "./tools";
import { isLuhnValid } from "@/lib/cards";
import type { FakePrisma } from "../../../test/fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../../../test/fake-prisma");
  return { prisma: createFakePrisma() };
});

beforeEach(() => (prisma as unknown as FakePrisma).__reset());

const CTX = { userId: "u1" };
const run = async (name: string, args: Record<string, unknown> = {}) => getAgentTool(name)!.execute(args, CTX);

describe("agent tool definitions", () => {
  it("have unique names and well-formed JSON Schemas", () => {
    const names = AGENT_TOOLS.map((t) => t.definition.name);
    expect(new Set(names).size).toBe(names.length);

    for (const { definition } of AGENT_TOOLS) {
      expect(definition.name, "snake_case").toMatch(/^[a-z][a-z0-9_]*$/);
      expect(definition.description.length).toBeGreaterThan(10);
      expect(definition.parameters.type).toBe("object");
      const keys = Object.keys(definition.parameters.properties);
      for (const required of definition.parameters.required ?? []) expect(keys, `${definition.name}.${required}`).toContain(required);
      for (const [key, prop] of Object.entries(definition.parameters.properties)) {
        expect(prop.type, `${definition.name}.${key}`).toMatch(/^(string|number|boolean)$/);
        if (prop.enum) expect(prop.enum.length).toBeGreaterThan(0);
      }
    }
  });

  it("can all be executed with minimal valid arguments", async () => {
    const minimal: Record<string, Record<string, unknown>> = {
      generate_lorem_ipsum: { unit: "words", count: 4 },
      generate_color_palette: { base: "#ff8800", harmony: "triadic" },
      format_json: { json: '{"a":1}' },
      cron_next_runs: { cron: "0 9 * * 1-5" },
    };
    for (const tool of AGENT_TOOLS) {
      const result = await tool.execute(minimal[tool.definition.name] ?? {}, CTX);
      expect(result, tool.definition.name).toBeDefined();
    }
  });
});

describe("agent tool behaviour", () => {
  it("clamps counts and lengths instead of trusting the model", async () => {
    expect(await run("generate_uuids", { count: 100000 })).toHaveLength(50);
    expect(await run("generate_uuids", { count: -3 })).toHaveLength(1);
    expect(await run("generate_fake_profiles", { count: 999 })).toHaveLength(10);
    expect(await run("generate_test_cards", { count: 999 })).toHaveLength(10);
    expect(await run("generate_password", { length: 1 })).toHaveLength(8);
    expect(await run("generate_password", { length: 5000 })).toHaveLength(64);
    expect(await run("generate_password", { length: "not a number" })).toHaveLength(16);
  });

  it("can leave symbols out of a password", async () => {
    for (let i = 0; i < 50; i++) expect(await run("generate_password", { symbols: false })).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("falls back to sane defaults for bad enum values", async () => {
    expect(await run("generate_color_palette", { base: "#336699", harmony: "chaotic" })).toHaveLength(5); // analogous
    expect((await run("generate_lorem_ipsum", { unit: "pages", count: 2 })) as string).toContain("\n\n"); // paragraphs
    const cards = (await run("generate_test_cards", { network: "NotACard" })) as { network: string; number: string }[];
    expect(cards[0].network).toBe("Visa");
    expect(isLuhnValid(cards[0].number)).toBe(true);
  });

  it("formats JSON, and reports parse errors instead of throwing", async () => {
    expect(await run("format_json", { json: '{"a":1}', indent: 2 })).toEqual({ valid: true, formatted: '{\n  "a": 1\n}' });
    expect(await run("format_json", { json: "{oops" })).toMatchObject({ valid: false, error: expect.any(String) });
  });

  it("validates cron and computes real upcoming runs", async () => {
    const ok = (await run("cron_next_runs", { cron: "*/30 * * * *", count: 4 })) as { valid: boolean; nextRuns: string[] };
    expect(ok.valid).toBe(true);
    expect(ok.nextRuns).toHaveLength(4);
    expect(await run("cron_next_runs", { cron: "not a cron" })).toMatchObject({ valid: false });
  });

  it("never exposes the signed-in user's saved values, and filters by tool", async () => {
    const db = prisma as unknown as FakePrisma;
    await db.historyItem.create({ data: { userId: "u1", tool: "a", label: "one", payload: { v: "SECRET" } } });
    await db.historyItem.create({ data: { userId: "u1", tool: "b", label: "two", payload: { v: "SECRET" } } });
    const all = (await run("list_saved_history", {})) as unknown[];
    const onlyA = (await run("list_saved_history", { tool: "a" })) as { label: string }[];
    expect(all).toHaveLength(2);
    expect(onlyA.map((i) => i.label)).toEqual(["one"]);
    expect(JSON.stringify(all)).not.toContain("SECRET");
  });
});
