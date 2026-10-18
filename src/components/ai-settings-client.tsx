"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PROVIDER_INFO_LIST } from "@/lib/ai/provider-meta";

const PROVIDER_OPTIONS = PROVIDER_INFO_LIST;

interface SavedKey {
  id: string;
  provider: string;
  label: string;
  baseUrl: string | null;
  defaultModel: string;
  hasSecret: boolean;
  createdAt: string;
}

export function AiSettingsClient() {
  const [keys, setKeys] = useState<SavedKey[] | null>(null);
  const [providerId, setProviderId] = useState("anthropic");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState(PROVIDER_OPTIONS[0].defaultModel);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provider = PROVIDER_OPTIONS.find((p) => p.id === providerId)!;

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    fetch("/api/ai/keys")
      .then((res) => res.json())
      .then((data) => setKeys(data.keys ?? []));
  }

  function handleProviderChange(id: string) {
    setProviderId(id);
    const p = PROVIDER_OPTIONS.find((opt) => opt.id === id)!;
    setBaseUrl(p.defaultBaseUrl);
    setModel(p.defaultModel);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/ai/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerId,
        label: label || provider.label,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        defaultModel: model,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't save that key.");
      return;
    }

    setLabel("");
    setApiKey("");
    refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/ai/keys/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="mb-4 text-lg font-medium text-paper">Add a key</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                value={providerId}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {provider.helpUrl && (
                <a
                  href={provider.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-paper-faint hover:text-paper-dim"
                >
                  Get a key from {provider.label} ↗
                </a>
              )}
            </div>
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder={provider.label}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="apiKey">
              API key {provider.keyRequired ? "" : "(optional for this provider)"}
            </Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              placeholder={provider.keyRequired ? "sk-…" : "Leave blank if your endpoint needs none"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {provider.baseUrlConfigurable && (
            <div>
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                placeholder="https://…"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="model">Default model</Label>
            <Input
              id="model"
              placeholder={provider.modelHint}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <p className="mt-1 text-xs text-paper-faint">{provider.modelHint}</p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-rust">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save key"}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-medium text-paper">Your keys</h2>
        {keys === null && <p className="text-sm text-paper-faint">Loading…</p>}
        {keys?.length === 0 && (
          <p className="text-sm text-paper-faint">Nothing saved yet — add one above.</p>
        )}
        <div className="space-y-2">
          {keys?.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-ink-line bg-ink-raised/70 backdrop-blur-sm px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-paper">{k.label}</p>
                <p className="mt-0.5 text-xs text-paper-faint">
                  {k.provider.toLowerCase()} · {k.defaultModel}
                  {k.baseUrl ? ` · ${k.baseUrl}` : ""}
                  {k.hasSecret ? "" : " · no key stored"}
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDelete(k.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
