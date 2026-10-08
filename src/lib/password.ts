const CHAR_SETS = {
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ", // no I/O to avoid visual ambiguity
  lowercase: "abcdefghijkmnopqrstuvwxyz", // no l
  numbers: "23456789", // no 0/1
  symbols: "!@#$%^&*()-_=+[]{}",
};

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

function secureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export function generatePassword(options: PasswordOptions): string {
  const pools: string[] = [];
  if (options.uppercase) pools.push(CHAR_SETS.uppercase);
  if (options.lowercase) pools.push(CHAR_SETS.lowercase);
  if (options.numbers) pools.push(CHAR_SETS.numbers);
  if (options.symbols) pools.push(CHAR_SETS.symbols);

  if (pools.length === 0) return "";

  const fullPool = pools.join("");
  const length = Math.max(4, Math.min(options.length, 128));

  // Guarantee at least one char from each selected pool, then fill the rest.
  const chars: string[] = pools.map((pool) => pool[secureRandomInt(pool.length)]);
  while (chars.length < length) {
    chars.push(fullPool[secureRandomInt(fullPool.length)]);
  }

  // Fisher-Yates shuffle so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.slice(0, length).join("");
}

export type PasswordStrength = "Weak" | "Fair" | "Strong" | "Very strong";

export function estimatePasswordStrength(password: string): { bits: number; label: PasswordStrength } {
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  const bits = password.length > 0 ? Math.log2(Math.max(poolSize, 1)) * password.length : 0;

  let label: PasswordStrength = "Weak";
  if (bits >= 100) label = "Very strong";
  else if (bits >= 70) label = "Strong";
  else if (bits >= 45) label = "Fair";

  return { bits: Math.round(bits), label };
}
