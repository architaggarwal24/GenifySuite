export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f0e7;font-family:Arial,Helvetica,sans-serif;color:#1b1f27">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #ddd6c7;border-radius:6px">
<tr><td style="padding:28px 28px 8px;font-size:13px;color:#b36e0f;font-weight:bold">GenifySuite</td></tr>
<tr><td style="padding:0 28px 8px;font-size:20px;font-weight:bold">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.55">${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:22px 0"><a href="${escapeHtml(href)}" style="background:#e8a33d;color:#12151b;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:4px;display:inline-block">${escapeHtml(label)}</a></p>
<p style="font-size:13px;color:#5b5850">Button not working? Paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(href)}</span></p>`;
}

const greeting = (name?: string | null) => (name?.trim() ? `Hi ${name.trim()},` : "Hi,");

export function verificationEmail({ name, link }: { name?: string | null; link: string }): Rendered {
  return {
    subject: "Verify your email for GenifySuite",
    text: `${greeting(name)}\n\nConfirm your email address to finish setting up GenifySuite:\n\n${link}\n\nThe link works once and expires in 24 hours. If you didn't create an account, you can ignore this email.`,
    html: shell(
      "Confirm your email address",
      `<p>${escapeHtml(greeting(name))}</p><p>Confirm your email address to finish setting up your account.</p>${button(link, "Confirm email")}<p style="font-size:13px;color:#5b5850">The link works once and expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`
    ),
  };
}

export function passwordResetEmail({ name, link }: { name?: string | null; link: string }): Rendered {
  return {
    subject: "Reset your GenifySuite password",
    text: `${greeting(name)}\n\nSomeone asked to reset the password for this account. To choose a new one, open:\n\n${link}\n\nThe link works once and expires in 1 hour. If this wasn't you, you can ignore this email - your password won't change.`,
    html: shell(
      "Reset your password",
      `<p>${escapeHtml(greeting(name))}</p><p>Someone asked to reset the password for this account.</p>${button(link, "Choose a new password")}<p style="font-size:13px;color:#5b5850">The link works once and expires in 1 hour. If this wasn't you, you can ignore this email - your password won't change.</p>`
    ),
  };
}

export function passwordChangedEmail({ name }: { name?: string | null }): Rendered {
  return {
    subject: "Your GenifySuite password was changed",
    text: `${greeting(name)}\n\nThe password for your GenifySuite account was just changed, and any other signed-in devices were signed out.\n\nIf this was you, there's nothing to do. If it wasn't, reset your password right away from the sign-in page and contact us.`,
    html: shell(
      "Your password was changed",
      `<p>${escapeHtml(greeting(name))}</p><p>The password for your GenifySuite account was just changed, and any other signed-in devices were signed out.</p><p>If this was you, there's nothing to do. If it wasn't, reset your password right away from the sign-in page.</p>`
    ),
  };
}
