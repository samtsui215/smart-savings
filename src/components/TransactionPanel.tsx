"use client";

import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { CategoryDTO } from "@/types";
import { buildTree, flattenForSelect } from "@/lib/tree";

type Tab = "deposit" | "withdraw" | "transfer";

export default function TransactionPanel({
  categories,
  onCommitted,
}: {
  categories: CategoryDTO[];
  onCommitted: () => void;
}) {
  const [tab, setTab]         = useState<Tab>("deposit");
  const [amount, setAmount]   = useState("");
  const [note, setNote]       = useState("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [fromId, setFromId]   = useState<string>(categories[0]?.id ?? "");
  const [toId, setToId]       = useState<string>(categories[1]?.id ?? categories[0]?.id ?? "");
  // Indented option list — gives a visual hint that a child belongs to a parent.
  const options = useMemo(() => flattenForSelect(buildTree(categories)), [categories]);
  const byId    = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [ok, setOk]           = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setOk(null);
    try {
      if (tab === "deposit") {
        await api("/api/transactions/deposit", { method: "POST",
          json: { amount, categoryId: categoryId || undefined, note: note || undefined } });
      } else if (tab === "withdraw") {
        await api("/api/transactions/withdraw", { method: "POST",
          json: { amount, categoryId, note: note || undefined } });
      } else {
        await api("/api/transactions/transfer", { method: "POST",
          json: { amount, fromCategoryId: fromId, toCategoryId: toId, note: note || undefined } });
      }
      setAmount(""); setNote("");
      setOk("Done.");
      onCommitted();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold tracking-tight">Move money</h3>
      </div>

      <div className="segmented w-full mb-4">
        {(["deposit", "withdraw", "transfer"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => { setTab(t); setError(null); setOk(null); }}
            className="flex-1"
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="label">Amount</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">$</span>
            <input
              className="input pl-7 text-lg tabular"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {tab === "deposit" && (
          <div>
            <label className="label">Into</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {tab === "withdraw" && (
          <div>
            <label className="label">From</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {options.map((o) => {
                const c = byId.get(o.id);
                return (
                  <option key={o.id} value={o.id}>
                    {o.label} — ${c?.balance}
                  </option>
                );
              })}
            </select>
            <p className="mt-1 text-xs text-ink-500">Withdraws from this bucket only — not from sub-buckets.</p>
          </div>
        )}

        {tab === "transfer" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {options.map((o) => {
                  const c = byId.get(o.id);
                  return (
                    <option key={o.id} value={o.id}>
                      {o.label} — ${c?.balance}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="label">To</label>
              <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's this for?" />
        </div>

        <button className="btn-accent w-full" disabled={busy}>
          {busy ? "Submitting…" : `Submit ${tab}`}
        </button>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 animate-fade-in">
            {error}
          </div>
        )}
        {ok && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700 animate-fade-in">
            ✓ {ok}
          </div>
        )}
      </form>
    </div>
  );
}
