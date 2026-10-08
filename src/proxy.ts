import type { NextFetchEvent } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";

// Redirects signed-out visitors away from protected pages straight to our own /login page
// (instead of bouncing through NextAuth's default /api/auth/signin first).
const authMiddleware = withAuth({ pages: { signIn: "/login" } });

// Next.js 16 renamed the "middleware" file convention to "proxy", and its build requires a real
// function export. The old one-liner `export { default } from "next-auth/middleware"` is a
// re-export the build can't see through, which made `next build` fail outright on Next 16.
// Note this is a coarse first gate only: every protected page and API route also checks the
// session itself, so nothing depends on this file alone.
export function proxy(request: NextRequestWithAuth, event: NextFetchEvent) {
  return authMiddleware(request, event);
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
