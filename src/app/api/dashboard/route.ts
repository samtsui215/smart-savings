import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
import { centsToDollars } from "@/lib/money";

const LOW_BALANCE_ABSOLUTE_CENTS = 2000;
const LOW_BALANCE_TARGET_RATIO   = 0.10;

/**
 * Computes "rollup" balance per category in O(N): for any node, the rollup
 * equals its own balance plus the rollup of each child. We post-order through
 * an adjacency map built from a single SELECT.
 */
function computeRollups(
  flat: { id: string; parentId: string | null; balance: number }[],
): Map<string, number> {
  const childrenOf = new Map<string | null, string[]>();
  const byId = new Map<string, { id: string; parentId: string | null; balance: number }>();
  for (const c of flat) {
    byId.set(c.id, c);
    const list = childrenOf.get(c.parentId) ?? [];
    list.push(c.id);
    childrenOf.set(c.parentId, list);
  }

  const rollup = new Map<string, number>();
  // Iterative post-order using an explicit stack to avoid deep recursion on
  // pathologically deep trees.
  const roots = childrenOf.get(null) ?? [];
  for (const root of roots) {
    const stack: { id: string; phase: "down" | "up" }[] = [{ id: root, phase: "down" }];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.phase === "down") {
        top.phase = "up";
        for (const child of childrenOf.get(top.id) ?? []) {
          stack.push({ id: child, phase: "down" });
        }
      } else {
        stack.pop();
        const node = byId.get(top.id)!;
        let total = node.balance;
        for (const child of childrenOf.get(top.id) ?? []) {
          total += rollup.get(child) ?? 0;
        }
        rollup.set(top.id, total);
      }
    }
  }
  return rollup;
}

export async function GET() {
  try {
    const { userId } = await requireSession();

    const [user, categories, recent] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { totalBalance: true, email: true },
      }),
      prisma.category.findMany({
        where: { userId },
        // Pure user-chosen ordering — no special pin for Unassigned, or its
        // pin would silently overrule whatever the user drags. Name is the
        // tiebreaker for legacy rows that all sit at position 0.
        orderBy: [{ position: "asc" }, { name: "asc" }],
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          category:     { select: { id: true, name: true } },
          fromCategory: { select: { id: true, name: true } },
          toCategory:   { select: { id: true, name: true } },
        },
      }),
    ]);

    const sumCategories = categories.reduce((s, c) => s + c.balance, 0);
    const rollup = computeRollups(
      categories.map((c) => ({ id: c.id, parentId: c.parentId, balance: c.balance })),
    );

    return ok({
      email: user.email,
      totalBalance: centsToDollars(user.totalBalance),
      consistent: sumCategories === user.totalBalance,
      categories: categories.map((c) => {
        const lowThreshold =
          c.targetAmount != null
            ? Math.floor(c.targetAmount * LOW_BALANCE_TARGET_RATIO)
            : LOW_BALANCE_ABSOLUTE_CENTS;
        const rollupCents = rollup.get(c.id) ?? c.balance;
        const isLow = !c.isUnassigned && rollupCents < lowThreshold;
        // Goal progress uses the rollup so a parent with a goal reflects all
        // money beneath it.
        const progressVs = c.targetAmount && c.targetAmount > 0
          ? Math.min(1, rollupCents / c.targetAmount)
          : null;
        return {
          id: c.id,
          name: c.name,
          parentId: c.parentId,
          balance: centsToDollars(c.balance),
          balanceCents: c.balance,
          rollupBalance: centsToDollars(rollupCents),
          rollupCents,
          targetAmount: c.targetAmount != null ? centsToDollars(c.targetAmount) : null,
          targetCents: c.targetAmount,
          progress: progressVs,
          remainingToTarget:
            c.targetAmount != null && rollupCents < c.targetAmount
              ? centsToDollars(c.targetAmount - rollupCents)
              : null,
          isUnassigned: c.isUnassigned,
          isLow,
        };
      }),
      recent: recent.map((t) => ({
        id: t.id,
        type: t.type,
        amount: centsToDollars(t.amount),
        note: t.note,
        createdAt: t.createdAt.toISOString(),
        category: t.category,
        fromCategory: t.fromCategory,
        toCategory: t.toCategory,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
