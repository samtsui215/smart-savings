/**
 * Client-side tree helpers. The API returns a flat list; we shape it into
 * roots + lookups for rendering and indented option lists.
 */
import type { CategoryDTO } from "@/types";

export interface CategoryNode {
  category: CategoryDTO;
  children: CategoryNode[];
  depth: number;
}

export function buildTree(flat: CategoryDTO[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of flat) nodes.set(c.id, { category: c, children: [], depth: 0 });

  // Iterate the flat array in its server-given order. The API already
  // sorts by user-chosen position, so roots and each parent's children
  // are pushed in the correct order — we must NOT re-sort here, or any
  // drag the user did would silently revert on refresh.
  const roots: CategoryNode[] = [];
  for (const c of flat) {
    const node = nodes.get(c.id)!;
    if (node.category.parentId && nodes.has(node.category.parentId)) {
      nodes.get(node.category.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Stamp depth without reordering.
  function setDepth(list: CategoryNode[], depth: number) {
    for (const n of list) {
      n.depth = depth;
      setDepth(n.children, depth + 1);
    }
  }
  setDepth(roots, 0);
  return roots;
}

/** Flatten the tree to an indented list for <select> options. */
export function flattenForSelect(roots: CategoryNode[]): { id: string; label: string; depth: number; isUnassigned: boolean }[] {
  const out: { id: string; label: string; depth: number; isUnassigned: boolean }[] = [];
  function walk(node: CategoryNode) {
    const indent = "— ".repeat(node.depth);
    out.push({
      id: node.category.id,
      label: `${indent}${node.category.name}`,
      depth: node.depth,
      isUnassigned: node.category.isUnassigned,
    });
    for (const child of node.children) walk(child);
  }
  for (const r of roots) walk(r);
  return out;
}

/** Returns the set of ids "below" rootId, inclusive — used to prevent
 *  picking a descendant as a new parent. */
export function descendantSet(roots: CategoryNode[], rootId: string): Set<string> {
  const set = new Set<string>();
  function find(node: CategoryNode): CategoryNode | null {
    if (node.category.id === rootId) return node;
    for (const c of node.children) {
      const f = find(c);
      if (f) return f;
    }
    return null;
  }
  let target: CategoryNode | null = null;
  for (const r of roots) {
    target = find(r);
    if (target) break;
  }
  if (!target) return set;
  function collect(node: CategoryNode) {
    set.add(node.category.id);
    for (const c of node.children) collect(c);
  }
  collect(target);
  return set;
}
