import { getProviderMeta } from "@/lib/ai/registry";
import { AGENT_TOOLS, getAgentTool, type AgentToolContext } from "@/lib/ai/tools";
import { type AiProviderId, type ChatMessage, type ProviderCredentials } from "@/lib/ai/types";

const SYSTEM_PROMPT = `You are the GenifySuite assistant, embedded in a developer-tools web app.
You can call tools to generate passwords, UUIDs, fake test profiles, lorem ipsum, color palettes and
dummy test card numbers; to format JSON; to compute the next run times of a cron expression; and to
list the user's saved history. Use a tool whenever the request needs generated data or a deterministic
result rather than describing how you'd do it.
For writing, explaining, converting or debugging requests (explaining an error, writing SQL, drafting
a mock API response, producing fake records that match a schema, turning a description into a cron
expression) answer directly yourself - no tool needed. The one exception: whenever you produce a cron
expression, call cron_next_runs on it first and only present it if it validates.
Keep replies brief: the result itself is the point, not commentary.`;

const MAX_TURNS = 4;

export interface AgentStep {
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface AgentRunResult {
  reply: string;
  steps: AgentStep[];
}

/** Events emitted while the agent runs, in the order they happen. */
export type AgentEvent = { type: "text"; delta: string } | { type: "step"; step: AgentStep };

export interface AgentRunOptions {
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

/**
 * Runs the request/tool-call/tool-result loop until the model returns a final answer (or
 * MAX_TURNS is hit, as a safety valve against a model that keeps calling tools indefinitely).
 *
 * If `onEvent` is provided the provider is streamed: text arrives as `text` events token by
 * token, and each tool result arrives as a `step` event the moment the tool finishes.
 */
export async function runAgent(
  providerId: AiProviderId,
  model: string,
  credentials: ProviderCredentials,
  history: ChatMessage[],
  toolContext: AgentToolContext,
  options: AgentRunOptions = {}
): Promise<AgentRunResult> {
  const { adapter } = getProviderMeta(providerId);
  const { onEvent, signal } = options;
  const steps: AgentStep[] = [];
  const messages: ChatMessage[] = [...history];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    signal?.throwIfAborted();

    const result = await adapter.chat(
      {
        messages,
        tools: AGENT_TOOLS.map((t) => t.definition),
        model,
        system: SYSTEM_PROMPT,
        maxTokens: 1024,
      },
      credentials,
      { onText: onEvent ? (delta) => onEvent({ type: "text", delta }) : undefined, signal }
    );

    if (result.stopReason !== "tool_call" || !result.toolCalls?.length) {
      return { reply: result.content, steps };
    }

    messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });

    for (const call of result.toolCalls) {
      signal?.throwIfAborted();

      const tool = getAgentTool(call.name);
      let output: unknown;
      try {
        output = tool ? await tool.execute(call.arguments, toolContext) : { error: `Unknown tool: ${call.name}` };
      } catch (err) {
        output = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }

      const step: AgentStep = { tool: call.name, arguments: call.arguments, result: output };
      steps.push(step);
      onEvent?.({ type: "step", step });

      messages.push({
        role: "tool",
        content: JSON.stringify(output),
        toolCallId: call.id,
        toolName: call.name,
      });
    }
  }

  const fallback = "That took more steps than I allow in one go. Try breaking it into a simpler request.";
  onEvent?.({ type: "text", delta: fallback });
  return { reply: fallback, steps };
}
