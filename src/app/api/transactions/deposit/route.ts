import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { DepositBody } from "@/lib/validation";
import { apiError, ok } from "@/lib/http";
import { dollarsToCents, assertPositiveCents } from "@/lib/money";
import { assertBalanceInvariant } from "@/lib/invariants";

/**
 * POST /api/transactions/deposit
 *   { amount, categoryId?, note? }
 *
 * Adds money to a bucket. If no categoryId is given, the money lands in
 * the user's Unassigned bucket.
 *
 * Critical contract:
 *   totalBalance += amount
 *   category.balance += amount
 *   sum(categories) MUST still equal totalBalance afterward.
 *
 * Everything happens inside a single Prisma $transaction so a failure at
 * any step rolls back atomically.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = DepositBody.parse(await req.json());
    const cents = dollarsToCents(body.amount);
    assertPositiveCents(cents);

    const result = await prisma.$transaction(async (tx) => {
      const category = body.categoryId
        ? await tx.category.findFirst({ where: { id: body.categoryId, userId } })
        : await tx.category.findFirst({ where: { userId, isUnassigned: true } });

      if (!category) {
        throw Object.assign(new Error("Category not found"), { status: 404 });
      }

      await tx.category.update({
        where: { id: category.id },
        data: { balance: { increment: cents } },
      });
      await tx.user.update({
        where: { id: userId },
        data: { totalBalance: { increment: cents } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          amount: cents,
          categoryId: category.id,
          note: body.note,
        },
      });

      // Belt and suspenders: read-back check. If anyone ever introduces a
      // code path that updates one side and not the other, this will fail
      // loudly instead of silently corrupting the ledger.
      await assertBalanceInvariant(tx, userId);

      return transaction;
    });

    return ok({ transactionId: result.id }, 201);
  } catch (e) {
    return apiError(e);
  }
}
