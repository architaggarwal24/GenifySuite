import { z } from "zod";
import { complete } from "@/lib/ai/complete";
import { AiOutputError } from "@/lib/ai/errors";
import { type AiProviderId, type ProviderCredentials } from "@/lib/ai/types";
import { type FakeProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export { AiOutputError };

export interface AiContext {
  userId: string;
  providerId: AiProviderId;
  model: string;
  credentials: ProviderCredentials;
}

export interface AiFeature {
  parse: (raw: unknown) => unknown;
  run: (ctx: AiContext, input: unknown) => Promise<unknown>;
}

function defineFeature<S extends z.ZodTypeAny>(def: {
  input: S;
  run: (ctx: AiContext, input: z.infer<S>) => Promise<unknown>;
}): AiFeature {
  return {
    parse: (raw) => def.input.parse(raw),
    run: (ctx, input) => def.run(ctx, input as z.infer<S>),
  };
}

function ask(ctx: AiContext, system: string, user: string, maxTokens?: number): Promise<string> {
  return complete(ctx.providerId, ctx.model, ctx.credentials, system, user, maxTokens);
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

/** Models sometimes wrap JSON in fences or add a sentence around it - be forgiving, then fail clearly. */
function extractJson(raw: string): unknown {
  const text = stripFences(raw);
  try {
    return JSON.parse(text);
  } catch {
    // fall through to the salvage attempt
  }
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // fall through
    }
  }
  throw new AiOutputError("The model's answer wasn't valid JSON. Try again, or rephrase your request.");
}

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiOutputError(`The model didn't return the expected ${what}. Try again.`);
  }
  return value as Record<string, unknown>;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

const today = () => new Date().toISOString().slice(0, 10);

// --- Schema to fake data ------------------------------------------------------

const fixtures = defineFeature({
  input: z.object({
    schema: z.string().min(1, "Paste a schema or describe the record shape.").max(6000),
    count: z.number().int().min(1).max(25),
  }),
  async run(ctx, { schema, count }) {
    const raw = await ask(
      ctx,
      `You generate realistic fake test data. The user gives a JSON Schema, a TypeScript type/interface, or a plain-English description of a record shape, plus a count N. Respond with ONLY a JSON array of exactly N objects conforming to that shape.
Rules: values must look real and vary between records (realistic names, plausible ISO 8601 dates, UUIDs wherever an id is implied); emails must use example.com, example.org, or example.net; never use placeholder values like "string" or "lorem"; respect enums, formats, min/max and required fields; include no keys that aren't in the shape; no comments and no markdown.`,
      `N = ${count}\n\nShape:\n${schema}`,
      Math.min(3500, 400 + count * 180)
    );
    const parsed = extractJson(raw);
    return { records: Array.isArray(parsed) ? parsed : [parsed] };
  },
});

// --- API mock response --------------------------------------------------------

const apiMock = defineFeature({
  input: z.object({ description: z.string().min(1, "Describe the endpoint.").max(800) }),
  async run(ctx, { description }) {
    const raw = await ask(
      ctx,
      `You produce realistic mock HTTP API responses for frontend development and testing. From the user's description of an endpoint, respond with ONLY a JSON object: {"method": "GET", "path": "/the/path", "status": 200, "body": <a realistic JSON body>}.
Bodies should contain realistic, varied data (ISO 8601 dates, UUID ids, example.com emails), include pagination metadata for list endpoints, and use an error-shaped body when the description implies an error status. No markdown, no commentary.`,
      description,
      1500
    );
    const obj = asObject(extractJson(raw), "API response");
    if (!("body" in obj)) throw new AiOutputError("The mock response was missing a body. Try again.");
    return {
      method: str(obj.method, "GET").toUpperCase(),
      path: str(obj.path, "/"),
      status: typeof obj.status === "number" ? obj.status : 200,
      body: obj.body,
    };
  },
});

// --- Cron ---------------------------------------------------------------------

const cron = defineFeature({
  input: z.object({
    mode: z.enum(["toCron", "explain"]),
    text: z.string().min(1, "Enter a schedule or a cron expression.").max(300),
  }),
  async run(ctx, { mode, text }) {
    const raw = await ask(
      ctx,
      `You convert between plain-English schedules and standard 5-field cron expressions (minute hour day-of-month month day-of-week; Linux crontab semantics; no seconds field; no Quartz extensions such as ?, L, W or #). Respond with ONLY a JSON object: {"cron": "<5-field expression>", "explanation": "<one or two plain-English sentences describing exactly when it runs>", "notes": "<short caveat about timezone or ambiguity, or an empty string>"}.
In "toCron" mode, derive the expression from the user's description. In "explain" mode the user's text IS a cron expression: return it unchanged in "cron" and explain it.`,
      `Mode: ${mode}\nInput: ${text}`,
      500
    );
    const obj = asObject(extractJson(raw), "cron result");
    const expression = str(obj.cron).trim();
    if (!expression) throw new AiOutputError("The model didn't return a cron expression. Try again.");
    return { cron: expression, explanation: str(obj.explanation), notes: str(obj.notes) };
  },
});

// --- Error explainer ----------------------------------------------------------

const errorExplainer = defineFeature({
  input: z.object({
    text: z.string().min(1, "Paste an error message or stack trace.").max(6000),
    context: z.string().max(200).optional(),
  }),
  async run(ctx, { text, context }) {
    const raw = await ask(
      ctx,
      `You are a senior engineer diagnosing an error message or stack trace. Respond with ONLY a JSON object: {"summary": "<one sentence: what went wrong, in plain English>", "cause": "<the most likely root cause, 1-3 sentences>", "steps": ["<concrete fix step>", "... up to 5 steps"], "search_query": "<a good web search query for more detail, or an empty string>"}.
Be concrete and cite the specific file, line or symbol from the trace when visible. If the input is ambiguous, say what extra information would help inside "cause". No markdown.`,
      `${context ? `Context: ${context}\n\n` : ""}Error:\n${text}`,
      900
    );
    const obj = asObject(extractJson(raw), "diagnosis");
    const steps = Array.isArray(obj.steps) ? obj.steps.map((s) => str(s)).filter(Boolean).slice(0, 6) : [];
    return {
      summary: str(obj.summary),
      cause: str(obj.cause),
      steps,
      searchQuery: str(obj.search_query),
    };
  },
});

// --- AI assist: JSON ----------------------------------------------------------

const JSON_MODES = {
  explain: `Explain the structure and likely purpose of this JSON to a developer: the top-level shape, the notable fields and their types, and anything unusual. Under 180 words. Plain text; a short "- " bullet list is fine. No markdown headings.`,
  typescript: `Convert this JSON sample into TypeScript type definitions. Use "interface" for objects, name the root "Root", extract nested objects into their own named interfaces, use "| null" for null values, and use union types when array elements differ. Output ONLY the TypeScript code: no fences, no commentary.`,
  zod: `Convert this JSON sample into a Zod schema: import { z } from "zod"; export const RootSchema = ...; then export type Root = z.infer<typeof RootSchema>. Use specific validators where the values make the type obvious (z.string().email(), .url(), .uuid(), .datetime(), z.number().int()). Output ONLY the code: no fences, no commentary.`,
} as const;

const jsonAssist = defineFeature({
  input: z.object({
    json: z.string().min(1).max(8000, "That JSON is too long for AI assist (8,000 character limit)."),
    mode: z.enum(["explain", "typescript", "zod"]),
  }),
  async run(ctx, { json, mode }) {
    const raw = await ask(ctx, JSON_MODES[mode], json, 1200);
    return { output: mode === "explain" ? raw.trim() : stripFences(raw) };
  },
});

// --- AI assist: profile steer -------------------------------------------------

const PROFILE_KEYS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "username",
  "phone",
  "jobTitle",
  "street",
  "city",
  "region",
  "postalCode",
  "country",
  "birthDate",
] as const;

const profile = defineFeature({
  input: z.object({ description: z.string().min(1, "Describe the person you need.").max(300) }),
  async run(ctx, { description }) {
    const raw = await ask(
      ctx,
      `You generate ONE realistic but entirely fictional person profile for software test data, matching the user's description (age, job, location, cultural background, and so on). Respond with ONLY a JSON object whose keys are exactly: ${PROFILE_KEYS.join(", ")} - all string values.
Use an example.com, example.org or example.net email domain; a fictional phone number (555-style where the country allows); a plausible street address in the described place; and birthDate as YYYY-MM-DD consistent with the described age (today is ${today()}). Names and details must fit the described culture and region. Never use a real, famous, or identifiable person.`,
      description,
      600
    );
    const obj = asObject(extractJson(raw), "profile");
    const out = Object.fromEntries(PROFILE_KEYS.map((k) => [k, str(obj[k])])) as unknown as FakeProfile;
    if (!out.fullName) out.fullName = `${out.firstName} ${out.lastName}`.trim();
    return { profile: out };
  },
});

// --- AI assist: palette vibe --------------------------------------------------

const HARMONIES = ["complementary", "analogous", "triadic", "split-complementary", "monochrome"] as const;

const palette = defineFeature({
  input: z.object({ vibe: z.string().min(1, "Describe the mood or vibe.").max(200) }),
  async run(ctx, { vibe }) {
    const raw = await ask(
      ctx,
      `You are a color designer. From the user's mood or vibe, choose ONE base color and the harmony that best expresses it. Respond with ONLY a JSON object: {"name": "<2-4 word evocative palette name>", "base": "#RRGGBB", "harmony": "complementary|analogous|triadic|split-complementary|monochrome"}. Choose a base with real presence (not near-white or near-black) unless the vibe demands it.`,
      vibe,
      200
    );
    const obj = asObject(extractJson(raw), "palette");
    const base = str(obj.base).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(base)) throw new AiOutputError("The model returned an invalid color. Try again.");
    const harmony = (HARMONIES as readonly string[]).includes(str(obj.harmony)) ? str(obj.harmony) : "analogous";
    return { name: str(obj.name, "Custom palette"), base: base.toLowerCase(), harmony };
  },
});

// --- Natural-language search over saved history -------------------------------

interface HistoryRow {
  id: string;
  tool: string;
  label: string;
  createdAt: Date;
}

const historySearch = defineFeature({
  input: z.object({ query: z.string().min(1, "What are you looking for?").max(200) }),
  async run(ctx, { query }) {
    // Only ids, tool names, dates and short labels are sent to the provider -
    // never the saved payloads themselves (which is where generated values live).
    const rows = (await prisma.historyItem.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, tool: true, label: true, createdAt: true },
    })) as HistoryRow[];

    if (rows.length === 0) return { items: [] };

    const lines = rows
      .map((r: HistoryRow) => `${r.id}\t${r.tool}\t${r.createdAt.toISOString().slice(0, 10)}\t${r.label.replace(/\s+/g, " ").slice(0, 120)}`)
      .join("\n");

    const raw = await ask(
      ctx,
      `You search a user's saved-history list. Each line is: id, tool, date, label (tab-separated). Respond with ONLY a JSON object {"ids": [...]} containing up to 10 ids of the entries that best match the query, most relevant first. Use only ids that appear in the list. If nothing matches, return {"ids": []}. Today's date is ${today()}; interpret relative dates such as "last week" against it.`,
      `Query: ${query}\n\nHistory:\n${lines}`,
      300
    );

    const obj = asObject(extractJson(raw), "search result");
    const ids = Array.isArray(obj.ids) ? obj.ids.map((i) => str(i)) : [];
    const byId = new Map(rows.map((r: HistoryRow) => [r.id, r]));

    const items = ids
      .map((id: string) => byId.get(id))
      .filter((r): r is HistoryRow => Boolean(r))
      .map((r: HistoryRow) => ({ id: r.id, tool: r.tool, label: r.label, createdAt: r.createdAt.toISOString() }));

    return { items };
  },
});

export const AI_FEATURES: Record<string, AiFeature> = {
  fixtures,
  "api-mock": apiMock,
  cron,
  "error-explainer": errorExplainer,
  "json-assist": jsonAssist,
  profile,
  palette,
  "history-search": historySearch,
};
