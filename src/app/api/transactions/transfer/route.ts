import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { TransferBody } from "@/lib/validation";
import { apiError, ok } from "@/lib/http";
import { dollarsToCents, assertPositiveCents } from "@/lib/money";
import { assertBalanceInvariant } from "@/lib/invariants";

/**
 * POST /api/transactions/transfer
 *   { amount, fromCategoryId, toCategoryId, note? }
 *
 * Moves money between two of the user's buckets. totalBalance is unchanged —
 * this is the only mutation that does NOT touch user.totalBalance, which is
 * itself a useful invariant check.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = TransferBody.parse(await req.json());
    const cents = dollarsToCents(body.amount);
    assertPositiveCents(cents);

    const result = await prisma.$transaction(async (tx) => {
      // Single round-trip fetch + cross-check both belong to this user.
      const [source, target] = await Promise.all([
        tx.category.findFirst({ where: { id: body.fromCategoryId, userId } }),
        tx.category.findFirst({ where: { id: body.toCategoryId,   userId } }),
      ]);
      if (!source || !target) {
        throw Object.assign(new Error("Category not found"), { status: 404 });
      }
      if (source.balance < cents) {
        throw Object.assign(
          new Error(`Insufficient funds in "${source.name}"`),
          { status: 409 },
        );
      }

      await tx.category.update({
        where: { id: source.id },
        data: { balance: { decrement: cents } },
      });
      await tx.category.update({
        where: { id: target.id },
        data: { balance: { increment: cents } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: "TRANSFER",
          amount: cents,
          fromCategoryId: source.id,
          toCategoryId: target.id,
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
