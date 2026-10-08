"use client";

import { useEffect, useRef, useState } from "react";
import { AiKeyPicker, type KeySelection } from "@/components/ai-key-picker";
import { Markdown } from "@/components/markdown";
import { ToolIcon } from "@/components/tool-icon";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/input";
import { WorkflowsPanel } from "@/components/workflows-panel";
import { readNdjson } from "@/lib/ndjson-client";
import { getToolBySlug } from "@/lib/tools-registry";

function formatRun(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

const tool = getToolBySlug("ai-agent")!;

interface AgentStep {
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
  streaming?: boolean;
}

type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "step"; step: AgentStep }
  | { type: "done" }
  | { type: "error"; message: string };

const SUGGESTIONS = [
  "Generate 3 fake profiles as a quick list",
  "Give me a 24-character password with no symbols",
  "What's the cron for every weekday at 9am? Show the next runs",
  "What have I saved recently?",
];

const TOOL_META: Record<string, { icon: string; label: string }> = {
  generate_password: { icon: "key", label: "Generated a password" },
  generate_uuids: { icon: "hash", label: "Generated UUIDs" },
  generate_time_ordered_ids: { icon: "hash", label: "Generated time-ordered IDs" },
  generate_fake_profiles: { icon: "user", label: "Generated profile(s)" },
  generate_lorem_ipsum: { icon: "type", label: "Generated lorem ipsum" },
  generate_color_palette: { icon: "palette", label: "Generated a color palette" },
  generate_test_cards: { icon: "credit-card", label: "Generated test cards" },
  format_json: { icon: "file-json", label: "Formatted JSON" },
  cron_next_runs: { icon: "clock", label: "Checked a cron expression" },
  list_saved_history: { icon: "database", label: "Looked through your saved history" },
};

function summarizeResult(toolName: string, result: unknown): string {
  try {
    if (toolName === "generate_password" && typeof result === "string") {
      return result;
    }
    if ((toolName === "generate_uuids" || toolName === "generate_time_ordered_ids") && Array.isArray(result)) {
      return result.length === 1 ? result[0] : `${result.length} generated — first: ${result[0]}`;
    }
    if (toolName === "generate_fake_profiles" && Array.isArray(result)) {
      const names = result.map((p: { fullName?: string }) => p?.fullName).filter(Boolean);
      return names.length ? names.join(", ") : `${result.length} profile(s)`;
    }
    if (toolName === "generate_lorem_ipsum" && typeof result === "string") {
      return result.length > 80 ? `${result.slice(0, 80)}…` : result;
    }
    if (toolName === "generate_color_palette" && Array.isArray(result)) {
      return result.map((s: { hex?: string }) => s?.hex).filter(Boolean).join("  ");
    }
    if (toolName === "generate_test_cards" && Array.isArray(result)) {
      return result.map((c: { number?: string }) => c?.number).filter(Boolean).slice(0, 2).join(", ");
    }
    if (toolName === "format_json" && result && typeof result === "object") {
      const r = result as { valid?: boolean; error?: string };
      return r.valid ? "Valid JSON" : `Invalid: ${r.error ?? "parse error"}`;
    }
    if (toolName === "cron_next_runs" && result && typeof result === "object") {
      const r = result as { valid?: boolean; error?: string; nextRuns?: string[] };
      return r.valid ? `Valid · next run ${r.nextRuns?.[0] ?? ""} (UTC)` : `Invalid: ${r.error ?? ""}`;
    }
    if (toolName === "list_saved_history" && Array.isArray(result)) {
      return `${result.length} saved item${result.length === 1 ? "" : "s"} found`;
    }
    return JSON.stringify(result).slice(0, 100);
  } catch {
    return "";
  }
}

function AssistantMessage({ content, steps, streaming }: { content: string; steps?: AgentStep[]; streaming: boolean }) {
  return (
    <div className="inline-block max-w-[85%] rounded bg-ink-raised px-3 py-2 text-sm text-paper">
      {steps && steps.length > 0 && (
        <div className="mb-2 space-y-1.5 border-b border-ink-line pb-2">
          {steps.map((s, si) => {
            const meta = TOOL_META[s.tool] ?? { icon: "sparkles", label: s.tool };

            if (s.tool === "cron_next_runs") {
              const r = s.result as { valid?: boolean; error?: string; nextRuns?: string[] };
              return (
                <div key={si} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-sage/40 text-sage">
                    <ToolIcon name={meta.icon} className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-sage">{r.valid ? "Verified cron expression" : "Invalid cron expression"}</p>
                    {r.valid && r.nextRuns ? (
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-paper-faint">
                        {r.nextRuns.slice(0, 3).map((run) => (
                          <li key={run}>{formatRun(run)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-mono text-xs text-rust">{r.error}</p>
                    )}
                  </div>
                </div>
              );
            }

            const summary = summarizeResult(s.tool, s.result);
            return (
              <div key={si} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-sage/40 text-sage">
                  <ToolIcon name={meta.icon} className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-sage">{meta.label}</p>
                  {summary && <p className="truncate font-mono text-xs text-paper-faint">{summary}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!streaming ? (
        <Markdown content={content} />
      ) : (
        <p className="whitespace-pre-line text-left">
          {content}
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-paper-faint align-middle" />
        </p>
      )}
    </div>
  );
}

export default function AiAgentPage() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPrompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? null;

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Stop any in-flight stream if the user navigates away mid-reply.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    if (!text.trim() || !selection || loading) return;

    const userMessage: DisplayMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    const assistantId = crypto.randomUUID();
    let started = false;
    const controller = new AbortController();
    abortRef.current = controller;

    function updateAssistant(patch: Partial<DisplayMessage> | ((m: DisplayMessage) => DisplayMessage)) {
      if (!started) {
        started = true;
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "", steps: [], streaming: true, ...(typeof patch === "function" ? {} : patch) },
        ]);
        if (typeof patch !== "function") return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? (typeof patch === "function" ? patch(m) : { ...m, ...patch }) : m))
      );
    }

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          ...selection,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
        return;
      }

      let streamError: string | null = null;
      await readNdjson<AgentEvent>(res, (event) => {
        if (event.type === "text") {
          updateAssistant((m) => ({ ...m, content: m.content + event.delta }));
        } else if (event.type === "step") {
          updateAssistant((m) => ({ ...m, steps: [...(m.steps ?? []), event.step] }));
        } else if (event.type === "error") {
          streamError = event.message;
        }
      });

      if (streamError) setError(streamError);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError("Lost the connection to the server. Try again.");
      }
    } finally {
      updateAssistant((m) => ({ ...m, streaming: false }));
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <AiKeyPicker value={selection} onChange={setSelection} />
        </div>

        <div className="min-h-[240px] space-y-4 rounded border border-ink-line bg-ink p-4">
          {messages.length === 0 && (
            <div>
              <p className="text-sm text-paper-faint">Try one of these, or type your own:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!selection}
                    onClick={() => send(s)}
                    className="focus-ring rounded-sm border border-ink-line px-2.5 py-1 text-xs text-paper-dim hover:border-brass/50 hover:text-paper disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
              {m.role === "user" ? (
                <div className="inline-block max-w-[85%] rounded bg-brass/10 px-3 py-2 text-left text-sm text-paper">
                  {m.content}
                </div>
              ) : (
                <AssistantMessage content={m.content} steps={m.steps} streaming={Boolean(m.streaming)} />
              )}
            </div>
          ))}

          {loading && !messages[messages.length - 1]?.content && (
            <div className="max-w-[85%] space-y-2 rounded bg-ink-raised px-3 py-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          )}

          <div ref={listEndRef} />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rust">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <Textarea
            rows={2}
            placeholder={selection ? "Ask for anything the tools above can generate…" : "Pick a key first"}
            value={input}
            disabled={!selection}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          {loading ? (
            <Button type="button" variant="secondary" onClick={handleStop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!selection || !input.trim()}>
              Send
            </Button>
          )}
        </form>

        <WorkflowsPanel onRun={send} lastPrompt={lastPrompt} disabled={!selection || loading} />
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        The agent can generate passwords, UUIDs, profiles, lorem ipsum, palettes and test cards, format
        JSON, verify cron expressions, and look through your saved history (labels only) via tool calls. It can
        also write, explain and debug on its own, with no tool needed. Replies stream in live as the model writes them.
      </p>
    </ToolShell>
  );
}
