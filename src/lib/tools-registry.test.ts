import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_NAMES } from "@/components/tool-icon";
import { CATEGORY_ORDER, TOOLS, getToolBySlug } from "./tools-registry";

const TOOLS_DIR = path.join(process.cwd(), "src/app/tools");

describe("tool registry", () => {
  it("has unique slugs and names", () => {
    expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length);
  });

  it("has a page for every registered tool", () => {
    for (const tool of TOOLS) {
      expect(fs.existsSync(path.join(TOOLS_DIR, tool.slug, "page.tsx")), `src/app/tools/${tool.slug}/page.tsx`).toBe(true);
    }
  });

  it("registers every tool page that exists (no orphan pages missing from the grid, palette and history names)", () => {
    const dirs = fs.readdirSync(TOOLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(dirs.sort()).toEqual(TOOLS.map((t) => t.slug).sort());
  });

  it("only uses icons that exist", () => {
    for (const tool of TOOLS) expect(ICON_NAMES, `${tool.slug} -> ${tool.icon}`).toContain(tool.icon);
  });

  it("puts every tool in a known category, and every category has a tool", () => {
    for (const tool of TOOLS) expect(CATEGORY_ORDER).toContain(tool.category);
    for (const category of CATEGORY_ORDER) expect(TOOLS.some((t) => t.category === category), category).toBe(true);
  });

  it("describes every tool", () => {
    for (const tool of TOOLS) {
      expect(tool.name.length).toBeGreaterThan(2);
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it("looks tools up by slug", () => {
    expect(getToolBySlug("cron")?.name).toBe("Cron builder & explainer");
    expect(getToolBySlug("nope")).toBeUndefined();
  });
});
