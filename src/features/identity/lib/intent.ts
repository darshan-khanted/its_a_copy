// Preserved gated-action intent (design §E.1, requirements 23.2, 23.3).
//
// When an unauthenticated (or, for a claim, unverified) user triggers an action that
// requires an account, the App Shell records the *intended action* so the single-step
// auth sheet can resume it afterwards — without gating navigation (req 23.7). This is the
// current app's `intendedAction` machinery, kept and extended to preserve the complete
// claim intent: gig id, human one-liner, offered price, and availability response, so the
// Claim Flow can resume across both auth and identity verification (design §E.1). The
// eligibility re-check + atomic submit lands in Phase 2 (task 5.2); this module owns the
// pure, ephemeral preservation contract those flows consume.
import { create } from 'zustand';

export type IntentKind = 'claim' | 'flare' | 'chat';

/**
 * The complete claim intent preserved across auth and verification (design §E.1).
 * Every field is optional because the claim ritual (task 5.6) fills the one-liner,
 * offer, and availability; a claim triggered straight from a signal only carries the
 * gig id until then.
 */
export interface ClaimIntentPayload {
  gigId: string;
  oneLiner?: string;
  offer?: number;
  availability?: string;
}

export interface PendingIntent {
  kind: IntentKind;
  /** The route to return to so the action can resume after authentication. */
  returnTo: string;
  /** Preserved claim payload — only present for `kind: 'claim'`. */
  claim?: ClaimIntentPayload;
  createdAt: number;
}

interface IntentState {
  pending: PendingIntent | null;
  /** Record the intended action before opening the auth sheet. */
  setIntent: (intent: PendingIntent) => void;
  /** Read and clear the pending intent in a single step (safe to call once, post-auth). */
  consumeIntent: () => PendingIntent | null;
  /** Discard the pending intent without resuming (e.g. the user dismissed the sheet). */
  clearIntent: () => void;
}

export const useIntentStore = create<IntentState>((set, get) => ({
  pending: null,
  setIntent: (intent) => set({ pending: intent }),
  consumeIntent: () => {
    const current = get().pending;
    if (current) set({ pending: null });
    return current;
  },
  clearIntent: () => set({ pending: null }),
}));
