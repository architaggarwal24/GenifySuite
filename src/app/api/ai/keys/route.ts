import { type AiProvider } from "@prisma/client";
import { type ApiKey } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { encryptSecret, maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { PROVIDERS } from "@/lib/ai/registry";

const createSchema = z.object({
  provider: z.string().min(1),
  label: z.string().min(1).max(60),
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().max(500).optional(),
  defaultModel: z.string().min(1).max(120),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Never return the encrypted secret to the client - just enough to
  // display and let them tell keys apart.
  const safe = keys.map((k: ApiKey) => ({
    id: k.id,
    provider: k.provider,
    label: k.label,
    baseUrl: k.baseUrl,
    defaultModel: k.defaultModel,
    hasSecret: Boolean(k.secret),
    createdAt: k.createdAt,
  }));

  return NextResponse.json({ keys: safe });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const providerId = parsed.data.provider.toLowerCase();
  const meta = PROVIDERS[providerId as keyof typeof PROVIDERS];
  if (!meta) return NextResponse.json({ error: "Unknown provider" }, { status: 400 });

  if (meta.keyRequired && !parsed.data.apiKey) {
    return NextResponse.json({ error: `${meta.label} requires an API key.` }, { status: 400 });
  }
  if (meta.baseUrlConfigurable && !meta.defaultBaseUrl && !parsed.data.baseUrl) {
    return NextResponse.json({ error: `${meta.label} requires a base URL.` }, { status: 400 });
  }

  const key = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      provider: providerId.toUpperCase() as AiProvider,
      label: parsed.data.label,
      baseUrl: parsed.data.baseUrl || null,
      secret: parsed.data.apiKey ? encryptSecret(parsed.data.apiKey) : null,
      defaultModel: parsed.data.defaultModel,
    },
  });

  return NextResponse.json({
    key: {
      id: key.id,
      provider: key.provider,
      label: key.label,
      baseUrl: key.baseUrl,
      defaultModel: key.defaultModel,
      hasSecret: Boolean(key.secret),
      createdAt: key.createdAt,
      maskedSecret: parsed.data.apiKey ? maskSecret(parsed.data.apiKey) : null,
    },
  });
}
