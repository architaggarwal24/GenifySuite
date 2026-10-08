"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface SavedKey {
  id: string;
  provider: string;
  label: string;
  defaultModel: string;
}

export interface KeySelection {
  apiKeyId?: string;
  useShared?: boolean;
}

interface UsageStatus {
  shared: { allowed: boolean; remaining: number; limit: number };
  sharedKeyConfigured: boolean;
}

export function AiKeyPicker({
  value,
  onChange,
}: {
  value: KeySelection | null;
  onChange: (selection: KeySelection) => void;
}) {
  const [keys, setKeys] = useState<SavedKey[] | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  useEffect(() => {
    fetch("/api/ai/keys")
      .then((res) => (res.ok ? res.json() : { keys: [] }))
      .then((data) => setKeys(data.keys ?? []));
    fetch("/api/ai/usage")
      .then((res) => (res.ok ? res.json() : null))
      .then(setUsage);
  }, []);

  if (keys === null) {
    return <p className="text-sm text-paper-faint">Loading your keys…</p>;
  }

  if (keys.length === 0 && !usage?.sharedKeyConfigured) {
    return (
      <p className="text-sm text-paper-dim">
        No API keys configured yet.{" "}
        <Link href="/settings/ai" className="text-brass hover:underline">
          Add one in Settings
        </Link>{" "}
        to use AI tools.
      </p>
    );
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "shared") onChange({ useShared: true });
    else onChange({ apiKeyId: val });
  }

  const selected = value?.useShared ? "shared" : (value?.apiKeyId ?? "");

  return (
    <div>
      <select
        value={selected}
        onChange={handleSelect}
        className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper sm:w-auto"
      >
        <option value="" disabled>
          Choose a key…
        </option>
        {keys.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label} ({k.provider.toLowerCase()})
          </option>
        ))}
        {usage?.sharedKeyConfigured && (
          <option value="shared">
            Use GenifySuite's key ({usage.shared.remaining}/{usage.shared.limit} left today)
          </option>
        )}
      </select>
      <p className="mt-1.5 text-xs text-paper-faint">
        <Link href="/settings/ai" className="hover:text-paper-dim hover:underline">
          Manage keys
        </Link>
      </p>
    </div>
  );
}
