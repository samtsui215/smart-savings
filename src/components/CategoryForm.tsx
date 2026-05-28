"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CategoryNode } from "@/lib/tree";
import { flattenForSelect } from "@/lib/tree";

export default function CategoryForm({
  tree,
  onCreated,
}: {
  tree: CategoryNode[];
  onCreated: () => void;
}) {
  const [name, setName]         = useState("");
  const [target, setTarget]     = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  const opts = flattenForSelect(tree).filter((o) => !o.isUnassigned);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/categories", {
        method: "POST",
        json: { name, parentId: parentId || null, targetAmount: target || null },
      });
      setName(""); setTarget(""); setParentId("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card p-4 grid sm:grid-cols-[1.4fr_1fr_0.8fr_auto] gap-3 items-end"
    >
      <div>
        <label className="label">New bucket</label>
        <input
          className="input"
          required
          placeholder="e.g. Vacation"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Lives inside</label>
        <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— Top level —</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Target ($)</label>
        <input
          className="input"
          inputMode="decimal"
          placeholder="optional"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>
      <button className="btn-primary" disabled={busy}>
        {busy ? "Adding…" : "Add bucket"}
      </button>
      {error && (
        <div className="sm:col-span-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </form>
  );
}
