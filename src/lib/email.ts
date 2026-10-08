export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailResult {
  delivered: boolean;
  via: "resend" | "console" | "none";
}

/**
 * Sends a transactional email. Never throws - callers decide what a failed delivery means.
 *  - RESEND_API_KEY (+ EMAIL_FROM) set: sends via Resend's HTTP API.
 *  - Not set, outside production: prints the email (including its links) to the server console, so the
 *    whole sign-up / reset flow works locally with zero setup.
 *  - Not set, in production: logs an error and reports not-delivered. Emails contain one-time links, so
 *    they are never written to production logs.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    const from = process.env.EMAIL_FROM;
    if (!from) {
      console.error("[email] RESEND_API_KEY is set but EMAIL_FROM is not, so this email was NOT sent.");
      return { delivered: false, via: "none" };
    }
    try {
      const base = (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "");
      const res = await fetch(`${base}/emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.error(`[email] Resend rejected the message (${res.status}):`, (await res.text().catch(() => "")).slice(0, 300));
        return { delivered: false, via: "resend" };
      }
      return { delivered: true, via: "resend" };
    } catch (err) {
      console.error("[email] couldn't reach Resend:", err);
      return { delivered: false, via: "resend" };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `\n[email - dev mode: no RESEND_API_KEY is set, so nothing is actually sent]\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`
    );
    return { delivered: true, via: "console" };
  }

  console.error(`[email] RESEND_API_KEY is not set, so "${message.subject}" was NOT sent.`);
  return { delivered: false, via: "none" };
}
