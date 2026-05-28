import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CategoryCreateBody } from "@/lib/validation";
import { apiError, ok } from "@/lib/http";
import { dollarsToCents, centsToDollars } from "@/lib/money";

export async function GET() {
  try {
    const { userId } = await requireSession();
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    return ok({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        balance: centsToDollars(c.balance),
        targetAmount: c.targetAmount != null ? centsToDollars(c.targetAmount) : null,
        isUnassigned: c.isUnassigned,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = CategoryCreateBody.parse(await req.json());

    const targetCents =
      body.targetAmount == null ? null : dollarsToCents(body.targetAmount);
    if (targetCents != null && targetCents <= 0) {
      return apiError(
        Object.assign(new Error("targetAmount must be positive"), { status: 400 }),
      );
    }

    // Validate proposed parent: must exist, belong to this user, and not be
    // the Unassigned system bucket (we keep that flat to avoid surprises).
    if (body.parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: body.parentId, userId },
        select: { id: true, isUnassigned: true },
      });
      if (!parent) {
        return apiError(Object.assign(new Error("Parent category not found"), { status: 404 }));
      }
      if (parent.isUnassigned) {
        return apiError(
          Object.assign(new Error("The Unassigned bucket cannot contain sub-buckets"), { status: 400 }),
        );
      }
    }

    // Append the new bucket to the end of its sibling group. We compute
    // max(position) for the same (userId, parentId) and use max+1. If no
    // siblings exist yet, this resolves to 0.
    const lastSibling = await prisma.category.findFirst({
      where: { userId, parentId: body.parentId ?? null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = lastSibling ? lastSibling.position + 1 : 0;

    const created = await prisma.category.create({
      data: {
        userId,
        name: body.name,
        targetAmount: targetCents,
        parentId: body.parentId ?? null,
        position: nextPosition,
      },
    });

    return ok({
      category: {
        id: created.id,
        name: created.name,
        parentId: created.parentId,
        balance: centsToDollars(created.balance),
        targetAmount: created.targetAmount != null ? centsToDollars(created.targetAmount) : null,
        isUnassigned: created.isUnassigned,
      },
    }, 201);
  } catch (e) {
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      return apiError(Object.assign(new Error("A category with that name already exists"), { status: 409 }));
    }
    return apiError(e);
  }
}
