import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_WORKFLOWS_PER_USER = 30;

const createSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40),
  prompt: z.string().trim().min(1, "There's no prompt to save.").max(1000),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const workflows = await prisma.workflow.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prompt: true },
  });

  return NextResponse.json({ workflows });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const count = await prisma.workflow.count({ where: { userId: session.user.id } });
  if (count >= MAX_WORKFLOWS_PER_USER) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_WORKFLOWS_PER_USER} workflows. Remove one first.` },
      { status: 400 }
    );
  }

  const workflow = await prisma.workflow.create({
    data: { userId: session.user.id, name: parsed.data.name, prompt: parsed.data.prompt },
    select: { id: true, name: true, prompt: true },
  });

  return NextResponse.json({ workflow });
}
