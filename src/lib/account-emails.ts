import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail, passwordResetEmail, verificationEmail } from "@/lib/email-templates";
import { createEmailToken } from "@/lib/tokens";

interface Recipient {
  name?: string | null;
  email: string;
}

/** Issues a verification token and emails the link. Returns whether the email was handed off for delivery. */
export async function sendVerificationEmail(user: Recipient, baseUrl: string | null): Promise<boolean> {
  if (!baseUrl) {
    console.error("[account-emails] Can't build a link: set NEXTAUTH_URL so emailed links point at your site.");
    return false;
  }
  const raw = await createEmailToken("verify", user.email);
  const link = `${baseUrl}/verify-email?token=${encodeURIComponent(raw)}`;
  return (await sendEmail({ to: user.email, ...verificationEmail({ name: user.name, link }) })).delivered;
}

export async function sendPasswordResetEmail(user: Recipient, baseUrl: string | null): Promise<boolean> {
  if (!baseUrl) {
    console.error("[account-emails] Can't build a link: set NEXTAUTH_URL so emailed links point at your site.");
    return false;
  }
  const raw = await createEmailToken("reset", user.email);
  const link = `${baseUrl}/reset-password?token=${encodeURIComponent(raw)}`;
  return (await sendEmail({ to: user.email, ...passwordResetEmail({ name: user.name, link }) })).delivered;
}

export async function sendPasswordChangedEmail(user: Recipient): Promise<boolean> {
  return (await sendEmail({ to: user.email, ...passwordChangedEmail({ name: user.name }) })).delivered;
}

export { getAppUrl };
