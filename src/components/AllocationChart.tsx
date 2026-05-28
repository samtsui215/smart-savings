"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryDTO } from "@/types";
import { centsToDollars } from "@/lib/money";
import { colorForCategory } from "@/lib/palette";

export default function AllocationChart({ categories }: { categories: CategoryDTO[] }) {
  // Every category contributes only its OWN balance — never its rollup, or
  // a child's value would appear in two slices (parent + child).
  const data = categories
    .map((c) => ({
      name: c.name,
      value: c.balanceCents,
      color: colorForCategory(c).hex,
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl bg-ink-50 border border-ink-100 px-5 py-6 text-sm">
        <p className="font-medium text-ink-700">No allocation yet</p>
        <p className="mt-0.5 text-ink-500">Make a deposit to see your chart.</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      {/* Smaller donut on mobile so the legend keeps enough room. Percentage
          radii let the ring scale with the container instead of clipping. */}
      <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="93%"
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v: number) => `$${centsToDollars(v)}`} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label — total of allocated funds */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-400">Allocated</div>
            <div className="text-sm font-semibold tabular text-ink-900">${centsToDollars(total)}</div>
          </div>
        </div>
      </div>

      <ul className="flex-1 min-w-0 space-y-1.5 text-sm pr-2 sm:pr-1">
        {data.slice(0, 5).map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2 text-ink-700">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
            </div>
            <span className="text-xs text-ink-500 tabular shrink-0">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
        {data.length > 5 && (
          <li className="text-xs text-ink-500">+ {data.length - 5} more</li>
        )}
      </ul>
    </div>
  );
}
