export interface ToolMeta {
  slug: string;
  name: string;
  description: string;
  category: "Card tools" | "Data & text" | "Dev utilities" | "Network" | "AI tools";
  /** Name resolved by src/components/tool-icon.tsx - kept as a string so this file has no React/bundle cost. */
  icon: string;
}

export const TOOLS: ToolMeta[] = [
  {
    slug: "ai-agent",
    name: "AI agent",
    description: "Describe what you need in plain English — the agent calls the right tools for you.",
    category: "AI tools",
    icon: "bot",
  },
  {
    slug: "regex-generator",
    name: "Regex generator",
    description: "Describe a pattern in English, get a tested regular expression back.",
    category: "AI tools",
    icon: "scan-line",
  },
  {
    slug: "commit-message",
    name: "Commit message writer",
    description: "Paste a diff or describe your changes, get a Conventional Commits message.",
    category: "AI tools",
    icon: "terminal",
  },
  {
    slug: "fixtures",
    name: "Schema to fake data",
    description: "Paste a JSON Schema or TypeScript interface, get realistic records that match it.",
    category: "AI tools",
    icon: "database",
  },
  {
    slug: "api-mock",
    name: "API mock generator",
    description: "Describe an endpoint, get a realistic mock HTTP response to build against.",
    category: "AI tools",
    icon: "server",
  },
  {
    slug: "cron",
    name: "Cron builder & explainer",
    description: "Plain English to cron and back, with the next run times computed and checked.",
    category: "AI tools",
    icon: "clock",
  },
  {
    slug: "error-explainer",
    name: "Error explainer",
    description: "Paste an error or stack trace, get a plain-English diagnosis and fix steps.",
    category: "AI tools",
    icon: "bug",
  },
  {
    slug: "validator",
    name: "Card validator",
    description: "Check whether a card number passes the Luhn checksum and identify its network.",
    category: "Card tools",
    icon: "credit-card",
  },
  {
    slug: "card-generator",
    name: "Test card generator",
    description: "Generate Luhn-valid dummy card numbers for checkout-form QA. Never real, chargeable cards.",
    category: "Card tools",
    icon: "credit-card",
  },
  {
    slug: "profile-generator",
    name: "Profile generator",
    description: "Create a fake name, email, address, and phone number for seeding test data.",
    category: "Data & text",
    icon: "user",
  },
  {
    slug: "lorem-ipsum",
    name: "Lorem ipsum generator",
    description: "Placeholder text by words, sentences, or paragraphs.",
    category: "Data & text",
    icon: "type",
  },
  {
    slug: "json-formatter",
    name: "JSON formatter",
    description: "Format, minify, and validate JSON with clear error locations.",
    category: "Dev utilities",
    icon: "file-json",
  },
  {
    slug: "password-generator",
    name: "Password generator",
    description: "Cryptographically random passwords with a live strength estimate.",
    category: "Dev utilities",
    icon: "key",
  },
  {
    slug: "uuid-generator",
    name: "UUID generator",
    description: "Bulk-generate v4 UUIDs, or time-ordered IDs for sortable test fixtures.",
    category: "Dev utilities",
    icon: "hash",
  },
  {
    slug: "color-palette",
    name: "Color palette generator",
    description: "Build complementary, analogous, or triadic palettes from a base color.",
    category: "Dev utilities",
    icon: "palette",
  },
  {
    slug: "qr-generator",
    name: "QR code generator",
    description: "Turn a URL or block of text into a downloadable QR code.",
    category: "Dev utilities",
    icon: "scan-line",
  },
  {
    slug: "ip-finder",
    name: "IP address finder",
    description: "Look up the approximate location and network for any public IP address.",
    category: "Network",
    icon: "globe",
  },
];

export const CATEGORY_ORDER: ToolMeta["category"][] = [
  "AI tools",
  "Card tools",
  "Data & text",
  "Dev utilities",
  "Network",
];

export function getToolBySlug(slug: string): ToolMeta | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}
