import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/ai/agent";
import { finishAiRequest, resolveAiRequest } from "@/lib/ai/credentials";
import { aiErrorResponse } from "@/lib/ai/http";
import { ndjsonResponse } from "@/lib/ai/ndjson-response";
import { type ChatMessage } from "@/lib/ai/types";

// Streaming keeps the connection open while the model and tools run; give multi-step runs room.
export const maxDuration = 60;

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  toolCalls: z
    .array(z.object({ id: z.string(), name: z.string(), arguments: z.record(z.unknown()) }))
    .optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
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

  const history = parsed.data.messages as ChatMessage[];
  const toolContext = { userId: resolved.userId };

  if (parsed.data.stream) {
    return ndjsonResponse(request, async (emit, signal) => {
      await runAgent(resolved.providerId, resolved.model, resolved.credentials, history, toolContext, {
        onEvent: emit,
        signal,
      });
      // Only count the request once it has actually succeeded.
      await finishAiRequest(resolved);
      emit({ type: "done" });
    });
  }

  try {
    const result = await runAgent(resolved.providerId, resolved.model, resolved.credentials, history, toolContext);
    await finishAiRequest(resolved);
    return NextResponse.json({ reply: result.reply, steps: result.steps });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
