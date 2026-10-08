import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** "Sign out everywhere": invalidates every session issued so far, on every device, including this one. */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await prisma.user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } });
  return NextResponse.json({ ok: true });
}
