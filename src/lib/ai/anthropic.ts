import {
  type AIProviderAdapter,
  AiProviderError,
  type ChatMessage,
  type ChatOptions,
  type ChatRequest,
  type ChatResult,
  type ProviderCredentials,
  type ToolCall,
  type ToolDefinition,
} from "@/lib/ai/types";
import { readSse } from "@/lib/ai/sse";
import { resolveProviderUrl } from "@/lib/ai/url-safety";

const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

function toAnthropicTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

// Anthropic keeps tool calls/results as content blocks within user/assistant
// turns rather than a dedicated "tool" role, so we fold our generic
// "tool" role messages into a user turn with tool_result blocks.
function toAnthropicMessages(messages: ChatMessage[]) {
  const out: { role: "user" | "assistant"; content: string | AnthropicContentBlock[] }[] = [];

  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "tool") {
      const block: AnthropicContentBlock = {
        type: "tool_result",
        tool_use_id: message.toolCallId!,
        content: message.content,
      };
      // Parallel tool calls must have ALL their results in a single user turn; merge consecutive tool results.
      const previous = out[out.length - 1];
      if (previous && previous.role === "user" && Array.isArray(previous.content) && previous.content.every((b) => b.type === "tool_result")) {
        previous.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      const blocks: AnthropicContentBlock[] = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const call of message.toolCalls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }

    out.push({ role: message.role as "user" | "assistant", content: message.content });
  }

  return out;
}

function parseInput(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toResult(text: string, toolCalls: ToolCall[], stopReason: string | null | undefined): ChatResult {
  return {
    content: text,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    stopReason: toolCalls.length ? "tool_call" : stopReason === "max_tokens" ? "length" : "end",
  };
}

async function readMessageStream(response: Response, options: ChatOptions): Promise<ChatResult> {
  // Content blocks stream in by index. Text blocks emit text_delta pieces; tool_use blocks emit
  // input_json_delta pieces that only form valid JSON once the block is complete.
  const blocks = new Map<number, { type: string; id?: string; name?: string; text: string; json: string }>();
  let stopReason: string | null = null;

  await readSse(response, ({ event, data }) => {
    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    switch (payload.type ?? event) {
      case "content_block_start":
        blocks.set(payload.index, {
          type: payload.content_block?.type,
          id: payload.content_block?.id,
          name: payload.content_block?.name,
          text: "",
          json: "",
        });
        break;

      case "content_block_delta": {
        const block = blocks.get(payload.index);
        if (!block) break;
        if (payload.delta?.type === "text_delta" && typeof payload.delta.text === "string") {
          block.text += payload.delta.text;
          options.onText?.(payload.delta.text);
        } else if (payload.delta?.type === "input_json_delta") {
          block.json += payload.delta.partial_json ?? "";
        }
        break;
      }

      case "message_delta":
        if (payload.delta?.stop_reason) stopReason = payload.delta.stop_reason;
        break;

      case "error":
        throw new AiProviderError(`Anthropic API error: ${String(payload.error?.message ?? "stream error").slice(0, 300)}`);
    }
  });

  const ordered = [...blocks.entries()].sort(([a], [b]) => a - b).map(([, block]) => block);
  const text = ordered.filter((b) => b.type === "text").map((b) => b.text).join("");
  const toolCalls: ToolCall[] = ordered
    .filter((b) => b.type === "tool_use" && b.id && b.name)
    .map((b) => ({ id: b.id!, name: b.name!, arguments: parseInput(b.json) }));

  return toResult(text, toolCalls, stopReason);
}

export const anthropicAdapter: AIProviderAdapter = {
  async chat(request: ChatRequest, credentials: ProviderCredentials, options: ChatOptions = {}): Promise<ChatResult> {
    if (!credentials.apiKey) {
      throw new AiProviderError("Anthropic requires an API key.");
    }

    const streaming = Boolean(options.onText);
    const systemPrompt = request.system ?? request.messages.find((m) => m.role === "system")?.content;
    // The base URL can be user-supplied, so it is validated (and its DNS checked) before every request.
    const url = await resolveProviderUrl(credentials.baseUrl || "https://api.anthropic.com", "/v1/messages");

    const res = await fetch(url, {
      method: "POST",
      redirect: "error", // a public host must not be able to bounce this request to an internal one
      signal: options.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": credentials.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        system: systemPrompt,
        messages: toAnthropicMessages(request.messages),
        tools: request.tools?.map(toAnthropicTool),
        ...(streaming ? { stream: true } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiProviderError(`Anthropic API error (${res.status}): ${body.slice(0, 300)}`, res.status);
    }

    // Trust the response's actual content-type over whether we asked for streaming - see the
    // matching comment in openai-compatible.ts.
    const isEventStream = (res.headers.get("content-type") ?? "").includes("text/event-stream");
    if (isEventStream) return readMessageStream(res, options);

    const data = await res.json();
    const blocks: AnthropicContentBlock[] = data.content ?? [];
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const toolCalls: ToolCall[] = blocks
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ id: b.id!, name: b.name!, arguments: (b.input ?? {}) as Record<string, unknown> }));

    const result = toResult(text, toolCalls, data.stop_reason);
    if (streaming && text) options.onText!(text);
    return result;
  },
};
