"use client";

import { Search, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AiKeyPicker, type KeySelection } from "@/components/ai-key-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAiRun } from "@/hooks/use-ai-run";
import { getToolBySlug } from "@/lib/tools-registry";

interface Match {
  id: string;
  tool: string;
  label: string;
  createdAt: string;
}

/** Natural-language search over the user's saved history ("the strong password from last week"). */
export function HistorySearch() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const { run, loading, error } = useAiRun();

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const result = await run<{ items: Match[] }>("history-search", { query }, selection);
    if (result) {
      setMatches(result.items);
      setSearchedFor(query);
    }
  }

  return (
    <div className="mb-8 rounded border border-ink-line bg-ink-raised p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brass" strokeWidth={1.75} />
        <h2 className="text-sm font-medium text-paper">Ask your history</h2>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-faint" strokeWidth={1.75} />
          <Input
            className="pl-9"
            placeholder="e.g. the QR code I made for the wifi, or JSON I formatted last week"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!selection || !query.trim() || loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="mt-3">
        <AiKeyPicker value={selection} onChange={setSelection} />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rust">
          {error}
        </p>
      )}

      {matches && !loading && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-paper-faint">
              {matches.length === 0 ? "Nothing matched" : `${matches.length} match${matches.length === 1 ? "" : "es"}`} for “{searchedFor}”
            </p>
            <button type="button" onClick={() => setMatches(null)} className="text-xs text-paper-faint hover:text-paper-dim">
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {matches.map((m) => (
              <div key={m.id} className="rounded border border-brass/30 bg-brass/5 px-3 py-2">
                <p className="truncate text-sm text-paper">{m.label}</p>
                <p className="mt-0.5 text-xs text-paper-faint">
                  {getToolBySlug(m.tool)?.name ?? m.tool} · {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-paper-faint">
        Only tool names, dates and short labels are sent to your AI provider. The saved values themselves never are.
      </p>
    </div>
  );
}
