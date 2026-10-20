import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/ai/agent";
import { AGENT_LIMITS, checkAgentInput } from "@/lib/ai/agent-limits";
import { refundIfFree, resolveAiRequest } from "@/lib/ai/credentials";
import { aiErrorResponse } from "@/lib/ai/http";
import { ndjsonResponse } from "@/lib/ai/ndjson-response";
import { type ChatMessage } from "@/lib/ai/types";

// Streaming keeps the connection open while the model and tools run; give multi-step runs room.
export const maxDuration = 60;

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().max(AGENT_LIMITS.maxMessageChars, "A message is too long."),
  toolCalls: z
    .array(z.object({ id: z.string(), name: z.string(), arguments: z.record(z.unknown()) }))
    .optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(AGENT_LIMITS.maxMessages),
  apiKeyId: z.string().optional(),
  useShared: z.boolean().optional(),
  stream: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  // Every request resends the whole conversation to the model, so its total size is bounded (cost control).
  // Client-supplied "system" messages are dropped: the agent's instructions are set by the server only.
  const history = (parsed.data.messages as ChatMessage[]).filter((m) => m.role !== "system");
  const tooBig = checkAgentInput(history);
  if (tooBig) return NextResponse.json({ error: tooBig }, { status: 413 });
  if (history.length === 0) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Auth, key lookup, rate limit and daily cap all happen BEFORE streaming starts,
  // so those failures still come back as proper HTTP errors (401/429/...).
  let resolved;
  try {
    resolved = await resolveAiRequest({
      apiKeyId: parsed.data.apiKeyId,
      useShared: parsed.data.useShared,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }

  const toolContext = { userId: resolved.userId };

  if (parsed.data.stream) {
    return ndjsonResponse(request, async (emit, signal) => {
      try {
        await runAgent(resolved.providerId, resolved.model, resolved.credentials, history, toolContext, {
          onEvent: emit,
          signal,
        });
      } catch (err) {
        // The allowance was taken up front. Only a failure that cost nothing gets it back; a dropped
        // connection or a mid-stream error stays counted.
        await refundIfFree(resolved, err);
        throw err;
      }
      emit({ type: "done" });
    });
  }

  try {
    const result = await runAgent(resolved.providerId, resolved.model, resolved.credentials, history, toolContext);
    return NextResponse.json({ reply: result.reply, steps: result.steps });
  } catch (err) {
    await refundIfFree(resolved, err);
    return aiErrorResponse(err);
  }
}
