// Gate an account-required action behind auth and hood-launch status (design §E.1, §C.7,
// requirements 8.10, 23.1, 23.2, 23.3, 23.7).
//
// The contract, stated once so every caller behaves identically:
//   - Navigation is NEVER gated (req 23.7). This gates *actions* — claiming, flaring,
//     chatting — not routes.
//   - When the hood is not live, flaring and claiming are withheld (req 8.10): the gate
//     returns `hood-not-live` and the caller shows the pre-launch experience instead.
//   - When the user is unauthenticated, the intended action is recorded and the single-step
//     auth sheet is opened over the current location (req 23.2, 23.3). After authentication
//     the AuthSheet resumes the action by returning to `returnTo`.
//   - Only when every gate passes does the action proceed immediately.
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { useModalNavigate } from '@/hooks/useModalNavigate';
import { canActInHood } from '@/features/hood/lib/stats';
import {
  useIntentStore,
  type ClaimIntentPayload,
  type IntentKind,
  type PendingIntent,
} from '@/features/identity/lib/intent';

export type GateOutcome = 'ready' | 'needs-auth' | 'hood-not-live';

export interface GateRequest {
  kind: IntentKind;
  /**
   * Whether the hood must be `live` for this action (true for flare and claim, false for
   * account-only actions like chatting). Defaults to true.
   */
  requireLiveHood?: boolean;
  /** Where to resume after auth. Defaults to the current path + search. */
  returnTo?: string;
  /** Preserved claim payload for `kind: 'claim'` (gig id, one-liner, offer, availability). */
  claim?: ClaimIntentPayload;
}

export interface UseGatedActionResult {
  /**
   * Attempt a gated action. Runs `proceed` only when authenticated and (if required) the
   * hood is live; otherwise records intent + opens the auth sheet, or reports `hood-not-live`.
   * Returns the outcome so callers can surface the pre-launch experience or auth affordance.
   */
  gate: (request: GateRequest, proceed?: () => void) => GateOutcome;
  /** True when the active hood permits flaring/claiming (design §C.7). */
  hoodLive: boolean;
  /** True when a Firebase account is present. */
  authed: boolean;
}

export function useGatedAction(): UseGatedActionResult {
  const { firebaseUser } = useSession();
  const { hood } = useHoodContext();
  const { openModal } = useModalNavigate();
  const location = useLocation();
  const setIntent = useIntentStore((s) => s.setIntent);

  const hoodLive = canActInHood(hood);
  const authed = Boolean(firebaseUser);

  const gate = useCallback(
    (request: GateRequest, proceed?: () => void): GateOutcome => {
      const requireLiveHood = request.requireLiveHood ?? true;

      // 1. Launch gate — flaring and claiming are withheld until the hood is live (req 8.10).
      if (requireLiveHood && !hoodLive) return 'hood-not-live';

      // 2. Auth gate — record the intended action, then open the single-step sheet (req 23.2/23.3).
      if (!authed) {
        const intent: PendingIntent = {
          kind: request.kind,
          returnTo: request.returnTo ?? location.pathname + location.search,
          claim: request.claim,
          createdAt: Date.now(),
        };
        setIntent(intent);
        openModal('/auth');
        return 'needs-auth';
      }

      // 3. Every gate passed — run the action now.
      proceed?.();
      return 'ready';
    },
    [authed, hoodLive, location.pathname, location.search, openModal, setIntent],
  );

  return { gate, hoodLive, authed };
}
