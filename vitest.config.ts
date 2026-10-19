import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // The streaming tests push responses through a real local HTTP server a few bytes at a time. That is
    // a lot of tiny socket writes, which can take several seconds on Windows, so the 5s default is too tight.
    testTimeout: 20_000,
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Anything that would touch a real database is mocked (see test/fake-prisma.ts), so the suite
    // runs anywhere with no DATABASE_URL, no network, and no generated Prisma engine.
    // Each test starts with spies restored AND call history cleared, so one test's emails/calls can't leak into the next.
    restoreMocks: true,
    clearMocks: true,
  },
});
