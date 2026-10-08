import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Conservative response headers that can't break the app. A full script-src Content-Security-Policy is
// deliberately NOT included: the app uses an inline theme script and Next's own inline scripts, so a strict
// policy needs per-request nonces (which turns every page dynamic) and should be tested in a real browser.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pins the workspace root to this project. Without it, a stray lockfile in a parent
  // folder (e.g. C:\Archit\Projects\package-lock.json) makes Next.js guess the wrong root
  // and print a "multiple lockfiles" warning on every `next dev`/`next build`.
  outputFileTracingRoot: projectRoot,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
