import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./safe-redirect";

describe("safeCallbackUrl (open-redirect protection)", () => {
  it.each(["/dashboard", "/", "/settings/ai", "/tools/cron?x=1#top", "/a/b/c"])("allows the same-site path %s", (path) => {
    expect(safeCallbackUrl(path)).toBe(path);
  });

  it.each([
    ["https://evil.example", "absolute URL"],
    ["http://evil.example/dashboard", "absolute http URL"],
    ["//evil.example", "protocol-relative URL"],
    ["/\\evil.example", "backslash variant"],
    ["javascript:alert(1)", "javascript: URL"],
    ["data:text/html,<script>alert(1)</script>", "data: URL"],
    ["dashboard", "no leading slash"],
    ["/\t/evil.example", "tab that browsers strip, leaving //"],
    ["/\n/evil.example", "newline that browsers strip, leaving //"],
    ["/\r/evil.example", "carriage return"],
    ["", "empty"],
    ["/" + "a".repeat(600), "absurdly long"],
  ])("rejects %s (%s)", (input) => {
    expect(safeCallbackUrl(input)).toBe("/dashboard");
  });

  it("falls back for null/undefined and honours a custom fallback", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
    expect(safeCallbackUrl("https://evil.example", "/home")).toBe("/home");
  });
});
