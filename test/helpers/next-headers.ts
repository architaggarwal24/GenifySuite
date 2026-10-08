import { createRequire } from "node:module";

// NextAuth's route handler and getServerSession() call require("next/headers") at request time and read
// cookies/headers from the current Next.js request scope - which doesn't exist in a unit test. This swaps
// in a controllable fake in Node's require cache so the REAL next-auth code can run, unmodified.
const nodeRequire = createRequire(import.meta.url);

let cookieJar: { name: string; value: string }[] = [];
let requestHeaders = new Headers();

export function setRequestContext(context: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}): void {
  cookieJar = Object.entries(context.cookies ?? {}).map(([name, value]) => ({ name, value }));
  requestHeaders = new Headers(context.headers ?? {});
}

export function installNextHeadersFake(): void {
  const path = nodeRequire.resolve("next/headers");
  nodeRequire.cache[path] = {
    id: path,
    filename: path,
    loaded: true,
    children: [],
    paths: [],
    exports: {
      headers: async () => requestHeaders,
      cookies: async () => ({ getAll: () => cookieJar }),
    },
  } as unknown as NodeModule;
}
