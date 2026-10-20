import { NextResponse } from "next/server";
import { z } from "zod";
import { complete } from "@/lib/ai/complete";
import { refundIfFree, resolveAiRequest, type ResolvedAiRequest } from "@/lib/ai/credentials";
import { aiErrorResponse } from "@/lib/ai/http";

const SYSTEM_PROMPT = `You write regular expressions from a plain-English description. Respond with
ONLY a JSON object, no markdown fences, no commentary, matching this exact shape:
{"regex": "the pattern, no slashes or flags wrapper", "flags": "any flags like gi, or empty string", "explanation": "one or two sentences explaining how it works", "example_match": "a short realistic string it would match"}`;

const requestSchema = z.object({
  description: z.string().min(1).max(500),
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

    const raw = await complete(
      resolved.providerId,
      resolved.model,
      resolved.credentials,
      SYSTEM_PROMPT,
      parsed.data.description
    );

    const cleaned = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    let result: { regex: string; flags: string; explanation: string; example_match: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "The model returned something unparsable — try rephrasing." }, { status: 502 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    await refundIfFree(resolved, err);
    return aiErrorResponse(err);
  }
}
