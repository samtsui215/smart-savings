/**
 * API response types. The API serialises money as dollar-strings
 * ("123.45") to avoid float ambiguity over the wire.
 */
export interface CategoryDTO {
  id: string;
  name: string;
  parentId: string | null;
  balance: string;            // own balance only (the row's value)
  balanceCents: number;
  rollupBalance: string;      // own + descendants — what users see on a parent
  rollupCents: number;
  targetAmount: string | null;
  targetCents: number | null;
  progress: number | null;    // progress measured against rollup
  remainingToTarget: string | null;
  isUnassigned: boolean;
  isLow: boolean;
}

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: string;
  note: string | null;
  createdAt: string;
  category:     { id: string; name: string } | null;
  fromCategory: { id: string; name: string } | null;
  toCategory:   { id: string; name: string } | null;
}

export interface DashboardDTO {
  email: string;
  totalBalance: string;
  consistent: boolean;
  categories: CategoryDTO[];
  recent: TransactionDTO[];
}

export interface AffordResponse {
  affordable: boolean;
  amount: string;
  totalAvailable?: string;
  message: string;
  suggestion: {
    mode: "single" | "multi";
    buckets: { id: string; name: string; take: string }[];
  } | null;
}
