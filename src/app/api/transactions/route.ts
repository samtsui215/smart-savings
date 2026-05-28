import { prisma } from "@/lib/prisma";
import { Prisma, TransactionType } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
import { centsToDollars } from "@/lib/money";

const TX_TYPES: Record<string, TransactionType> = {
  DEPOSIT: TransactionType.DEPOSIT,
  WITHDRAWAL: TransactionType.WITHDRAWAL,
  TRANSFER: TransactionType.TRANSFER,
};

/**
 * GET /api/transactions?type=&categoryId=&limit=&before=
 *
 * Cursor pagination via `before` (an ISO timestamp). Default limit 50, max 200.
 * Returned shape includes resolved category names so the UI doesn't need to
 * join on the client.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await requireSession();
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const categoryId = url.searchParams.get("categoryId");
    const before = url.searchParams.get("before");
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    const where: Prisma.TransactionWhereInput = { userId };
    if (type && type in TX_TYPES) where.type = TX_TYPES[type];
    if (categoryId) {
      where.OR = [
        { categoryId },
        { fromCategoryId: categoryId },
        { toCategoryId: categoryId },
      ];
    }
    if (before) where.createdAt = { lt: new Date(before) };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        category:     { select: { id: true, name: true } },
        fromCategory: { select: { id: true, name: true } },
        toCategory:   { select: { id: true, name: true } },
      },
    });

    return ok({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: centsToDollars(t.amount),
        note: t.note,
        createdAt: t.createdAt.toISOString(),
        category: t.category,
        fromCategory: t.fromCategory,
        toCategory: t.toCategory,
      })),
      nextBefore: transactions.length === limit
        ? transactions[transactions.length - 1].createdAt.toISOString()
        : null,
    });
  } catch (e) {
    return apiError(e);
  }
}
