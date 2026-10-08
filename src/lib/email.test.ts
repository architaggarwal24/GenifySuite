import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAppUrl } from "./app-url";
import { sendEmail } from "./email";
import { escapeHtml, passwordChangedEmail, passwordResetEmail, verificationEmail } from "./email-templates";
import { jsonResponse, startServer, type TestServer } from "../../test/helpers/http";

const MESSAGE = { to: "alice@example.com", subject: "Hello", text: "plain body with https://x.test/reset?token=SECRET", html: "<p>hi</p>" };

let server: TestServer | undefined;
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("RESEND_API_URL", "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await server?.close();
  server = undefined;
});

describe("sendEmail", () => {
  it("sends through Resend with the right request", async () => {
    server = await startServer((_req, res) => jsonResponse(res, { id: "abc" }));
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "GenifySuite <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", server.url);

    expect(await sendEmail(MESSAGE)).toEqual({ delivered: true, via: "resend" });
    const req = server.requests[0];
    expect(req.url).toBe("/emails");
    expect(req.headers.authorization).toBe("Bearer re_test_key");
    expect(req.body).toEqual({ from: "GenifySuite <hello@example.com>", to: ["alice@example.com"], subject: "Hello", html: "<p>hi</p>", text: MESSAGE.text });
  });

  it("reports (and never throws on) a rejected message", async () => {
    server = await startServer((_req, res) => jsonResponse(res, { message: "domain not verified" }, 403));
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "x@example.com");
    vi.stubEnv("RESEND_API_URL", server.url);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendEmail(MESSAGE)).toEqual({ delivered: false, via: "resend" });
    expect(log).toHaveBeenCalled();
  });

  it("reports (and never throws on) an unreachable provider", async () => {
    const dead = await startServer(() => {});
    const url = dead.url;
    await dead.close();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "x@example.com");
    vi.stubEnv("RESEND_API_URL", url);
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendEmail(MESSAGE)).toEqual({ delivered: false, via: "resend" });
  });

  it("refuses to send when a key is set but no From address is", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendEmail(MESSAGE)).toEqual({ delivered: false, via: "none" });
  });

  it("prints the email to the console in development, so the whole flow works with no setup", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await sendEmail(MESSAGE)).toEqual({ delivered: true, via: "console" });
    expect(log.mock.calls.flat().join(" ")).toContain("token=SECRET");
  });

  it("in production with no key: reports not-delivered and NEVER writes the one-time link to the logs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(await sendEmail(MESSAGE)).toEqual({ delivered: false, via: "none" });
    expect(JSON.stringify([...err.mock.calls, ...log.mock.calls])).not.toContain("SECRET");
  });
});

describe("app URL for emailed links", () => {
  const evil = new Request("https://evil.example/api/auth/forgot-password", { headers: { host: "evil.example" } });

  it("uses the configured URL, never the request's Host header, in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "https://app.example.com/");
    expect(getAppUrl(evil)).toBe("https://app.example.com");
  });

  it("returns null in production when nothing is configured, rather than trusting the request", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(getAppUrl(evil)).toBeNull();
  });

  it("falls back to Vercel's URL, and to the request origin only outside production", () => {
    vi.stubEnv("NEXTAUTH_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");
    expect(getAppUrl()).toBe("https://my-app.vercel.app");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getAppUrl(new Request("http://localhost:3000/x"))).toBe("http://localhost:3000");
  });
});

describe("email templates", () => {
  const link = "https://app.example.com/reset-password?token=abc123";

  it("include the link in both the text and HTML versions", () => {
    for (const mail of [verificationEmail({ name: "Alice", link }), passwordResetEmail({ name: "Alice", link })]) {
      expect(mail.text).toContain(link);
      expect(mail.html).toContain(link);
      expect(mail.subject.length).toBeGreaterThan(5);
    }
    expect(passwordChangedEmail({ name: "Alice" }).text).toMatch(/changed/);
  });

  it("escape user-controlled text so a name can't inject markup into the email", () => {
    const mail = passwordResetEmail({ name: '<script>alert("x")</script>', link });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });

  it("escapes the link inside attributes too", () => {
    const mail = verificationEmail({ link: 'https://x.test/?a="><script>1</script>' });
    expect(mail.html).not.toContain('"><script>');
  });

  it("greets by name, or neutrally with none", () => {
    expect(verificationEmail({ name: "Alice", link }).text).toMatch(/^Hi Alice,/);
    expect(verificationEmail({ link }).text).toMatch(/^Hi,/);
  });
});
