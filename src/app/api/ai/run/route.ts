import { NextResponse } from "next/server";
import { z } from "zod";
import { finishAiRequest, resolveAiRequest } from "@/lib/ai/credentials";
import { AI_FEATURES } from "@/lib/ai/features";
import { aiErrorResponse } from "@/lib/ai/http";

const bodySchema = z.object({
  feature: z.string().min(1).max(40),
  input: z.unknown(),
  apiKeyId: z.string().optional(),
  useShared: z.boolean().optional(),
});

/**
 * One endpoint for every single-shot AI feature (fixtures, API mocks, cron,
 * error explainer, JSON assist, profile/palette steering, history search).
 * Adding a feature = adding an entry to AI_FEATURES; no new route needed.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!Object.prototype.hasOwnProperty.call(AI_FEATURES, parsed.data.feature)) {
    return NextResponse.json({ error: "Unknown AI feature." }, { status: 404 });
  }
  const feature = AI_FEATURES[parsed.data.feature];

  // Validate input before touching auth/usage so bad requests fail cheaply.
  let input: unknown;
  try {
    input = feature.parse(parsed.data.input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      return NextResponse.json({ error: issue?.message ?? "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  try {
    const resolved = await resolveAiRequest({
      apiKeyId: parsed.data.apiKeyId,
      useShared: parsed.data.useShared,
    });

    const result = await feature.run(
      {
        userId: resolved.userId,
        providerId: resolved.providerId,
        model: resolved.model,
        credentials: resolved.credentials,
      },
      input
    );

    await finishAiRequest(resolved);
    return NextResponse.json({ result });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
