// Ephemeral UI state ONLY (design §G.3 rule 4, requirement 30.8).
// Never store server data here, and never route-derived state — the Field/Board mode, the
// scrubber hour, filters, and surface all live in the URL (requirement 25.1, 25.5) and are read
// via @/hooks/useUrlState. What remains here is genuinely transient: the open drawer / active
// signal and the in-progress compose draft.
import { create } from 'zustand';

export interface ComposeDraft {
  title: string;
  body: string;
  askPrice: number | null;
  tags: string[];
  startDate: string;
  startTime: string;
  urgent: boolean;
}

export const emptyComposeDraft: ComposeDraft = {
  title: '',
  body: '',
  askPrice: null,
  tags: [],
  startDate: '',
  startTime: 'FLEXIBLE',
  urgent: false,
};

interface UiState {
  // Field drawer + active signal (transient interaction state, not addressable).
  drawerOpen: boolean;
  activeSignalId: string | null;
  openSignal: (id: string) => void;
  closeDrawer: () => void;

  // Compose draft (ephemeral; offline persistence is Phase 5).
  composeDraft: ComposeDraft;
  setComposeDraft: (patch: Partial<ComposeDraft>) => void;
  resetComposeDraft: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: false,
  activeSignalId: null,
  openSignal: (id) => set({ drawerOpen: true, activeSignalId: id }),
  closeDrawer: () => set({ drawerOpen: false, activeSignalId: null }),

  composeDraft: emptyComposeDraft,
  setComposeDraft: (patch) => set((s) => ({ composeDraft: { ...s.composeDraft, ...patch } })),
  resetComposeDraft: () => set({ composeDraft: emptyComposeDraft }),
}));
