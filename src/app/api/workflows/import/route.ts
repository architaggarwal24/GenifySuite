import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_WORKFLOWS_PER_USER = 30;

const itemSchema = z.object({
  name: z.string().trim().min(1).max(40),
  prompt: z.string().trim().min(1).max(1000),
});

const bodySchema = z.object({ workflows: z.array(itemSchema).min(1).max(MAX_WORKFLOWS_PER_USER) });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That doesn't look like an exported workflows file." }, { status: 400 });
  }

  const existingCount = await prisma.workflow.count({ where: { userId: session.user.id } });
  const room = Math.max(0, MAX_WORKFLOWS_PER_USER - existingCount);
  const toImport = parsed.data.workflows.slice(0, room);

  if (toImport.length === 0) {
    return NextResponse.json(
      { error: `You're already at the ${MAX_WORKFLOWS_PER_USER}-workflow limit. Remove some first.` },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(
    toImport.map((w) => prisma.workflow.create({ data: { userId: session.user.id, name: w.name, prompt: w.prompt } }))
  );

  return NextResponse.json({
    imported: created.length,
    skipped: parsed.data.workflows.length - toImport.length,
  });
}
