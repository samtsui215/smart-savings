import type { Prisma } from "@prisma/client";

/**
 * Asserts: sum(category.balance) === user.totalBalance.
 *
 * Run this inside the same DB transaction that mutated balances. If it throws,
 * Prisma rolls the transaction back and the ledger remains consistent.
 *
 * `tx` is the transactional client passed by prisma.$transaction so the read
 * sees uncommitted writes from this transaction.
 */
export async function assertBalanceInvariant(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const [user, sum] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { totalBalance: true } }),
    tx.category.aggregate({
      where: { userId },
      _sum: { balance: true },
    }),
  ]);

  if (!user) throw new Error("User not found while checking invariant");

  const categorySum = sum._sum.balance ?? 0;
  if (categorySum !== user.totalBalance) {
    throw new Error(
      `Data inconsistency: sum(categories)=${categorySum} != totalBalance=${user.totalBalance}`,
    );
  }
}
