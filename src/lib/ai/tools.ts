import { ALL_NETWORKS, generateTestCard, type CardNetwork } from "@/lib/cards";
import { generatePalette, type HarmonyType } from "@/lib/color";
import { nextRuns, parseCron } from "@/lib/cron";
import { processJson } from "@/lib/json-tool";
import { generateLorem, type LoremUnit } from "@/lib/lorem";
import { generatePassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { generateFakeProfile } from "@/lib/profile";
import { generateTimeOrderedId, generateUuidV4 } from "@/lib/uuid";
import { type ToolDefinition } from "@/lib/ai/types";

export interface AgentToolContext {
  userId: string;
}

export interface AgentTool {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>, ctx: AgentToolContext) => unknown | Promise<unknown>;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

interface HistoryRow {
  tool: string;
  label: string;
  createdAt: Date;
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    definition: {
      name: "generate_password",
      description: "Generate a cryptographically random password.",
      parameters: {
        type: "object",
        properties: {
          length: { type: "number", description: "Length, 8-64. Defaults to 16." },
          symbols: { type: "boolean", description: "Include symbols. Defaults to true." },
        },
        required: [],
      },
    },
    execute: (args) =>
      generatePassword({
        length: clamp(args.length, 16, 8, 64),
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: args.symbols !== false,
      }),
  },
  {
    definition: {
      name: "generate_uuids",
      description: "Generate one or more v4 UUIDs.",
      parameters: {
        type: "object",
        properties: { count: { type: "number", description: "How many, 1-50. Defaults to 1." } },
        required: [],
      },
    },
    execute: (args) => Array.from({ length: clamp(args.count, 1, 1, 50) }, () => generateUuidV4()),
  },
  {
    definition: {
      name: "generate_time_ordered_ids",
      description: "Generate one or more sortable, time-ordered test IDs.",
      parameters: {
        type: "object",
        properties: { count: { type: "number", description: "How many, 1-50. Defaults to 1." } },
        required: [],
      },
    },
    execute: (args) => Array.from({ length: clamp(args.count, 1, 1, 50) }, () => generateTimeOrderedId()),
  },
  {
    definition: {
      name: "generate_fake_profiles",
      description: "Generate one or more fake test profiles (name, email, address, phone, job title).",
      parameters: {
        type: "object",
        properties: { count: { type: "number", description: "How many, 1-10. Defaults to 1." } },
        required: [],
      },
    },
    execute: (args) => Array.from({ length: clamp(args.count, 1, 1, 10) }, () => generateFakeProfile()),
  },
  {
    definition: {
      name: "generate_lorem_ipsum",
      description: "Generate placeholder lorem ipsum text by word, sentence, or paragraph count.",
      parameters: {
        type: "object",
        properties: {
          unit: { type: "string", enum: ["words", "sentences", "paragraphs"] },
          count: { type: "number", description: "How many of the chosen unit." },
        },
        required: ["unit", "count"],
      },
    },
    execute: (args) => {
      const unit = (["words", "sentences", "paragraphs"] as const).includes(args.unit as LoremUnit)
        ? (args.unit as LoremUnit)
        : "paragraphs";
      const max = unit === "words" ? 500 : unit === "sentences" ? 60 : 20;
      return generateLorem(unit, clamp(args.count, 3, 1, max), true);
    },
  },
  {
    definition: {
      name: "generate_color_palette",
      description: "Generate a color palette from a base hex color and a harmony type.",
      parameters: {
        type: "object",
        properties: {
          base: { type: "string", description: "Base color as a hex string, e.g. #E8A33D." },
          harmony: {
            type: "string",
            enum: ["complementary", "analogous", "triadic", "split-complementary", "monochrome"],
          },
        },
        required: ["base", "harmony"],
      },
    },
    execute: (args) => {
      const harmony = (
        ["complementary", "analogous", "triadic", "split-complementary", "monochrome"] as const
      ).includes(args.harmony as HarmonyType)
        ? (args.harmony as HarmonyType)
        : "analogous";
      return generatePalette(String(args.base ?? "#E8A33D"), harmony);
    },
  },
  {
    definition: {
      name: "generate_test_cards",
      description:
        "Generate Luhn-valid dummy card numbers (with fake expiry/CVV) for testing checkout forms. Not real, chargeable cards.",
      parameters: {
        type: "object",
        properties: {
          network: { type: "string", enum: [...ALL_NETWORKS], description: "Card network. Defaults to Visa." },
          count: { type: "number", description: "How many, 1-10. Defaults to 1." },
        },
        required: [],
      },
    },
    execute: (args) => {
      const network = (ALL_NETWORKS as string[]).includes(String(args.network)) ? (args.network as CardNetwork) : "Visa";
      return Array.from({ length: clamp(args.count, 1, 1, 10) }, () => generateTestCard(network));
    },
  },
  {
    definition: {
      name: "format_json",
      description: "Validate and pretty-print a JSON string. Returns the formatted JSON, or the parse error with its location.",
      parameters: {
        type: "object",
        properties: {
          json: { type: "string", description: "The JSON text to format." },
          indent: { type: "number", description: "Spaces of indentation, 0-8. Defaults to 2." },
        },
        required: ["json"],
      },
    },
    execute: (args) => {
      const result = processJson(String(args.json ?? ""), clamp(args.indent, 2, 0, 8));
      return result.valid
        ? { valid: true, formatted: result.formatted }
        : { valid: false, error: result.error, line: result.errorLine, column: result.errorColumn };
    },
  },
  {
    definition: {
      name: "cron_next_runs",
      description:
        "Validate a standard 5-field cron expression and compute its next run times (in UTC). ALWAYS use this to verify any cron expression before presenting it to the user.",
      parameters: {
        type: "object",
        properties: {
          cron: { type: "string", description: "A 5-field cron expression, e.g. '0 9 * * 1-5'." },
          count: { type: "number", description: "How many upcoming runs, 1-10. Defaults to 5." },
        },
        required: ["cron"],
      },
    },
    execute: (args) => {
      const parsed = parseCron(String(args.cron ?? ""));
      if (!parsed.ok) return { valid: false, error: parsed.error };
      const runs = nextRuns(parsed.cron, new Date(), clamp(args.count, 5, 1, 10), true);
      return { valid: true, timezone: "UTC", nextRuns: runs.map((d) => d.toISOString()) };
    },
  },
  {
    definition: {
      name: "list_saved_history",
      description:
        "List the signed-in user's saved history entries (tool, short label, date), newest first. Use it to answer questions about what they've generated or saved before.",
      parameters: {
        type: "object",
        properties: {
          tool: { type: "string", description: "Optional tool slug to filter by, e.g. 'password-generator'." },
          limit: { type: "number", description: "How many, 1-50. Defaults to 20." },
        },
        required: [],
      },
    },
    execute: async (args, ctx) => {
      const rows = (await prisma.historyItem.findMany({
        where: {
          userId: ctx.userId,
          ...(typeof args.tool === "string" && args.tool ? { tool: args.tool } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: clamp(args.limit, 20, 1, 50),
        select: { tool: true, label: true, createdAt: true },
      })) as HistoryRow[];
      // Labels only - saved payloads (where generated values live) are never exposed to the model.
      return rows.map((r: HistoryRow) => ({ tool: r.tool, label: r.label, savedAt: r.createdAt.toISOString() }));
    },
  },
];

export function getAgentTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.definition.name === name);
}
