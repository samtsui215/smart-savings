"use client";

import Link from "next/link";

/**
 * Split-screen auth layout.
 *
 *   Left  (lg+ only): dark, gradient brand panel with glowing blobs and a
 *                     mock dashboard preview that shows off the bucket color
 *                     identity — gives the page personality and previews the
 *                     product before sign-in.
 *   Right (always):   the actual form, passed as children.
 *
 * On mobile the left panel is hidden and the form sits on a soft mesh
 * backdrop so it never looks bare.
 */
export default function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel ───────────────────────────────────────── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700">
        {/* light sheen blobs for depth — soft, same hue family */}
        <div className="absolute -top-24 -left-16 size-80 rounded-full bg-white/15 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "7s" }} />
        <div className="absolute bottom-0 -right-24 size-80 rounded-full bg-sky-300/25 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "9s" }} />
        <div className="absolute top-1/3 left-1/4 size-72 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-2">
          <span className="size-8 rounded-xl bg-white/15 backdrop-blur ring-1 ring-inset ring-white/20 grid place-items-center">
            <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M4 12h10M4 17h16" />
            </svg>
          </span>
          <span className="font-semibold tracking-tight">Smart Savings</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold tracking-tight leading-[1.1]">
            Every dollar with{" "}
            <span className="bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
              a purpose.
            </span>
          </h2>
          <p className="mt-4 text-white/75 leading-relaxed">
            Split one savings balance into virtual buckets, set goals, and watch
            every cent stay accounted for.
          </p>
          <BucketPreview />
        </div>

        <p className="relative text-sm text-white/60">
          The sum of your buckets always equals your balance. Guaranteed.
        </p>
      </aside>

      {/* ── Form panel — soft lavender so it harmonizes with the
            violet brand panel instead of a stark white seam ──────── */}
      <section className="relative flex items-center justify-center p-6 sm:p-12 bg-[#faf9fe]">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile-only logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-10">
            <span className="size-7 rounded-lg bg-violet-sheen shadow-glow" />
            <span className="font-semibold tracking-tight text-ink-900">Smart Savings</span>
          </Link>

          <h1 className="text-3xl font-semibold tracking-tight text-ink-950">{title}</h1>
          <p className="text-ink-500 mt-1.5">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>
        </div>
      </section>
    </main>
  );
}

/* A static, on-brand mini dashboard — pure decoration. */
function BucketPreview() {
  const buckets = [
    { name: "Emergency Fund", amount: "5,200.00", pct: 86, color: "#34d399" },
    { name: "Travel",         amount: "2,840.00", pct: 71, color: "#60a5fa" },
    { name: "Rent",           amount: "3,600.00", pct: 100, color: "#a78bfa" },
    { name: "New Laptop",     amount: "840.00",   pct: 42, color: "#fbbf24" },
  ];
  return (
    <div className="mt-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-5 shadow-2xl">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/50">Total balance</p>
          <p className="text-2xl font-semibold tabular">$12,480.00</p>
        </div>
        <span className="chip bg-emerald-400/20 text-emerald-200">4 buckets</span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {buckets.map((b) => (
          <li key={b.name} className="flex items-center gap-3">
            <span
              className="size-7 shrink-0 rounded-lg grid place-items-center text-[11px] font-semibold text-white ring-1 ring-inset ring-white/10"
              style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}bb)` }}
            >
              {b.name[0]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/85 truncate">{b.name}</span>
                <span className="text-sm font-medium tabular text-white/90">${b.amount}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
