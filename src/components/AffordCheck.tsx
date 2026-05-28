"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AffordResponse } from "@/types";

export default function AffordCheck() {
  const [amount, setAmount]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState<AffordResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api<AffordResponse>("/api/afford", { method: "POST", json: { amount } });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="size-7 rounded-lg bg-accent-50 text-accent-700 grid place-items-center text-sm">?</span>
        <h3 className="font-semibold tracking-tight">Can I afford this?</h3>
      </div>
      <p className="text-xs text-ink-500 mb-3">We'll suggest a bucket to pay from.</p>

      <form onSubmit={ask} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">$</span>
          <input
            className="input pl-7"
            inputMode="decimal"
            placeholder="Expense amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? "…" : "Ask"}</button>
      </form>

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 animate-fade-in">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 animate-fade-in">
          <div className={`flex items-center gap-2 text-sm font-medium ${result.affordable ? "text-emerald-700" : "text-red-700"}`}>
            <span className={`size-5 rounded-full grid place-items-center text-xs ${result.affordable ? "bg-emerald-100" : "bg-red-100"}`}>
              {result.affordable ? "✓" : "✗"}
            </span>
            {result.message}
          </div>
          {result.suggestion && (
            <ul className="mt-3 space-y-1.5">
              {result.suggestion.buckets.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                  <span className="text-ink-700 truncate">{b.name}</span>
                  <span className="tabular font-medium text-ink-900">−${b.take}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
