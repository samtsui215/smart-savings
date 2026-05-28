/**
 * Helpers for the category tree.
 *
 * The tree can be arbitrarily deep, so we walk it iteratively to avoid stack
 * surprises on pathological inputs. Cycle prevention assumes input edges
 * already form a tree (they do — DB allows null parent only) and only checks
 * the *proposed* edge, walking ancestors until we hit null or the moving id.
 */
import type { Prisma } from "@prisma/client";

/** Ancestor walk: would moving `nodeId` under `proposedParentId` create a cycle? */
export async function wouldCreateCycle(
  tx: Prisma.TransactionClient,
  userId: string,
  nodeId: string,
  proposedParentId: string,
): Promise<boolean> {
  if (nodeId === proposedParentId) return true;

  let cursor: string | null = proposedParentId;
  // Hard cap on depth to defend against corrupted data — under healthy data
  // the loop exits at the root long before this.
  for (let hops = 0; hops < 10_000; hops++) {
    if (cursor === null) return false;
    if (cursor === nodeId) return true;
    const parent: { parentId: string | null } | null = await tx.category.findFirst({
      where: { id: cursor, userId },
      select: { parentId: true },
    });
    if (!parent) return false;
    cursor = parent.parentId;
  }
  throw new Error("Category tree exceeded depth limit — likely a cycle in data");
}

/** Collect every descendant id of `rootId` (inclusive). Iterative BFS. */
export async function collectSubtreeIds(
  tx: Prisma.TransactionClient,
  userId: string,
  rootId: string,
): Promise<string[]> {
  const result: string[] = [rootId];
  let frontier: string[] = [rootId];

  while (frontier.length > 0) {
    const next: { id: string }[] = await tx.category.findMany({
      where: { userId, parentId: { in: frontier } },
      select: { id: true },
    });
    if (next.length === 0) break;
    const ids = next.map((c) => c.id);
    result.push(...ids);
    frontier = ids;
  }
  return result;
}
