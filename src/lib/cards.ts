// Luhn checksum validation and dummy test-number generation.
//
// IMPORTANT SCOPE NOTE (carried over from the v1 -> v2 rebuild):
// This module intentionally only supports a small, fixed set of generic
// network prefixes (the same ones card networks publish for their own
// sandbox/test-mode documentation, e.g. Stripe's 4242 4242 4242 4242).
// It does NOT accept an arbitrary user-supplied BIN, and it does NOT
// attach a fake balance/currency. That combination is the shape of
// "fullz" checker-tool output used for card fraud, not a checkout-UI
// testing utility, so it was deliberately left out of v2. See README.

export type CardNetwork = "Visa" | "Mastercard" | "American Express" | "Discover" | "Diners Club";

const NETWORK_PREFIXES: Record<CardNetwork, { prefixes: string[]; length: number }> = {
  Visa: { prefixes: ["4"], length: 16 },
  Mastercard: { prefixes: ["51", "52", "53", "54", "55"], length: 16 },
  "American Express": { prefixes: ["34", "37"], length: 15 },
  Discover: { prefixes: ["6011"], length: 16 },
  "Diners Club": { prefixes: ["300", "301", "302", "303", "304", "305", "36", "38"], length: 14 },
};

export function luhnCheckDigit(partialNumber: string): number {
  let sum = 0;
  let shouldDouble = true; // the check digit itself is the next "doubled" position

  for (let i = partialNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(partialNumber[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return (10 - (sum % 10)) % 10;
}

export function isLuhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 8) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function detectNetwork(cardNumber: string): CardNetwork | "Unknown" {
  const digits = cardNumber.replace(/\D/g, "");
  const two = digits.slice(0, 2);
  const four = digits.slice(0, 4);
  const one = digits.slice(0, 1);

  if (one === "4") return "Visa";
  if (["51", "52", "53", "54", "55"].includes(two)) return "Mastercard";
  if (["34", "37"].includes(two)) return "American Express";
  if (four === "6011") return "Discover";
  if (/^30[0-5]$/.test(digits.slice(0, 3)) || four === "3095" || ["36", "38", "39"].includes(two))
    return "Diners Club";
  return "Unknown";
}

export function formatCardNumber(digits: string): string {
  return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
}

export interface GeneratedTestCard {
  number: string; // formatted, e.g. "4242 4242 4242 4242"
  network: CardNetwork;
  expMonth: string;
  expYear: string;
  cvv: string;
}

/** Generates a Luhn-valid dummy number for UI/QA testing. Never a real, chargeable card. */
export function generateTestCard(network: CardNetwork): GeneratedTestCard {
  const config = NETWORK_PREFIXES[network];
  const prefix = config.prefixes[Math.floor(Math.random() * config.prefixes.length)];

  let digits = prefix;
  while (digits.length < config.length - 1) {
    digits += Math.floor(Math.random() * 10);
  }
  digits += luhnCheckDigit(digits);

  const now = new Date();
  const expMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const expYear = String(now.getFullYear() + 1 + Math.floor(Math.random() * 5)).slice(-2);
  const cvv = network === "American Express"
    ? String(1000 + Math.floor(Math.random() * 9000))
    : String(100 + Math.floor(Math.random() * 900));

  return {
    number: formatCardNumber(digits),
    network,
    expMonth,
    expYear,
    cvv,
  };
}

export const ALL_NETWORKS: CardNetwork[] = [
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
  "Diners Club",
];
