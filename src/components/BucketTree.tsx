"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CategoryDTO } from "@/types";
import type { CategoryNode } from "@/lib/tree";
import { flattenForSelect, descendantSet } from "@/lib/tree";
import { centsToDollars } from "@/lib/money";
import { colorForCategory, initialOf, type BucketColor } from "@/lib/palette";

import {
  DndContext, PointerSensor, KeyboardSensor,
  closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove,
  sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Single-card Buckets table with drag-to-reorder.
 *
 * One DndContext wraps everything; each sibling group (roots + each parent's
 * children) gets its own SortableContext, so dragging stays within siblings.
 * To move across parents the user still uses the row's Edit form.
 *
 * On drag end:
 *   1. Optimistically reorder the local view via arrayMove.
 *   2. POST the new orderedIds to /api/categories/reorder.
 *   3. Refresh the dashboard so server state wins on conflict.
 */
export default function BucketTree({
  tree,
  onChange,
}: {
  tree: CategoryNode[];
  onChange: () => void;
}) {
  const total = tree.reduce((s, n) => s + n.category.rollupCents, 0);

  // Optimistic shadow of the tree so the dragged row settles smoothly before
  // the server round-trip completes.
  const [override, setOverride] = useState<CategoryNode[] | null>(null);
  const effective = override ?? tree;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function persistReorder(parentId: string | null, orderedIds: string[]) {
    try {
      await api("/api/categories/reorder", {
        method: "POST",
        json: { parentId, orderedIds },
      });
      onChange();
    } catch (e) {
      console.error("reorder failed", e);
      setOverride(null);
      onChange();
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as { parentId: string | null } | undefined;
    const overData   = over.data.current  as { parentId: string | null } | undefined;
    if (!activeData || !overData) return;
    if (activeData.parentId !== overData.parentId) return; // cross-group not supported here

    const parentId = activeData.parentId;
    const next = reorderTreeGroup(effective, parentId, String(active.id), String(over.id));
    if (!next) return;
    setOverride(next);

    const ids = siblingsAt(next, parentId).map((n) => n.category.id);
    void persistReorder(parentId, ids);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <section className="card overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100">
          <div className="flex items-center gap-2.5">
            <span className="size-1.5 rounded-full bg-accent-500" />
            <h2 className="text-sm font-semibold tracking-tight text-ink-900">Buckets</h2>
            <span className="text-xs text-ink-500">· {countAll(effective)} total</span>
          </div>
          <span className="text-xs text-ink-500 tabular">${centsToDollars(total)}</span>
        </header>

        {effective.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">
            No buckets yet — add one below to get started.
          </div>
        ) : (
          <SortableGroup nodes={effective} parentId={null} allRoots={effective} onChange={onChange} />
        )}
      </section>
    </DndContext>
  );
}

/* --------------------------- sortable group --------------------------- */

/**
 * Wraps one sibling group in a SortableContext. Recursively renders each
 * child's children in their own SortableContext so deeper levels are also
 * draggable.
 */
function SortableGroup({
  nodes, parentId, allRoots, onChange,
}: {
  nodes:    CategoryNode[];
  parentId: string | null;
  allRoots: CategoryNode[];
  onChange: () => void;
}) {
  const ids = nodes.map((n) => n.category.id);
  return (
    <ul className="divide-y divide-ink-100">
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => (
          <BucketRowWithChildren
            key={node.category.id}
            node={node}
            parentId={parentId}
            allRoots={allRoots}
            onChange={onChange}
          />
        ))}
      </SortableContext>
    </ul>
  );
}

function BucketRowWithChildren({
  node, parentId, allRoots, onChange,
}: {
  node:     CategoryNode;
  parentId: string | null;
  allRoots: CategoryNode[];
  onChange: () => void;
}) {
  return (
    <>
      <BucketRow node={node} parentId={parentId} allRoots={allRoots} onChange={onChange} />
      {node.children.length > 0 && (
        <li>
          <SortableGroup
            nodes={node.children}
            parentId={node.category.id}
            allRoots={allRoots}
            onChange={onChange}
          />
        </li>
      )}
    </>
  );
}

/* --------------------------- single row --------------------------- */

function BucketRow({
  node, parentId, allRoots, onChange,
}: {
  node:     CategoryNode;
  parentId: string | null;
  allRoots: CategoryNode[];
  onChange: () => void;
}) {
  const c           = node.category;
  const color       = colorForCategory(c);
  const pct         = c.progress != null ? Math.round(c.progress * 100) : null;
  const reached     = pct != null && pct >= 100;
  const hasChildren = node.children.length > 0;
  const indent      = Math.min(node.depth, 6) * 22;

  const [editing, setEditing] = useState(false);
  const [adding,  setAdding]  = useState(false);

  // Every bucket is draggable, including Unassigned. We used to pin
  // Unassigned to the top with an isUnassigned-first orderBy, but that
  // silently overrode any drag that placed another bucket above it —
  // users saw their drag "revert" on refresh. Now position alone wins.
  const sortable = useSortable({
    id: c.id,
    data: { parentId },
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  return (
    <li
      ref={setNodeRef}
      className={`group relative ${isDragging ? "opacity-60 z-10 shadow-lift" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {/* Left accent — appears on hover, picks up bucket color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition"
        style={{ background: color.hex }}
      />

      <div
        className="flex items-center gap-2 pr-3 sm:pr-5 py-3 hover:bg-ink-50/70 transition"
        style={{ paddingLeft: 16 + indent }}
      >
        {/* Drag handle holds the drag listeners so the rest of the row
            stays clickable for edit/add/etc. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          aria-label="Drag to reorder"
          className="size-6 grid place-items-center text-ink-300 hover:text-ink-600 cursor-grab active:cursor-grabbing opacity-40 max-sm:opacity-70 group-hover:opacity-100 transition -ml-2"
        >
          <DragGlyph />
        </button>

        {node.depth > 0 && (
          <span aria-hidden className="text-ink-300 text-[11px] -ml-1 select-none">└</span>
        )}

        <Avatar color={color} letter={initialOf(c.name)} size={node.depth === 0 ? "lg" : "sm"} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={
                node.depth === 0
                  ? "font-semibold text-ink-900 truncate"
                  : "text-sm text-ink-800 truncate"
              }
            >
              {c.name}
            </span>
            {c.isUnassigned && <span className="chip-neutral">system</span>}
            {hasChildren && (
              <span className="chip-neutral">
                {node.children.length} sub{node.children.length === 1 ? "" : "s"}
              </span>
            )}
            {reached && <span className="chip-success">goal</span>}
            {c.isLow && !c.isUnassigned && <span className="chip-warning">low</span>}
          </div>
          {pct != null && c.targetAmount && (
            <div className="mt-2 flex items-center gap-2 max-w-[320px]">
              <div className="h-1.5 flex-1 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: reached
                      ? "linear-gradient(90deg, #10b981, #059669)"
                      : `linear-gradient(90deg, ${color.hex}aa, ${color.hex})`,
                  }}
                />
              </div>
              <span className="text-[11px] text-ink-500 tabular shrink-0">
                {pct}% · ${c.targetAmount}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span
            className={`tabular whitespace-nowrap ${
              node.depth === 0
                ? "text-lg font-semibold text-ink-900"
                : "text-sm font-medium text-ink-800"
            }`}
          >
            ${c.rollupBalance}
          </span>
          {hasChildren && c.balanceCents > 0 && (
            <span className="text-[10px] text-ink-500 tabular">
              ${c.balance} loose
            </span>
          )}
        </div>

        {!c.isUnassigned && (
          <RowActions
            onAdd={() => { setAdding((v) => !v); setEditing(false); }}
            onEdit={() => { setEditing((v) => !v); setAdding(false); }}
            category={c}
            onChange={onChange}
          />
        )}
      </div>

      {(editing || adding) && (
        <div
          className="bg-ink-50/60 border-y border-ink-100 px-5 py-3"
          style={{ paddingLeft: 40 + indent }}
        >
          {editing && (
            <EditForm
              node={node}
              allRoots={allRoots}
              onClose={() => setEditing(false)}
              onChange={onChange}
            />
          )}
          {adding && (
            <AddChildForm
              parentId={c.id}
              onClose={() => setAdding(false)}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </li>
  );
}

/* --------------------------- atoms --------------------------- */

function DragGlyph() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <circle cx="2" cy="2"  r="1.2" />
      <circle cx="8" cy="2"  r="1.2" />
      <circle cx="2" cy="7"  r="1.2" />
      <circle cx="8" cy="7"  r="1.2" />
      <circle cx="2" cy="12" r="1.2" />
      <circle cx="8" cy="12" r="1.2" />
    </svg>
  );
}

function Avatar({
  color, letter, size,
}: {
  color:  BucketColor;
  letter: string;
  size:   "lg" | "sm";
}) {
  const dim = size === "lg" ? "size-9 text-sm" : "size-7 text-xs";
  return (
    <span
      aria-hidden
      className={`${dim} grid place-items-center rounded-lg font-semibold text-white shrink-0 ring-1 ring-inset ring-black/5`}
      style={{
        background: `linear-gradient(135deg, ${color.hex}, ${color.hex}cc)`,
        boxShadow: `0 1px 2px ${color.hex}33`,
      }}
    >
      {letter}
    </span>
  );
}

function RowActions({
  onAdd, onEdit, category, onChange,
}: {
  onAdd:    () => void;
  onEdit:   () => void;
  category: CategoryDTO;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0 opacity-60 max-sm:opacity-100 group-hover:opacity-100 transition">
      <button
        onClick={onAdd}
        title="Add sub-bucket"
        className="size-7 grid place-items-center rounded-md text-ink-500 hover:text-accent-700 hover:bg-accent-50 transition"
      >＋</button>
      <button
        onClick={onEdit}
        title="Edit"
        className="size-7 grid place-items-center rounded-md text-ink-500 hover:text-ink-800 hover:bg-ink-100 transition"
      >✎</button>
      <DeleteButton category={category} onChange={onChange} />
    </div>
  );
}

function DeleteButton({ category, onChange }: { category: CategoryDTO; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!confirm(`Delete "${category.name}"? Its balance (and any sub-buckets) will be moved into Unassigned.`)) return;
    setBusy(true);
    try {
      await api(`/api/categories/${category.id}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={remove}
      disabled={busy}
      title="Delete"
      className="size-7 grid place-items-center rounded-md text-ink-500 hover:text-red-700 hover:bg-red-50 transition disabled:opacity-50"
    >🗑</button>
  );
}

/* --------------------------- inline forms --------------------------- */

function EditForm({
  node, allRoots, onClose, onChange,
}: {
  node:     CategoryNode;
  allRoots: CategoryNode[];
  onClose:  () => void;
  onChange: () => void;
}) {
  const c = node.category;
  const [name, setName]         = useState(c.name);
  const [target, setTarget]     = useState(c.targetAmount ?? "");
  const [parentId, setParentId] = useState<string>(c.parentId ?? "");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const blocked = descendantSet(allRoots, c.id);
  const opts    = flattenForSelect(allRoots).filter((o) => !blocked.has(o.id) && !o.isUnassigned);

  async function save() {
    setBusy(true); setError(null);
    try {
      await api(`/api/categories/${c.id}`, {
        method: "PATCH",
        json: {
          name: c.isUnassigned ? undefined : name,
          targetAmount: target === "" ? null : target,
          parentId: c.isUnassigned ? undefined : (parentId === "" ? null : parentId),
        },
      });
      onClose();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid sm:grid-cols-3 gap-2.5 items-end animate-fade-in">
      {!c.isUnassigned && (
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div>
        <label className="label">Target ($)</label>
        <input
          className="input"
          inputMode="decimal"
          placeholder="optional"
          value={target ?? ""}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>
      {!c.isUnassigned && (
        <div>
          <label className="label">Lives inside</label>
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Top level —</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <div className="sm:col-span-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="sm:col-span-3 flex gap-2">
        <button className="btn-primary text-xs px-3 py-1.5" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button className="btn-ghost   text-xs px-3 py-1.5" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function AddChildForm({
  parentId, onClose, onChange,
}: {
  parentId: string;
  onClose:  () => void;
  onChange: () => void;
}) {
  const [name, setName]     = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/categories", {
        method: "POST",
        json: { name, parentId, targetAmount: target || null },
      });
      onClose();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-3 gap-2.5 items-end animate-fade-in">
      <div>
        <label className="label">New sub-bucket</label>
        <input className="input" required placeholder="e.g. Interest" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Target ($)</label>
        <input className="input" inputMode="decimal" placeholder="optional" value={target} onChange={(e) => setTarget(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary text-xs px-3 py-1.5" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
        <button className="btn-ghost   text-xs px-3 py-1.5" type="button" onClick={onClose}>Cancel</button>
      </div>
      {error && (
        <div className="sm:col-span-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </form>
  );
}

/* --------------------------- helpers --------------------------- */

function countAll(nodes: CategoryNode[]): number {
  let n = 0;
  function walk(list: CategoryNode[]) {
    for (const node of list) {
      n++;
      walk(node.children);
    }
  }
  walk(nodes);
  return n;
}

/** Get the sibling list within the tree for a given parent. */
function siblingsAt(nodes: CategoryNode[], parentId: string | null): CategoryNode[] {
  if (parentId === null) return nodes;
  function find(list: CategoryNode[]): CategoryNode[] | null {
    for (const n of list) {
      if (n.category.id === parentId) return n.children;
      const sub = find(n.children);
      if (sub) return sub;
    }
    return null;
  }
  return find(nodes) ?? [];
}

/**
 * Returns a new tree with the sibling group at `parentId` reordered so that
 * `activeId` is moved into the position currently occupied by `overId`.
 * Pure function — does not mutate the input.
 */
function reorderTreeGroup(
  nodes: CategoryNode[],
  parentId: string | null,
  activeId: string,
  overId: string,
): CategoryNode[] | null {
  if (parentId === null) {
    const idx1 = nodes.findIndex((n) => n.category.id === activeId);
    const idx2 = nodes.findIndex((n) => n.category.id === overId);
    if (idx1 < 0 || idx2 < 0) return null;
    return arrayMove(nodes, idx1, idx2);
  }

  let changed = false;
  function walk(list: CategoryNode[]): CategoryNode[] {
    return list.map((node) => {
      if (node.category.id === parentId) {
        const idx1 = node.children.findIndex((n) => n.category.id === activeId);
        const idx2 = node.children.findIndex((n) => n.category.id === overId);
        if (idx1 < 0 || idx2 < 0) return node;
        changed = true;
        return { ...node, children: arrayMove(node.children, idx1, idx2) };
      }
      return { ...node, children: walk(node.children) };
    });
  }
  const next = walk(nodes);
  return changed ? next : null;
}
