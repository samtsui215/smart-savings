import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ReorderBody } from "@/lib/validation";
import { apiError, ok } from "@/lib/http";

/**
 * POST /api/categories/reorder
 *   { parentId: string | null, orderedIds: string[] }
 *
 * Persists the new order for one sibling group. The caller sends every id
 * in the group exactly once; the server assigns positions 0..N from the
 * array index. We refuse partial updates — that way the on-disk ordering
 * always matches what the client just sent, no stale gaps to reconcile.
 *
 * Defends against:
 *   - ids not owned by this user
 *   - ids whose actual parentId disagrees with the requested group
 *   - duplicates or missing ids inside the group (we compare set membership)
 *
 * All updates happen inside a single Prisma transaction so a mid-flight
 * failure rolls back without leaving the group in a half-renumbered state.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = ReorderBody.parse(await req.json());

    // Detect duplicate ids in the request — easy client mistake.
    if (new Set(body.orderedIds).size !== body.orderedIds.length) {
      return apiError(
        Object.assign(new Error("orderedIds contains duplicates"), { status: 400 }),
      );
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.category.findMany({
        where: { userId, parentId: body.parentId },
        select: { id: true },
      });
      const currentIds = new Set(current.map((c) => c.id));
      const requestedIds = new Set(body.orderedIds);

      // The arrays must cover the same set; otherwise the client and server
      // disagree on what's in the group and a renumber would silently drop
      // or duplicate buckets.
      if (currentIds.size !== requestedIds.size) {
        throw Object.assign(
          new Error("orderedIds must contain every sibling in the group, exactly once"),
          { status: 400 },
        );
      }
      for (const id of requestedIds) {
        if (!currentIds.has(id)) {
          throw Object.assign(
            new Error(`Bucket ${id} is not in the requested parent group`),
            { status: 400 },
          );
        }
      }

      // Update positions in array order. Sequential 0..N — the gaps from
      // deletions/moves get reset every time the user drags.
      for (let i = 0; i < body.orderedIds.length; i++) {
        await tx.category.update({
          where: { id: body.orderedIds[i] },
          data: { position: i },
        });
      }
    });

    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
