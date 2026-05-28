/**
 * Zustand store for the dashboard. Why Zustand and not Context:
 *   - The dashboard mutates often (after every transaction) and a single
 *     React Context update re-renders every consumer; Zustand's selector
 *     subscription model lets each component subscribe only to the slice
 *     it actually needs.
 *
 * The store is a thin cache over /api/dashboard — every mutation triggers
 * a refetch rather than re-implementing the balance math on the client.
 * Keeping the server as the single source of truth means the invariant
 * cannot drift between front and back ends.
 */
import { create } from "zustand";
import { api } from "@/lib/api";
import type { DashboardDTO } from "@/types";

interface State {
  data: DashboardDTO | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setError: (msg: string | null) => void;
}

export const useDashboard = create<State>((set) => ({
  data: null,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api<DashboardDTO>("/api/dashboard");
      set({ data, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  setError: (msg) => set({ error: msg }),
}));
