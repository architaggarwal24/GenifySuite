import { describe, expect, it } from "vitest";
import { AGENT_LIMITS, agentInputChars, checkAgentInput } from "./agent-limits";

const msg = (content: string, extra: Record<string, unknown> = {}) => ({ role: "user", content, ...extra });

describe("agent input budget", () => {
  it("accepts an ordinary conversation", () => {
    expect(checkAgentInput([msg("make me 5 uuids"), { role: "assistant", content: "done" }])).toBeNull();
  });

  it("rejects a single huge message", () => {
    expect(checkAgentInput([msg("x".repeat(AGENT_LIMITS.maxMessageChars + 1))])).toMatch(/too long/i);
    expect(checkAgentInput([msg("x".repeat(AGENT_LIMITS.maxMessageChars))])).toBeNull();
  });

  it("rejects a conversation whose total size is over budget even if each message is small", () => {
    const each = AGENT_LIMITS.maxMessageChars;
    const count = Math.ceil(AGENT_LIMITS.maxTotalChars / each) + 1;
    const many = Array.from({ length: count }, () => msg("y".repeat(each)));
    expect(checkAgentInput(many)).toMatch(/too long/i);
  });

  it("counts tool-call arguments too, so they can't smuggle size past the content check", () => {
    const sneaky = [{ role: "assistant", content: "", toolCalls: [{ id: "1", name: "t", arguments: { blob: "z".repeat(AGENT_LIMITS.maxTotalChars) } }] }];
    expect(agentInputChars(sneaky)).toBeGreaterThan(AGENT_LIMITS.maxTotalChars);
    expect(checkAgentInput(sneaky)).toMatch(/too long/i);
  });

  it("rejects too many messages", () => {
    expect(checkAgentInput(Array.from({ length: AGENT_LIMITS.maxMessages + 1 }, () => msg("hi")))).toMatch(/too many/i);
  });
});
