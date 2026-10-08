export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 BYTES of a password and silently ignores the rest, so two different
// long passwords sharing a 72-byte prefix would be interchangeable. Refusing them is more honest than truncating.
export const MAX_PASSWORD_BYTES = 72;

// The passwords people (and attackers' wordlists) reach for first. Only entries of 8+ characters matter,
// since anything shorter already fails the length rule.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword",
  "password!", "password01", "passwordpassword", "12345678", "123456789", "1234567890", "12341234", "123123123",
  "987654321", "11111111", "00000000", "qwertyui", "qwertyuiop", "qwerty12", "qwerty123", "1q2w3e4r", "1qaz2wsx",
  "zaq12wsx", "qazwsxedc", "asdfghjk", "asdf1234", "zxcvbnm1", "abcd1234", "abc12345", "iloveyou", "iloveyou1",
  "admin123", "welcome1", "welcome123", "letmein1", "letmein123", "changeme", "changeme1", "trustno1", "baseball",
  "football", "football1", "monkey123", "dragon12", "sunshine", "princess", "superman", "batman123", "starwars",
  "master123", "hello123", "charlie1", "shadow12", "michael1", "jennifer", "computer", "internet", "whatever",
  "test1234", "testtest", "pass1234", "genifysuite", "genifysuite1", "genifysuite123",
]);

export interface PasswordContext {
  email?: string | null;
  name?: string | null;
}

/** Returns a user-facing reason the password is unacceptable, or null if it's fine. */
export function validatePassword(password: string, context: PasswordContext = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Password is too long (${MAX_PASSWORD_BYTES} bytes at most; some characters take more than one).`;
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "That password is too common. Choose something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "Password can't be a single repeated character.";

  const email = context.email?.toLowerCase().trim();
  if (email) {
    const local = email.split("@")[0];
    if (lower === email || (local.length >= 4 && lower.includes(local))) return "Password can't contain your email address.";
  }
  return null;
}
