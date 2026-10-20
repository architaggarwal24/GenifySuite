/**
 * Refuses to run in production with secrets that are missing, tiny, or still the placeholder from
 * .env.example - a forgotten placeholder would let anyone forge session tokens. Only names are reported,
 * never values.
 */

type Env = Record<string, string | undefined>;

const PLACEHOLDER = /^(replace[-_ ]?with|change[-_ ]?me|your[-_ ]|example|test[-_]?secret|secret$|password$)/i;

function isWeak(value: string | undefined, minLength: number): boolean {
  const v = (value ?? "").trim();
  return v.length < minLength || PLACEHOLDER.test(v);
}

export function findWeakSecrets(env: Env): string[] {
  const weak: string[] = [];
  if (isWeak(env.NEXTAUTH_SECRET, 32)) weak.push("NEXTAUTH_SECRET");
  // A blank ENCRYPTION_KEY already makes saving keys fail loudly; only judge one that is set.
  if ((env.ENCRYPTION_KEY ?? "").trim() !== "" && isWeak(env.ENCRYPTION_KEY, 16)) weak.push("ENCRYPTION_KEY");
  return weak;
}

export function assertProductionSecrets(env: Env = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const weak = findWeakSecrets(env);
  if (weak.length > 0) {
    throw new Error(
      `Refusing to run: ${weak.join(", ")} ${weak.length === 1 ? "is" : "are"} missing, too short, or still a placeholder. ` +
        `Generate a random value (e.g. \`openssl rand -base64 32\`) and set it in the environment.`
    );
  }
}
