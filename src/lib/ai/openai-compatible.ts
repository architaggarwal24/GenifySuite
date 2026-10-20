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

interface OpenAiToolCall {
  id: string;
  type?: "function";
  function: { name: string; arguments: string };
}

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  name?: string;
}

function toOpenAiTool(tool: ToolDefinition) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function toOpenAiMessages(messages: ChatMessage[], system?: string): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  if (system) out.push({ role: "system", content: system });

  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "tool") {
      out.push({
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
        name: message.toolName,
      });
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: message.content || null,
        // `type: "function"` is required by the OpenAI API on every tool call echoed back to it.
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      });
      continue;
    }

    out.push({ role: message.role, content: message.content });
  }

  return out;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    // Some local models occasionally emit malformed JSON args; fail soft with empty args
    // rather than crashing the whole request.
    return {};
  }
}

// Some servers (notably Ollama) report finish_reason "stop" even when the model asked for tools,
// so the presence of tool calls - not the finish reason - decides whether the loop continues.
function toResult(content: string, toolCalls: ToolCall[], finishReason: string | null | undefined): ChatResult {
  return {
    content,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    stopReason: toolCalls.length ? "tool_call" : finishReason === "length" ? "length" : "end",
  };
}

function parseCompletion(data: any): ChatResult {
  const choice = data.choices?.[0];
  const message = choice?.message;
  const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((call: OpenAiToolCall, i: number) => ({
    id: call.id || `call_${i}`,
    name: call.function.name,
    arguments: parseArgs(call.function.arguments),
  }));
  return toResult(message?.content ?? "", toolCalls, choice?.finish_reason);
}

async function readCompletionStream(response: Response, options: ChatOptions): Promise<ChatResult> {
  let content = "";
  let finishReason: string | null = null;
  // Tool calls arrive as fragments keyed by `index`: the id/name come first, then the JSON
  // arguments trickle in as string pieces that only parse once concatenated.
  const pending = new Map<number, { id: string; name: string; args: string }>();

  await readSse(response, ({ data }) => {
    if (data === "[DONE]") return;

    let chunk: any;
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }

    if (chunk.error) {
      throw new AiProviderError(`Provider error: ${String(chunk.error.message ?? JSON.stringify(chunk.error)).slice(0, 300)}`);
    }

    const choice = chunk.choices?.[0];
    if (!choice) return;

    const delta = choice.delta ?? {};
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      options.onText?.(delta.content);
    }

    for (const fragment of delta.tool_calls ?? []) {
      const index = typeof fragment.index === "number" ? fragment.index : 0;
      const current = pending.get(index) ?? { id: "", name: "", args: "" };
      if (fragment.id) current.id = fragment.id;
      if (fragment.function?.name) current.name = fragment.function.name;
      if (fragment.function?.arguments) current.args += fragment.function.arguments;
      pending.set(index, current);
    }

    if (choice.finish_reason) finishReason = choice.finish_reason;
  });

  const toolCalls: ToolCall[] = [...pending.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, call]) => call.name)
    .map(([index, call]) => ({ id: call.id || `call_${index}`, name: call.name, arguments: parseArgs(call.args) }));

  return toResult(content, toolCalls, finishReason);
}

/**
 * Most providers besides Anthropic (OpenAI itself, Ollama, NVIDIA NIM, and pretty much anything
 * self-hosted) speak the same `/chat/completions` shape, so one adapter covers all of them -
 * only the base URL and whether a key is required differ, which come from ProviderCredentials.
 */
export function createOpenAiCompatibleAdapter(defaultBaseUrl: string): AIProviderAdapter {
  return {
    async chat(request: ChatRequest, credentials: ProviderCredentials, options: ChatOptions = {}): Promise<ChatResult> {
      const baseUrl = (credentials.baseUrl || defaultBaseUrl).replace(/\/+$/, "");
      if (!baseUrl) {
        throw new AiProviderError("This provider needs a base URL configured.");
      }
      // The base URL can be user-supplied, so it is validated (and its DNS checked) before every request.
      const url = await resolveProviderUrl(baseUrl, "/chat/completions");

      const streaming = Boolean(options.onText);
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (credentials.apiKey) headers.authorization = `Bearer ${credentials.apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        redirect: "error", // a public host must not be able to bounce this request to an internal one
        headers,
        signal: options.signal,
        body: JSON.stringify({
          model: request.model,
          messages: toOpenAiMessages(request.messages, request.system),
          tools: request.tools?.map(toOpenAiTool),
          max_tokens: request.maxTokens ?? 1024,
          ...(streaming ? { stream: true } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new AiProviderError(`Provider error (${res.status}): ${body.slice(0, 300)}`, res.status);
      }

      // Trust the response's actual content-type over whether we asked for streaming: some
      // self-hosted/proxy OpenAI-compatible servers (a real risk for the Ollama/Custom BYOK
      // paths) stream regardless of the `stream` flag, or ignore it and return plain JSON.
      const isEventStream = (res.headers.get("content-type") ?? "").includes("text/event-stream");
      if (isEventStream) return readCompletionStream(res, options);

      const result = parseCompletion(await res.json());
      if (streaming && result.content) options.onText!(result.content);
      return result;
    },
  };
}
