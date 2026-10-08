"use client";

import { Download, Play, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Workflow {
  id: string;
  name: string;
  prompt: string;
}

/**
 * Saved agent prompts ("workflows") the user can re-run in one click, plus a
 * way to save the most recent prompt they sent as a new one.
 */
export function WorkflowsPanel({
  onRun,
  lastPrompt,
  disabled,
}: {
  onRun: (prompt: string) => void;
  lastPrompt: string | null;
  disabled: boolean;
}) {
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/workflows")
      .then((res) => (res.ok ? res.json() : { workflows: [] }))
      .then((data) => setWorkflows(data.workflows ?? []))
      .catch(() => setWorkflows([]));
  }, []);

  function handleExport() {
    if (!workflows || workflows.length === 0) return;
    const payload = { workflows: workflows.map(({ name, prompt }) => ({ name, prompt })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "genifysuite-workflows.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;

    setError(null);
    setNotice(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError("That file isn't valid JSON.");
      return;
    }

    const list = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { workflows?: unknown })?.workflows) ? (parsed as { workflows: unknown[] }).workflows : null;
    if (!list) {
      setError("Expected an exported workflows file (an array, or { \"workflows\": [...] }).");
      return;
    }

    const res = await fetch("/api/workflows/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflows: list }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Couldn't import that file.");
      return;
    }

    setNotice(`Imported ${data.imported}${data.skipped ? ` (skipped ${data.skipped} - at the limit)` : ""}.`);
    const refreshed = await fetch("/api/workflows");
    if (refreshed.ok) setWorkflows((await refreshed.json()).workflows ?? []);
  }

  async function handleSave() {
    if (!lastPrompt) return;
    setError(null);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || lastPrompt.slice(0, 40), prompt: lastPrompt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't save that workflow.");
      return;
    }
    setWorkflows((prev) => [data.workflow, ...(prev ?? [])]);
    setName("");
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setWorkflows((prev) => (prev ?? []).filter((w) => w.id !== id));
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mt-5 border-t border-ink-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-paper">Saved workflows</h2>
        <div className="flex items-center gap-3">
          {lastPrompt && !saving && (
            <button
              type="button"
              onClick={() => setSaving(true)}
              className="text-xs text-paper-faint hover:text-paper-dim"
            >
              Save my last prompt
            </button>
          )}
          {workflows && workflows.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1 text-xs text-paper-faint hover:text-paper-dim"
              title="Download all saved workflows as JSON"
            >
              <Download className="h-3 w-3" strokeWidth={1.75} />
              Export
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-paper-faint hover:text-paper-dim"
            title="Import workflows from a JSON file"
          >
            <Upload className="h-3 w-3" strokeWidth={1.75} />
            Import
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {notice && <p className="mt-2 text-xs text-sage">{notice}</p>}

      {saving && lastPrompt && (
        <div className="mt-3 rounded border border-ink-line bg-ink p-3">
          <p className="mb-2 truncate text-xs text-paper-faint">“{lastPrompt}”</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Name it, e.g. Seed my test DB"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSaving(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {workflows === null && <p className="mt-2 text-xs text-paper-faint">Loading…</p>}

      {workflows?.length === 0 && !saving && (
        <p className="mt-2 text-xs text-paper-faint">
          Send the agent a prompt you'll want again, then save it here to re-run it in one click.
        </p>
      )}

      {workflows && workflows.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {workflows.map((w) => (
            <div
              key={w.id}
              className="group flex items-center rounded-sm border border-ink-line bg-ink transition-colors hover:border-brass/50"
            >
              <button
                type="button"
                disabled={disabled}
                title={w.prompt}
                onClick={() => onRun(w.prompt)}
                className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-paper-dim hover:text-paper disabled:opacity-40"
              >
                <Play className="h-3 w-3 text-brass" strokeWidth={2} />
                {w.name}
              </button>
              <button
                type="button"
                aria-label={`Delete workflow ${w.name}`}
                onClick={() => handleDelete(w.id)}
                className="focus-ring border-l border-ink-line px-1.5 py-1.5 text-paper-faint hover:text-rust"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
