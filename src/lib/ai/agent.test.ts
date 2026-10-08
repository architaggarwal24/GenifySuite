import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runAgent, type AgentEvent } from "./agent";
import { AGENT_TOOLS } from "./tools";
import { jsonResponse, openAiCompletion, openAiSse, startServer, writeMangled, type TestServer } from "../../../test/helpers/http";
import type { FakePrisma } from "../../../test/fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../../../test/fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;

type Turn = { json: object } | { sse: object[] };
let server: TestServer;

/** The Nth request the agent makes gets turns[N] (the last turn repeats if the agent keeps going). */
async function scripted(turns: Turn[]): Promise<{ base: string }> {
  server = await startServer(async (_req, res) => {
    const turn = turns[Math.min(server.requests.length - 1, turns.length - 1)];
    if ("sse" in turn) await writeMangled(res, openAiSse(turn.sse), 9);
    else jsonResponse(res, turn.json);
  });
  return { base: `${server.url}/v1` };
}

const call = (id: string, name: string, args: string) => ({ id, type: "function", function: { name, arguments: args } });
const toolTurn = (...calls: ReturnType<typeof call>[]): Turn => ({ json: openAiCompletion("", { tool_calls: calls }) });
const textTurn = (text: string): Turn => ({ json: openAiCompletion(text) });

const USER = [{ role: "user" as const, content: "do the thing" }];
const CTX = { userId: "u1" };

beforeEach(() => db.__reset());
afterEach(async () => {
  await server?.close();
});

describe("agent loop", () => {
  it("runs tool calls locally, feeds the results back, and returns the model's final answer", async () => {
    const { base } = await scripted([
      toolTurn(call("c1", "generate_password", '{"length":12}'), call("c2", "generate_uuids", '{"count":2}')),
      textTurn("All done."),
    ]);
    const result = await runAgent("custom", "m", { baseUrl: base }, USER, CTX);

    expect(result.reply).toBe("All done.");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toMatchObject({ tool: "generate_password", arguments: { length: 12 } });
    expect(result.steps[0].result).toHaveLength(12);
    expect(result.steps[1].result).toHaveLength(2);

    // What the model saw on its second turn: its own tool calls plus one result per call, matched by id.
    const second = server.requests[1].body.messages;
    expect(second.map((m: any) => m.role)).toEqual(["system", "user", "assistant", "tool", "tool"]);
    expect(second[2].tool_calls.map((c: any) => c.id)).toEqual(["c1", "c2"]);
    expect(second[3].tool_call_id).toBe("c1");
    expect(JSON.parse(second[3].content)).toBe(result.steps[0].result);
    expect(second[4].tool_call_id).toBe("c2");
    expect(JSON.parse(second[4].content)).toEqual(result.steps[1].result);
  });

  it("sends the system prompt and every tool definition on every turn", async () => {
    const { base } = await scripted([toolTurn(call("c1", "generate_uuids", "{}")), textTurn("ok")]);
    await runAgent("custom", "m", { baseUrl: base }, USER, CTX);
    const expected = AGENT_TOOLS.map((t) => t.definition.name);
    for (const req of server.requests) {
      expect(req.body.messages[0].role).toBe("system");
      expect(req.body.tools.map((t: any) => t.function.name)).toEqual(expected);
    }
  });

  it("keeps the earlier conversation in front of the model", async () => {
    const { base } = await scripted([textTurn("hi")]);
    await runAgent(
      "custom",
      "m",
      { baseUrl: base },
      [
        { role: "user", content: "first" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "second" },
      ],
      CTX
    );
    expect(server.requests[0].body.messages.slice(1).map((m: any) => m.content)).toEqual(["first", "answer", "second"]);
  });

  it("survives an unknown tool and malformed arguments", async () => {
    const { base } = await scripted([
      toolTurn(call("c1", "does_not_exist", "{}"), call("c2", "generate_password", "{not json")),
      textTurn("done"),
    ]);
    const { steps, reply } = await runAgent("custom", "m", { baseUrl: base }, USER, CTX);
    expect(steps[0].result).toEqual({ error: "Unknown tool: does_not_exist" });
    expect(steps[1].result).toHaveLength(16); // fell back to the default length
    expect(reply).toBe("done");
  });

  it("reports a tool that throws as a result instead of crashing the run", async () => {
    vi.spyOn(db.historyItem, "findMany").mockRejectedValue(new Error("db down"));
    const { base } = await scripted([toolTurn(call("c1", "list_saved_history", "{}")), textTurn("sorry")]);
    const { steps, reply } = await runAgent("custom", "m", { baseUrl: base }, USER, CTX);
    expect(steps[0].result).toEqual({ error: "db down" });
    expect(reply).toBe("sorry");
  });

  it("gives up after 4 model turns if it keeps asking for tools", async () => {
    const { base } = await scripted([toolTurn(call("c1", "generate_uuids", "{}"))]);
    const events: AgentEvent[] = [];
    const result = await runAgent("custom", "m", { baseUrl: base }, USER, CTX, { onEvent: (e) => events.push(e) });
    expect(server.requests).toHaveLength(4);
    expect(result.steps).toHaveLength(4);
    expect(result.reply).toMatch(/more steps/);
    expect(events.at(-1)).toEqual({ type: "text", delta: result.reply });
  });
});

describe("agent tools run for real", () => {
  it("verifies cron expressions: valid ones get real next runs, invalid ones an error", async () => {
    const { base } = await scripted([
      toolTurn(call("c1", "cron_next_runs", '{"cron":"0 9 * * 1-5","count":3}'), call("c2", "cron_next_runs", '{"cron":"99 9 * * *"}')),
      textTurn("checked"),
    ]);
    const { steps } = await runAgent("custom", "m", { baseUrl: base }, USER, CTX);
    const valid = steps[0].result as { valid: boolean; nextRuns: string[]; timezone: string };
    expect(valid.valid).toBe(true);
    expect(valid.timezone).toBe("UTC");
    expect(valid.nextRuns).toHaveLength(3);
    valid.nextRuns.forEach((iso) => {
      const d = new Date(iso);
      expect(d.getTime()).toBeGreaterThan(Date.now());
      expect(d.getUTCHours()).toBe(9);
      expect([1, 2, 3, 4, 5]).toContain(d.getUTCDay());
    });
    expect(steps[1].result).toMatchObject({ valid: false, error: expect.stringMatching(/minute/) });
  });

  it("lists only the signed-in user's saved history, newest first, labels only", async () => {
    await db.historyItem.create({ data: { userId: "u1", tool: "password-generator", label: "older", payload: { secret: "PAYLOAD-SECRET" }, createdAt: new Date("2026-09-01") } });
    await db.historyItem.create({ data: { userId: "u1", tool: "qr-generator", label: "newer", payload: { secret: "PAYLOAD-SECRET" }, createdAt: new Date("2026-09-20") } });
    await db.historyItem.create({ data: { userId: "u2", tool: "qr-generator", label: "someone else's", payload: {}, createdAt: new Date("2026-09-25") } });

    const { base } = await scripted([toolTurn(call("c1", "list_saved_history", "{}")), textTurn("here")]);
    const { steps } = await runAgent("custom", "m", { baseUrl: base }, USER, CTX);
    const items = steps[0].result as { tool: string; label: string; savedAt: string }[];

    expect(items.map((i) => i.label)).toEqual(["newer", "older"]);
    expect(Object.keys(items[0]).sort()).toEqual(["label", "savedAt", "tool"]);
    // The saved values never reach the model - not in the tool result, not in what's sent to the provider.
    expect(JSON.stringify(server.requests[1].body)).not.toContain("PAYLOAD-SECRET");
    expect(JSON.stringify(server.requests[1].body)).not.toContain("someone else's");
  });
});

describe("agent streaming", () => {
  const STREAM_TURNS: Turn[] = [
    {
      sse: [
        { choices: [{ delta: { content: "Working on it… " } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "generate_password", arguments: '{"len' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'gth":10}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ],
    },
    { sse: [{ choices: [{ delta: { content: "Here " } }] }, { choices: [{ delta: { content: "you go." }, finish_reason: "stop" }] }] },
  ];

  it("emits text as it arrives, then each tool result the moment it finishes, then the final text", async () => {
    const { base } = await scripted(STREAM_TURNS);
    const events: AgentEvent[] = [];
    const result = await runAgent("custom", "m", { baseUrl: base }, USER, CTX, { onEvent: (e) => events.push(e) });

    const kinds = events.map((e) => e.type);
    const firstStep = kinds.indexOf("step");
    expect(firstStep).toBeGreaterThan(0);
    const textOf = (list: AgentEvent[]) => list.map((e) => (e.type === "text" ? e.delta : "")).join("");

    expect(textOf(events.slice(0, firstStep))).toBe("Working on it… ");
    expect(events[firstStep]).toMatchObject({ type: "step", step: { tool: "generate_password", arguments: { length: 10 } } });
    expect(textOf(events.slice(firstStep + 1))).toBe("Here you go.");
    expect(result.reply).toBe("Here you go.");
    expect(server.requests.every((r) => r.body.stream === true)).toBe(true);
  });

  it("does not stream unless asked", async () => {
    const { base } = await scripted([textTurn("plain")]);
    await runAgent("custom", "m", { baseUrl: base }, USER, CTX);
    expect(server.requests[0].body.stream).toBeUndefined();
  });

  it("stops without making further provider calls when aborted mid-run", async () => {
    const { base } = await scripted(STREAM_TURNS);
    const controller = new AbortController();
    const err = await runAgent("custom", "m", { baseUrl: base }, USER, CTX, {
      signal: controller.signal,
      onEvent: () => controller.abort(),
    }).catch((e) => e);

    expect(err.name).toBe("AbortError");
    await new Promise((r) => setTimeout(r, 50));
    expect(server.requests).toHaveLength(1);
  });
});
