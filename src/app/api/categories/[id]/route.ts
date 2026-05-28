import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CategoryUpdateBody } from "@/lib/validation";
import { apiError, ok } from "@/lib/http";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import { wouldCreateCycle, collectSubtreeIds } from "@/lib/categoryTree";
import { assertBalanceInvariant } from "@/lib/invariants";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { userId } = await requireSession();
    const body = CategoryUpdateBody.parse(await req.json());

    // Wrap in a tx so the cycle check and the update see the same snapshot.
    const updated = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id: params.id, userId },
      });
      if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });

      if (category.isUnassigned && body.name && body.name !== category.name) {
        throw Object.assign(new Error("The Unassigned bucket cannot be renamed"), { status: 400 });
      }
      if (category.isUnassigned && body.parentId !== undefined && body.parentId !== null) {
        throw Object.assign(new Error("The Unassigned bucket must stay at root"), { status: 400 });
      }

      if (body.parentId !== undefined && body.parentId !== category.parentId) {
        if (body.parentId !== null) {
          const parent = await tx.category.findFirst({
            where: { id: body.parentId, userId },
            select: { id: true, isUnassigned: true },
          });
          if (!parent) throw Object.assign(new Error("Parent category not found"), { status: 404 });
          if (parent.isUnassigned) {
            throw Object.assign(new Error("Unassigned cannot contain sub-buckets"), { status: 400 });
          }
          if (await wouldCreateCycle(tx, userId, category.id, body.parentId)) {
            throw Object.assign(new Error("That move would create a cycle"), { status: 400 });
          }
        }
      }

      const targetCents =
        body.targetAmount === undefined
          ? undefined
          : body.targetAmount === null
          ? null
          : dollarsToCents(body.targetAmount);

      // When parent changes, the bucket goes to the end of the new parent's
      // sibling group. We don't backfill the vacated position — gaps are
      // harmless because the reorder endpoint always replaces the entire
      // group's positions atomically.
      let nextPosition: number | undefined = undefined;
      if (body.parentId !== undefined && body.parentId !== category.parentId) {
        const last = await tx.category.findFirst({
          where: { userId, parentId: body.parentId ?? null },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        nextPosition = last ? last.position + 1 : 0;
      }

      return tx.category.update({
        where: { id: category.id },
        data: {
          name: body.name ?? undefined,
          targetAmount: targetCents,
          parentId: body.parentId === undefined ? undefined : body.parentId,
          position: nextPosition,
        },
      });
    });

    return ok({
      category: {
        id: updated.id,
        name: updated.name,
        parentId: updated.parentId,
        balance: centsToDollars(updated.balance),
        targetAmount: updated.targetAmount != null ? centsToDollars(updated.targetAmount) : null,
        isUnassigned: updated.isUnassigned,
      },
    });
  } catch (e) {
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      return apiError(Object.assign(new Error("A category with that name already exists"), { status: 409 }));
    }
    return apiError(e);
  }
}

/**
 * DELETE: sweeps the *entire subtree* below this category into Unassigned,
 * then deletes the subtree. Atomic — the invariant cannot drift mid-flight.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { userId } = await requireSession();

    await prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id: params.id, userId },
      });
      if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });
      if (category.isUnassigned) {
        throw Object.assign(new Error("The Unassigned bucket cannot be deleted"), { status: 400 });
      }

      const subtreeIds = await collectSubtreeIds(tx, userId, category.id);
      const sweep = await tx.category.aggregate({
        where: { id: { in: subtreeIds } },
        _sum: { balance: true },
      });
      const sweepCents = sweep._sum.balance ?? 0;

      if (sweepCents > 0) {
        const unassigned = await tx.category.findFirstOrThrow({
          where: { userId, isUnassigned: true },
        });
        await tx.category.update({
          where: { id: unassigned.id },
          data: { balance: { increment: sweepCents } },
        });
        await tx.transaction.create({
          data: {
            userId,
            type: "TRANSFER",
            amount: sweepCents,
            fromCategoryId: category.id,
            toCategoryId: unassigned.id,
            note: `Auto-sweep on deletion of subtree "${category.name}" (${subtreeIds.length} bucket${subtreeIds.length === 1 ? "" : "s"})`,
          },
        });
      }

      // Delete deepest-first so foreign keys never reference a missing parent.
      // We have the ids in BFS order from collectSubtreeIds; reverse it.
      const ordered = [...subtreeIds].reverse();
      for (const id of ordered) {
        await tx.category.delete({ where: { id } });
      }

      await assertBalanceInvariant(tx, userId);
    });

    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
