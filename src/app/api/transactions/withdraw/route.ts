import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { WithdrawBody } from "@/lib/validation";
import { apiError, ok } from "@/lib/http";
import { dollarsToCents, assertPositiveCents } from "@/lib/money";
import { assertBalanceInvariant } from "@/lib/invariants";

/**
 * POST /api/transactions/withdraw
 *   { amount, categoryId, note? }
 *
 * Removes money from one bucket. Refuses if that bucket can't cover it —
 * each bucket is its own envelope; we never silently borrow from another.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = WithdrawBody.parse(await req.json());
    const cents = dollarsToCents(body.amount);
    assertPositiveCents(cents);

    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id: body.categoryId, userId },
      });
      if (!category) {
        throw Object.assign(new Error("Category not found"), { status: 404 });
      }
      if (category.balance < cents) {
        throw Object.assign(
          new Error(`Insufficient funds in "${category.name}"`),
          { status: 409 },
        );
      }

      await tx.category.update({
        where: { id: category.id },
        data: { balance: { decrement: cents } },
      });
      await tx.user.update({
        where: { id: userId },
        data: { totalBalance: { decrement: cents } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: "WITHDRAWAL",
          amount: cents,
          categoryId: category.id,
          note: body.note,
        },
      });

      await assertBalanceInvariant(tx, userId);
      return transaction;
    });

    return ok({ transactionId: result.id }, 201);
  } catch (e) {
    return apiError(e);
  }
}
