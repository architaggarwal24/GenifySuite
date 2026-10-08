import { afterEach, describe, expect, it } from "vitest";
import { anthropicAdapter } from "./anthropic";
import { createOpenAiCompatibleAdapter } from "./openai-compatible";
import { AiProviderError, type ChatMessage, type ToolDefinition } from "./types";
import {
  anthropicSse,
  jsonResponse,
  openAiCompletion,
  openAiSse,
  startServer,
  writeMangled,
  type TestServer,
} from "../../../test/helpers/http";

let server: TestServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const TOOL: ToolDefinition = {
  name: "lookup",
  description: "Looks something up",
  parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
};

const CONVERSATION: ChatMessage[] = [
  { role: "user", content: "hi" },
  {
    role: "assistant",
    content: "on it",
    toolCalls: [
      { id: "c1", name: "lookup", arguments: { q: "a" } },
      { id: "c2", name: "lookup", arguments: { q: "b" } },
    ],
  },
  { role: "tool", content: '{"r":1}', toolCallId: "c1", toolName: "lookup" },
  { role: "tool", content: '{"r":2}', toolCallId: "c2", toolName: "lookup" },
];

describe("OpenAI-compatible adapter: request shape", () => {
  it("sends what the OpenAI chat-completions API requires", async () => {
    server = await startServer((_req, res) => jsonResponse(res, openAiCompletion("ok")));
    const adapter = createOpenAiCompatibleAdapter(`${server.url}/v1`);
    await adapter.chat({ messages: CONVERSATION, tools: [TOOL], model: "m", system: "SYS", maxTokens: 321 }, { apiKey: "sk-test" });

    const req = server.requests[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/v1/chat/completions");
    expect(req.headers.authorization).toBe("Bearer sk-test");
    expect(req.body.model).toBe("m");
    expect(req.body.max_tokens).toBe(321);
    expect(req.body.stream).toBeUndefined();
    expect(req.body.tools).toEqual([{ type: "function", function: { name: "lookup", description: "Looks something up", parameters: TOOL.parameters } }]);

    const [system, user, assistant, tool1, tool2] = req.body.messages;
    expect(system).toEqual({ role: "system", content: "SYS" });
    expect(user).toEqual({ role: "user", content: "hi" });
    // OpenAI rejects an assistant tool call that lacks `type: "function"` - which would break every
    // multi-step agent run on the real API while still passing against a lenient local server.
    expect(assistant.tool_calls).toEqual([
      { id: "c1", type: "function", function: { name: "lookup", arguments: '{"q":"a"}' } },
      { id: "c2", type: "function", function: { name: "lookup", arguments: '{"q":"b"}' } },
    ]);
    expect(tool1).toMatchObject({ role: "tool", tool_call_id: "c1", content: '{"r":1}' });
    expect(tool2).toMatchObject({ role: "tool", tool_call_id: "c2", content: '{"r":2}' });
  });

  it("omits Authorization when there is no key (e.g. local Ollama)", async () => {
    server = await startServer((_req, res) => jsonResponse(res, openAiCompletion("ok")));
    await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [{ role: "user", content: "x" }], model: "m" }, {});
    expect(server.requests[0].headers.authorization).toBeUndefined();
  });

  it("requests streaming only when the caller wants it", async () => {
    server = await startServer((_req, res) => jsonResponse(res, openAiCompletion("ok")));
    const adapter = createOpenAiCompatibleAdapter(`${server.url}/v1`);
    await adapter.chat({ messages: [{ role: "user", content: "x" }], model: "m" }, {});
    await adapter.chat({ messages: [{ role: "user", content: "x" }], model: "m" }, {}, { onText: () => {} });
    expect(server.requests[0].body.stream).toBeUndefined();
    expect(server.requests[1].body.stream).toBe(true);
  });

  it("uses the credential's base URL over the default and tolerates trailing slashes", async () => {
    server = await startServer((_req, res) => jsonResponse(res, openAiCompletion("ok")));
    await createOpenAiCompatibleAdapter("http://unused.invalid/v1").chat(
      { messages: [{ role: "user", content: "x" }], model: "m" },
      { baseUrl: `${server.url}/v1///` }
    );
    expect(server.requests[0].url).toBe("/v1/chat/completions");
  });

  it("refuses to run with no base URL at all", async () => {
    await expect(createOpenAiCompatibleAdapter("").chat({ messages: [], model: "m" }, {})).rejects.toThrow(/base URL/);
  });
});

describe("OpenAI-compatible adapter: responses", () => {
  it("parses a plain JSON completion with tool calls", async () => {
    server = await startServer((_req, res) =>
      jsonResponse(res, openAiCompletion("", { tool_calls: [{ id: "x1", function: { name: "lookup", arguments: '{"q":"z"}' } }] }))
    );
    const r = await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [{ role: "user", content: "x" }], model: "m" }, {});
    expect(r.stopReason).toBe("tool_call");
    expect(r.toolCalls).toEqual([{ id: "x1", name: "lookup", arguments: { q: "z" } }]);
  });

  it("treats tool calls as tool calls even when the server reports finish_reason 'stop' (Ollama does)", async () => {
    server = await startServer((_req, res) =>
      jsonResponse(res, {
        choices: [{ message: { content: "", tool_calls: [{ id: "x", function: { name: "lookup", arguments: "{}" } }] }, finish_reason: "stop" }],
      })
    );
    const r = await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [{ role: "user", content: "x" }], model: "m" }, {});
    expect(r.stopReason).toBe("tool_call");
  });

  it("maps finish_reason 'length' and plain stops", async () => {
    server = await startServer((req, res) =>
      jsonResponse(res, { choices: [{ message: { content: "cut" }, finish_reason: req.body.max_tokens === 1 ? "length" : "stop" }] })
    );
    const adapter = createOpenAiCompatibleAdapter(`${server.url}/v1`);
    expect((await adapter.chat({ messages: [], model: "m", maxTokens: 1 }, {})).stopReason).toBe("length");
    expect((await adapter.chat({ messages: [], model: "m", maxTokens: 5 }, {})).stopReason).toBe("end");
  });

  it("falls back to empty args when a model emits malformed tool-argument JSON", async () => {
    server = await startServer((_req, res) =>
      jsonResponse(res, openAiCompletion("", { tool_calls: [{ id: "x", function: { name: "lookup", arguments: "{not json" } }] }))
    );
    const r = await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [], model: "m" }, {});
    expect(r.toolCalls?.[0].arguments).toEqual({});
  });

  it("surfaces provider errors with status and a truncated body", async () => {
    server = await startServer((_req, res) => jsonResponse(res, { error: { message: "Incorrect API key" }, pad: "x".repeat(1000) }, 401));
    const err = await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [], model: "m" }, { apiKey: "bad" }).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.status).toBe(401);
    expect(err.message).toContain("Incorrect API key");
    expect(err.message.length).toBeLessThan(400);
  });

  it("reports an unreachable server as a fetch failure", async () => {
    const dead = await startServer(() => {});
    const url = dead.url;
    await dead.close();
    await expect(createOpenAiCompatibleAdapter(`${url}/v1`).chat({ messages: [], model: "m" }, {})).rejects.toThrow(/fetch failed/);
  });
});

describe("OpenAI-compatible adapter: streaming", () => {
  const TEXT_AND_TOOLS = openAiSse([
    { choices: [{ delta: { content: "Sure — one " } }] },
    { choices: [{ delta: { content: "moment, café ☕\n" } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "lookup", arguments: "" } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"q":"he' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'llo"}' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 1, id: "call_2", function: { name: "lookup", arguments: '{"q":"b"}' } }] } }] },
    { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
  ]);

  it.each([3, 7, 23])("reassembles text and fragmented parallel tool calls from %i-byte chunks", async (chunkSize) => {
    server = await startServer((_req, res) => writeMangled(res, TEXT_AND_TOOLS, chunkSize));
    let streamed = "";
    const r = await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat(
      { messages: [{ role: "user", content: "x" }], model: "m" },
      {},
      { onText: (d) => (streamed += d) }
    );
    expect(streamed).toBe("Sure — one moment, café ☕\n");
    expect(r.content).toBe(streamed);
    expect(r.stopReason).toBe("tool_call");
    expect(r.toolCalls).toEqual([
      { id: "call_1", name: "lookup", arguments: { q: "hello" } },
      { id: "call_2", name: "lookup", arguments: { q: "b" } },
    ]);
  });

  it("delivers text incrementally, not all at the end", async () => {
    server = await startServer((_req, res) => writeMangled(res, TEXT_AND_TOOLS, 9));
    const deltas: string[] = [];
    await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [], model: "m" }, {}, { onText: (d) => deltas.push(d) });
    expect(deltas).toEqual(["Sure — one ", "moment, café ☕\n"]);
  });

  it("parses an event stream even if it wasn't asked for (some self-hosted servers always stream)", async () => {
    server = await startServer((_req, res) => writeMangled(res, TEXT_AND_TOOLS, 11));
    const r = await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [], model: "m" }, {});
    expect(r.toolCalls).toHaveLength(2);
  });

  it("hands over the whole text once if the server ignored the stream flag and sent JSON", async () => {
    server = await startServer((_req, res) => jsonResponse(res, openAiCompletion("all at once")));
    const deltas: string[] = [];
    const r = await createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [], model: "m" }, {}, { onText: (d) => deltas.push(d) });
    expect(deltas).toEqual(["all at once"]);
    expect(r.content).toBe("all at once");
  });

  it("fails the call when the provider reports an error mid-stream", async () => {
    server = await startServer((_req, res) =>
      writeMangled(res, openAiSse([{ choices: [{ delta: { content: "partial" } }] }, { error: { message: "model overloaded" } }]), 8)
    );
    await expect(
      createOpenAiCompatibleAdapter(`${server.url}/v1`).chat({ messages: [], model: "m" }, {}, { onText: () => {} })
    ).rejects.toThrow(/model overloaded/);
  });

  it("stops promptly when aborted mid-stream", async () => {
    server = await startServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'); // ...and never finishes
    });
    const controller = new AbortController();
    const err = await createOpenAiCompatibleAdapter(`${server.url}/v1`)
      .chat({ messages: [], model: "m" }, {}, { onText: () => controller.abort(), signal: controller.signal })
      .catch((e) => e);
    expect(err.name).toBe("AbortError");
  });
});

describe("Anthropic adapter: request shape", () => {
  it("sends what the Messages API requires, merging parallel tool results into ONE user turn", async () => {
    server = await startServer((_req, res) => jsonResponse(res, { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }));
    await anthropicAdapter.chat(
      { messages: [...CONVERSATION, { role: "user", content: "and then?" }], tools: [TOOL], model: "claude-x", system: "SYS" },
      { apiKey: "sk-ant-test", baseUrl: `${server.url}/` }
    );

    const req = server.requests[0];
    expect(req.url).toBe("/v1/messages");
    expect(req.headers["x-api-key"]).toBe("sk-ant-test");
    expect(req.headers["anthropic-version"]).toBe("2023-06-01");
    expect(req.body.system).toBe("SYS");
    expect(req.body.max_tokens).toBe(1024);
    expect(req.body.stream).toBeUndefined();
    expect(req.body.tools).toEqual([{ name: "lookup", description: "Looks something up", input_schema: TOOL.parameters }]);

    expect(req.body.messages).toEqual([
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "on it" },
          { type: "tool_use", id: "c1", name: "lookup", input: { q: "a" } },
          { type: "tool_use", id: "c2", name: "lookup", input: { q: "b" } },
        ],
      },
      // Anthropic requires every result for a parallel tool call in a single user message.
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "c1", content: '{"r":1}' },
          { type: "tool_result", tool_use_id: "c2", content: '{"r":2}' },
        ],
      },
      { role: "user", content: "and then?" },
    ]);
  });

  it("requests streaming only when the caller wants it", async () => {
    server = await startServer((_req, res) => jsonResponse(res, { content: [{ type: "text", text: "ok" }] }));
    const creds = { apiKey: "k", baseUrl: server.url };
    await anthropicAdapter.chat({ messages: [{ role: "user", content: "x" }], model: "m" }, creds);
    await anthropicAdapter.chat({ messages: [{ role: "user", content: "x" }], model: "m" }, creds, { onText: () => {} });
    expect(server.requests[0].body.stream).toBeUndefined();
    expect(server.requests[1].body.stream).toBe(true);
  });

  it("requires an API key", async () => {
    await expect(anthropicAdapter.chat({ messages: [], model: "m" }, {})).rejects.toThrow(/requires an API key/);
  });
});

describe("Anthropic adapter: responses", () => {
  it("parses text and tool_use blocks, and maps stop reasons", async () => {
    server = await startServer((_req, res) =>
      jsonResponse(res, {
        content: [
          { type: "text", text: "Looking " },
          { type: "text", text: "now." },
          { type: "tool_use", id: "tu_1", name: "lookup", input: { q: "z" } },
        ],
        stop_reason: "tool_use",
      })
    );
    const r = await anthropicAdapter.chat({ messages: [], model: "m" }, { apiKey: "k", baseUrl: server.url });
    expect(r).toEqual({ content: "Looking now.", toolCalls: [{ id: "tu_1", name: "lookup", arguments: { q: "z" } }], stopReason: "tool_call" });
  });

  it("maps max_tokens to 'length'", async () => {
    server = await startServer((_req, res) => jsonResponse(res, { content: [{ type: "text", text: "cut" }], stop_reason: "max_tokens" }));
    expect((await anthropicAdapter.chat({ messages: [], model: "m" }, { apiKey: "k", baseUrl: server.url })).stopReason).toBe("length");
  });

  it("surfaces API errors with status", async () => {
    server = await startServer((_req, res) => jsonResponse(res, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401));
    const err = await anthropicAdapter.chat({ messages: [], model: "m" }, { apiKey: "bad", baseUrl: server.url }).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.status).toBe(401);
    expect(err.message).toContain("invalid x-api-key");
  });
});

describe("Anthropic adapter: streaming", () => {
  const STREAM = anthropicSse([
    ["message_start", { type: "message_start" }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Checking naï" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ve café ⚡\n" } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "lookup" } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"q":"0 ' } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '9 * * 1-5"' } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: ',"n":2}' } }],
    ["content_block_stop", { type: "content_block_stop", index: 1 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "tool_use" } }],
    ["message_stop", { type: "message_stop" }],
  ]);

  it.each([3, 7, 23])("reassembles text and fragmented tool input from %i-byte chunks", async (chunkSize) => {
    server = await startServer((_req, res) => writeMangled(res, STREAM, chunkSize));
    let streamed = "";
    const r = await anthropicAdapter.chat({ messages: [], model: "m" }, { apiKey: "k", baseUrl: server.url }, { onText: (d) => (streamed += d) });
    expect(streamed).toBe("Checking naïve café ⚡\n");
    expect(r.content).toBe(streamed);
    expect(r.stopReason).toBe("tool_call");
    expect(r.toolCalls).toEqual([{ id: "toolu_1", name: "lookup", arguments: { q: "0 9 * * 1-5", n: 2 } }]);
  });

  it("ends normally after a plain text turn", async () => {
    server = await startServer((_req, res) =>
      writeMangled(
        res,
        anthropicSse([
          ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text" } }],
          ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Done." } }],
          ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" } }],
        ]),
        5
      )
    );
    const r = await anthropicAdapter.chat({ messages: [], model: "m" }, { apiKey: "k", baseUrl: server.url }, { onText: () => {} });
    expect(r).toEqual({ content: "Done.", toolCalls: undefined, stopReason: "end" });
  });

  it("fails the call on an error event mid-stream", async () => {
    server = await startServer((_req, res) =>
      writeMangled(res, anthropicSse([["error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]]), 6)
    );
    await expect(
      anthropicAdapter.chat({ messages: [], model: "m" }, { apiKey: "k", baseUrl: server.url }, { onText: () => {} })
    ).rejects.toThrow(/Overloaded/);
  });
});
