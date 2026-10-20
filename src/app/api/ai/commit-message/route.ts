import { NextResponse } from "next/server";
import { z } from "zod";
import { complete } from "@/lib/ai/complete";
import { refundIfFree, resolveAiRequest, type ResolvedAiRequest } from "@/lib/ai/credentials";
import { aiErrorResponse } from "@/lib/ai/http";

const SYSTEM_PROMPT = `You write git commit messages in the Conventional Commits style
(type(scope): summary), from a diff or a plain description of changes. Respond with ONLY the
commit message - a one-line summary (under 72 chars), then, if it genuinely adds information,
a blank line and a short body as bullet points. No markdown fences, no commentary before or after.`;

const requestSchema = z.object({
  changes: z.string().min(1).max(6000),
  apiKeyId: z.string().optional(),
  useShared: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  let resolved: ResolvedAiRequest | undefined;
  try {
    resolved = await resolveAiRequest({
      apiKeyId: parsed.data.apiKeyId,
      useShared: parsed.data.useShared,
    });

    const message = await complete(
      resolved.providerId,
      resolved.model,
      resolved.credentials,
      SYSTEM_PROMPT,
      parsed.data.changes
    );

    return NextResponse.json({ message });
  } catch (err) {
    await refundIfFree(resolved, err);
    return aiErrorResponse(err);
  }
}
