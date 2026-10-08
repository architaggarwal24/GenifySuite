import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Anything that would touch a real database is mocked (see test/fake-prisma.ts), so the suite
    // runs anywhere with no DATABASE_URL, no network, and no generated Prisma engine.
    // Each test starts with spies restored AND call history cleared, so one test's emails/calls can't leak into the next.
    restoreMocks: true,
    clearMocks: true,
  },
});
