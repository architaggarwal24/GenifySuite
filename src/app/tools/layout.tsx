import { getServerSession } from "next-auth";
import { type ReactNode } from "react";
import { ToolAccessProvider } from "@/components/tool-access";
import { authOptions } from "@/lib/auth";

// Reads the session, so these pages are rendered per request.
export const dynamic = "force-dynamic";

/**
 * Every /tools route sits under this layout. It resolves the session on the server and hands the
 * result to <ToolShell>, which shows the real tool only to signed-in people and a locked preview
 * (plus the login/signup popup) to everyone else.
 */
export default async function ToolsLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  return <ToolAccessProvider authed={Boolean(session?.user?.id)}>{children}</ToolAccessProvider>;
}
