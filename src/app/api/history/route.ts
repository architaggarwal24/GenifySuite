import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { checkHistoryWrite } from "@/lib/history-limits";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  tool: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  payload: z.unknown(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const items = await prisma.historyItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const allowed = await checkHistoryWrite(session.user.id, parsed.data.payload);
  if (!allowed.ok) {
    return NextResponse.json(
      { error: allowed.error },
      { status: allowed.status, ...(allowed.retryAfterSeconds ? { headers: { "Retry-After": String(allowed.retryAfterSeconds) } } : {}) }
    );
  }

  const item = await prisma.historyItem.create({
    data: {
      userId: session.user.id,
      tool: parsed.data.tool,
      label: parsed.data.label,
      payload: parsed.data.payload as object,
    },
  });

  return NextResponse.json({ item });
}
