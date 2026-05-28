/**
 * Per-bucket color identity.
 *
 * Each bucket gets a deterministic color picked from a curated palette via a
 * stable hash of its id. The same id always yields the same color, so the
 * pie slice, the row avatar, the row progress bar, and the transaction-list
 * dot all line up visually. New buckets don't shuffle existing colors.
 *
 * Colors are saturated enough to read on white but not neon. Unassigned
 * always uses a neutral slate so it never visually competes with real
 * categories.
 */

const PALETTE = [
  "#7c3aed", // violet 600
  "#2563eb", // blue 600
  "#059669", // emerald 600
  "#d97706", // amber 600
  "#db2777", // pink 600
  "#0891b2", // cyan 600
  "#dc2626", // red 600
  "#65a30d", // lime 600
  "#9333ea", // purple 600
  "#0284c7", // sky 600
] as const;

const UNASSIGNED = "#94a3b8"; // slate 400

/** djb2-style hash → palette index. Stable across runs and machines. */
function hash(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (h * 33) ^ id.charCodeAt(i);
  }
  return h >>> 0;
}

export interface BucketColor {
  hex: string;        // main color
  bg:  string;        // 12%-alpha tint for soft backgrounds
  fg:  string;        // text color (white for solid colored chips)
}

export function colorForCategory(c: { id: string; isUnassigned: boolean }): BucketColor {
  const hex = c.isUnassigned ? UNASSIGNED : PALETTE[hash(c.id) % PALETTE.length];
  return {
    hex,
    bg: hex + "1f", // ~12% alpha
    fg: "#ffffff",
  };
}

/** Convenient initial letter for the avatar — handles empty names. */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "•";
}
