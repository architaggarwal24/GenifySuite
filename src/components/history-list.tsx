"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools-registry";

export interface HistoryItemDTO {
  id: string;
  tool: string;
  label: string;
  createdAt: string;
}


export function HistoryList({ initialItems }: { initialItems: HistoryItemDTO[] }) {
  const [items, setItems] = useState(initialItems);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
    setDeletingId(null);
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-paper-faint">
        Nothing saved yet — any tool with a "Save to history" button will show up here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-ink-line bg-ink-raised/70 px-4 py-3 backdrop-blur-sm transition-colors hover:border-brass/30"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-paper">{item.label}</p>
            <p className="mt-0.5 text-xs text-paper-faint">
              {getToolBySlug(item.tool)?.name ?? item.tool} ·{" "}
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(item.id)}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id ? "Removing…" : "Remove"}
          </Button>
        </div>
      ))}
    </div>
  );
}
