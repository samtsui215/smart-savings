import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { AffordBody } from "@/lib/validation";
import { apiError, ok } from "@/lib/http";
import { dollarsToCents, centsToDollars, assertPositiveCents } from "@/lib/money";

/**
 * POST /api/afford  { amount }
 *
 * Answers "Can I afford this?" by suggesting which bucket(s) the expense
 * should come from. The heuristic, ordered by preference:
 *
 *   1. Smallest single bucket whose balance covers the amount AND is the
 *      furthest *over* its target (excess discretionary money first).
 *   2. Otherwise, the smallest single bucket that covers the amount.
 *   3. Otherwise, fall back to the Unassigned bucket if it covers it.
 *   4. Otherwise, return a multi-bucket suggestion (largest-balance-first
 *      greedy split) — the user can still execute it via transfers.
 *
 * Returns `affordable: false` when even the multi-bucket sweep can't cover
 * the total balance.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { amount } = AffordBody.parse(await req.json());
    const cents = dollarsToCents(amount);
    assertPositiveCents(cents);

    const categories = await prisma.category.findMany({ where: { userId } });
    const total = categories.reduce((s, c) => s + c.balance, 0);

    if (total < cents) {
      return ok({
        affordable: false,
        amount: centsToDollars(cents),
        totalAvailable: centsToDollars(total),
        suggestion: null,
        message: "You don't have enough across all buckets combined.",
      });
    }

    // Single bucket that covers it AND has excess over target -> prefer.
    const overTargetCandidates = categories
      .filter((c) => c.balance >= cents && c.targetAmount != null && c.balance > c.targetAmount)
      .sort((a, b) => (b.balance - (b.targetAmount ?? 0)) - (a.balance - (a.targetAmount ?? 0)));

    if (overTargetCandidates.length > 0) {
      const pick = overTargetCandidates[0];
      return ok({
        affordable: true,
        amount: centsToDollars(cents),
        suggestion: {
          mode: "single",
          buckets: [{ id: pick.id, name: pick.name, take: centsToDollars(cents) }],
        },
        message: `Take it from "${pick.name}" — it's over its target.`,
      });
    }

    // Single bucket, smallest that still covers — keeps larger goals intact.
    const singleCovering = categories
      .filter((c) => c.balance >= cents)
      .sort((a, b) => a.balance - b.balance);
    if (singleCovering.length > 0) {
      const pick = singleCovering[0];
      return ok({
        affordable: true,
        amount: centsToDollars(cents),
        suggestion: {
          mode: "single",
          buckets: [{ id: pick.id, name: pick.name, take: centsToDollars(cents) }],
        },
        message: `Take it from "${pick.name}".`,
      });
    }

    // Multi-bucket greedy: drain biggest balances first.
    const sorted = [...categories].sort((a, b) => b.balance - a.balance);
    const plan: { id: string; name: string; take: string }[] = [];
    let remaining = cents;
    for (const c of sorted) {
      if (remaining <= 0) break;
      if (c.balance <= 0) continue;
      const take = Math.min(c.balance, remaining);
      plan.push({ id: c.id, name: c.name, take: centsToDollars(take) });
      remaining -= take;
    }

    return ok({
      affordable: true,
      amount: centsToDollars(cents),
      suggestion: { mode: "multi", buckets: plan },
      message: "No single bucket covers it — here's a split across several.",
    });
  } catch (e) {
    return apiError(e);
  }
}
