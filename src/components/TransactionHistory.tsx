"use client";

import type { TransactionDTO, TransactionType } from "@/types";
import { colorForCategory, initialOf } from "@/lib/palette";

function describe(t: TransactionDTO) {
  switch (t.type) {
    case "DEPOSIT":    return <>Deposit into <span className="font-medium text-ink-900">{t.category?.name ?? "unknown"}</span></>;
    case "WITHDRAWAL": return <>Withdraw from <span className="font-medium text-ink-900">{t.category?.name ?? "unknown"}</span></>;
    case "TRANSFER":   return <><span className="font-medium text-ink-900">{t.fromCategory?.name ?? "?"}</span> → <span className="font-medium text-ink-900">{t.toCategory?.name ?? "?"}</span></>;
  }
}

const TYPE_GLYPH: Record<TransactionType, string> = {
  DEPOSIT: "↓", WITHDRAWAL: "↑", TRANSFER: "⇄",
};
const AMOUNT_CLS: Record<TransactionType, string> = {
  DEPOSIT: "text-emerald-700", WITHDRAWAL: "text-red-700", TRANSFER: "text-ink-700",
};
const AMOUNT_PREFIX: Record<TransactionType, string> = {
  DEPOSIT: "+", WITHDRAWAL: "−", TRANSFER: "",
};

// Compact timestamp, e.g. "5/27/26, 7:28 PM" — no seconds / full year, so the
// metadata line fits on one row on a phone instead of wrapping.
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TransactionHistory({ recent }: { recent: TransactionDTO[] }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100">
        <div className="flex items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-semibold tracking-tight text-ink-900">Recent activity</h2>
        </div>
        <span className="text-xs text-ink-500">
          {recent.length} {recent.length === 1 ? "event" : "events"}
        </span>
      </header>

      {recent.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-ink-700">No transactions yet</p>
          <p className="text-xs text-ink-500 mt-1">Use "Move money" to make your first deposit.</p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {recent.map((t) => {
            // Pick the bucket whose color best represents this transaction.
            const focal =
              t.category ??
              t.toCategory ??
              t.fromCategory;
            const color = focal
              ? colorForCategory({ id: focal.id, isUnassigned: false })
              : null;

            return (
              <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-ink-50/60 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="size-9 sm:size-10 shrink-0 rounded-xl grid place-items-center text-white text-sm font-medium ring-1 ring-inset ring-black/5"
                    style={
                      color
                        ? { background: `linear-gradient(135deg, ${color.hex}, ${color.hex}cc)` }
                        : { background: "linear-gradient(135deg, #94a3b8, #64748b)" }
                    }
                  >
                    {focal ? initialOf(focal.name) : TYPE_GLYPH[t.type]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink-800 truncate">{describe(t)}</p>
                    {/* Single compact line: type already shown above + by the
                        amount color, so metadata is just a short date + note. */}
                    <p className="text-xs text-ink-500 mt-0.5 truncate">
                      {formatWhen(t.createdAt)}
                      {t.note && <span className="italic"> · {t.note}</span>}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold tabular shrink-0 ${AMOUNT_CLS[t.type]}`}>
                  {AMOUNT_PREFIX[t.type]}${t.amount}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
