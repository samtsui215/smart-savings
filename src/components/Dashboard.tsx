"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/store/useStore";
import { api } from "@/lib/api";
import { buildTree } from "@/lib/tree";
import AllocationChart from "./AllocationChart";
import BucketTree from "./BucketTree";
import CategoryForm from "./CategoryForm";
import TransactionPanel from "./TransactionPanel";
import AffordCheck from "./AffordCheck";
import TransactionHistory from "./TransactionHistory";

export default function Dashboard() {
  const router = useRouter();
  const { data, loading, error, refresh } = useDashboard();

  useEffect(() => { refresh(); }, [refresh]);

  // Hooks must run on every render — keep them above the early returns.
  const tree = useMemo(
    () => buildTree(data?.categories ?? []),
    [data?.categories],
  );

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data)   return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <div className="card p-6 border-red-200 bg-red-50">
        <p className="text-red-700 font-medium">{error}</p>
        <button className="btn-secondary mt-3" onClick={() => refresh()}>Try again</button>
      </div>
    </main>
  );
  if (!data) return null;

  const fundedCategories = data.categories.filter((c) => c.balanceCents > 0).length;
  const lowCount         = data.categories.filter((c) => c.isLow).length;

  // "Goal coverage" — how much of the user's combined targets they've saved.
  // Uses rollups so a parent's loose money + sub-bucket money both count
  // toward its own target. Caps at 100% per bucket to avoid one wildly
  // over-funded bucket dominating the bar.
  const targetSumCents = data.categories.reduce(
    (s, c) => s + (c.targetCents ?? 0),
    0,
  );
  const savedTowardTargets = data.categories.reduce((s, c) => {
    if (c.targetCents == null) return s;
    return s + Math.min(c.rollupCents, c.targetCents);
  }, 0);
  const goalPct = targetSumCents > 0
    ? Math.round((savedTowardTargets / targetSumCents) * 100)
    : null;

  return (
    <main className="min-h-screen bg-ambient">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-violet-sheen shadow-glow" />
            <span className="font-semibold tracking-tight">Smart Savings</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-ink-500">{data.email}</span>
            <button className="btn-ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-fade-in">
        {!data.consistent && (
          <div className="card p-4 border-red-200 bg-red-50 text-red-800">
            <p className="font-medium">Data inconsistency detected</p>
            <p className="text-sm mt-1">
              Sum of category balances does not match the total account balance.
              Contact support — no further mutations should be made.
            </p>
          </div>
        )}

        {/* HERO — calm balance summary with goal-coverage progress */}
        <section className="relative card p-6 md:p-8 overflow-hidden">
          {/* Decorative corner glow — barely there, gives the card depth */}
          <div className="absolute -top-24 -right-24 size-72 rounded-full bg-accent-500/8 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-24 size-72 rounded-full bg-blue-500/8 blur-3xl pointer-events-none" />

          <div className="relative grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-accent-500" />
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
                  Total balance
                </p>
              </div>
              <p className="mt-2 text-5xl md:text-[56px] font-semibold tabular tracking-tight text-ink-950 leading-none">
                <span className="text-ink-400 text-2xl align-top mr-1">$</span>
                {data.totalBalance}
              </p>

              {goalPct != null && (
                <div className="mt-5">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs text-ink-600">Goal coverage</span>
                    <span className="text-xs text-ink-500 tabular">
                      <span className="font-semibold text-ink-900">{goalPct}%</span>
                      <span className="mx-1 text-ink-300">·</span>
                      ${Math.floor(savedTowardTargets / 100).toLocaleString()} of ${Math.floor(targetSumCents / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all bg-violet-sheen"
                      style={{ width: `${Math.min(100, goalPct)}%` }}
                    />
                  </div>
                </div>
              )}

              <dl className="mt-6 grid grid-cols-3 gap-6 border-t border-ink-100 pt-4">
                <Stat label="Buckets" value={String(data.categories.length)} accent="accent" />
                <Stat label="Funded"  value={String(fundedCategories)}       accent="emerald" />
                <Stat label="Low"     value={String(lowCount)}               accent={lowCount > 0 ? "amber" : "neutral"} />
              </dl>
            </div>
            <div className="md:border-l md:border-ink-100 md:pl-8">
              <AllocationChart categories={data.categories} />
            </div>
          </div>
        </section>

        {/* MAIN GRID */}
        <section className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-4">
            <BucketTree tree={tree} onChange={refresh} />
            <CategoryForm tree={tree} onCreated={refresh} />
          </div>

          <aside className="space-y-6">
            <TransactionPanel categories={data.categories} onCommitted={refresh} />
            <AffordCheck />
          </aside>
        </section>

        <TransactionHistory recent={data.recent} />

        <footer className="pt-8 pb-4 text-center text-xs text-ink-400">
          Every dollar accounted for. Always.
        </footer>
      </div>
    </main>
  );
}

function Stat({
  label, value, accent,
}: {
  label:  string;
  value:  string;
  accent: "accent" | "emerald" | "amber" | "neutral";
}) {
  const bar = {
    accent:  "bg-accent-500",
    emerald: "bg-emerald-500",
    amber:   "bg-amber-500",
    neutral: "bg-ink-300",
  }[accent];
  const num = accent === "amber"
    ? "text-amber-700"
    : accent === "emerald"
    ? "text-emerald-700"
    : "text-ink-900";
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1.5 size-1 rounded-full ${bar}`} />
      <div>
        <dt className="text-[11px] uppercase tracking-wider text-ink-500">{label}</dt>
        <dd className={`mt-0.5 text-2xl font-semibold tabular ${num}`}>{value}</dd>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-ambient">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="skeleton h-44 rounded-2xl" />
        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <div className="skeleton h-96" />
          <div className="space-y-6">
            <div className="skeleton h-72" />
            <div className="skeleton h-40" />
          </div>
        </div>
      </div>
    </main>
  );
}
