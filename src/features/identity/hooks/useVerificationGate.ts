// Claim-specific identity-verification gate and preserved-action orchestration (design §E.1,
// §E.3 sequence; requirements 11.10, 11.11, 11.12, 11.13, 17.12, 23.2, 23.3, 23.4, 23.5).
//
// This is NOT a general-purpose gate — that is `useGatedAction` (auth + hood-liveness only).
// A claim carries one extra, claim-specific eligibility gate beyond auth: approved identity
// verification, plus the rank-derived active-claim allowance. Verification itself is available
// on demand at any time after account creation (req 23.4) — it is NOT mandatory at signup —
// but it IS mandatory here, at the claim boundary (req 11.11), because claiming is the
// highest-risk action in the product (design §E.1).
//
// Contract, stated once so every caller behaves identically:
//   - On a claim attempt by an unauthenticated user: preserve the complete claim intent
//     (`ClaimIntentPayload`) via `setIntent` and open the single-step auth sheet. Verification
//     is checked only once the user is authenticated, so an unauthenticated + unverified user
//     is chained through auth FIRST (req 23.2, 23.3); the doer's next claim attempt — after
//     returning from auth — is what advances them to the verification gate below. This mirrors
//     `useGatedAction`'s re-invoke-on-return philosophy rather than threading state through
//     `AuthSheet` (which is generic and consumes/clears any pending intent on its own).
//   - On a claim attempt by an authenticated but unverified doer: preserve the same intent and
//     route to identity verification (`/me/verify`); create no handshake, thread, first
//     message, or claim-count increment (req 11.11).
//   - Whether verification was just approved or was already approved, every claim attempt
//     RECHECKS eligibility before proceeding — the design's own sequence (§E.1) runs the same
//     three checks in both branches: (a) the gig is still `OPEN`, (b) the viewer meets the
//     gig's `minRank`, (c) the viewer's active-claim count is below their rank's allowance
//     (verified rank-01 = exactly 1, req 11.13, 17.12). This hook NEVER calls a claim-creation
//     path itself — atomic claim submission is task 5.5's boundary. On success it reports
//     `ready` so the caller can hand off to that endpoint; on failure it reports a reason and,
//     when resuming a preserved intent, retains that intent unchanged (req 11.12).
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { useModalNavigate } from '@/hooks/useModalNavigate';
import { rankIndex, unlocksForRank } from '@/features/rep/lib/unlocks';
import { useIntentStore, type ClaimIntentPayload } from '@/features/identity/lib/intent';
import type { GigState, RankId } from '@/types';

/** The minimum a caller must know about a gig to run the eligibility recheck. */
export interface GigEligibility {
  id: string;
  state: GigState;
  minRank: RankId | null;
}

export type ClaimGateReason = 'GIG_NOT_OPEN' | 'RANK_TOO_LOW' | 'CLAIM_LIMIT_REACHED';

export interface ClaimGateResult {
  outcome: 'needs-auth' | 'needs-verification' | 'ready' | 'recheck-failed';
  reason?: ClaimGateReason;
  /** Plain-language reason, for a caller that has no more specific copy yet (task 5.6 owns
   *  the ritual UI that states "the limit and the rank that raises it", req 11.10). */
  message?: string;
}

/**
 * TODO(task 5.5): replace with a real count of the doer's active (non-terminal) handshakes
 * once the atomic claim-creation endpoint and Handshake data model land. Active-claim
 * allowance enforcement (req 11.10, 11.13, 17.12) is meaningless without a real count, so any
 * caller that cares about that gate accurately SHOULD inject `getActiveClaimCount` once that
 * model exists. This stub intentionally reports zero so the OTHER two rechecks (gig state,
 * `minRank`) are still exercised end-to-end today, and so a verified rank-01 doer is never
 * incorrectly blocked before the real limit can be enforced.
 */
async function defaultGetActiveClaimCount(_uid: string): Promise<number> {
  return 0;
}

/**
 * Pure recheck (design §E.1/§E.3 sequence, req 11.10, 11.12, 11.13, 17.12). Exported
 * separately so it can be exercised directly by the property tests in tasks 5.3/5.4 without
 * mounting the hook.
 */
export function recheckClaimEligibility(
  gig: GigEligibility,
  viewerRank: RankId,
  activeClaimCount: number,
): ClaimGateResult {
  if (gig.state !== 'OPEN') {
    return {
      outcome: 'recheck-failed',
      reason: 'GIG_NOT_OPEN',
      message: 'this signal is no longer open',
    };
  }

  if (gig.minRank != null && rankIndex(viewerRank) < rankIndex(gig.minRank)) {
    return {
      outcome: 'recheck-failed',
      reason: 'RANK_TOO_LOW',
      message: `this one needs ${gig.minRank.toLowerCase()} or higher`,
    };
  }

  const allowance = unlocksForRank(viewerRank).maxActiveClaims;
  if (activeClaimCount >= allowance) {
    return {
      outcome: 'recheck-failed',
      reason: 'CLAIM_LIMIT_REACHED',
      message: `you have hit your ${allowance}-claim limit at this rank`,
    };
  }

  return { outcome: 'ready' };
}

export interface UseVerificationGateOptions {
  /** See {@link defaultGetActiveClaimCount}. Injectable ahead of task 5.5. */
  getActiveClaimCount?: (uid: string) => number | Promise<number>;
}

export interface UseVerificationGateResult {
  /**
   * Run every claim gate for a fresh attempt (design §E.1/§E.3): auth, then verification,
   * then the full eligibility recheck. Never creates claim artifacts — on `ready` the caller
   * hands off to task 5.5's atomic submit endpoint.
   */
  attemptClaim: (gig: GigEligibility, claim: ClaimIntentPayload) => Promise<ClaimGateResult>;
  /**
   * Resume a preserved claim intent once verification is approved (req 11.12). `getGig` loads
   * the current gig state so the recheck reflects reality, not the state at attempt time.
   * Retains the preserved intent unchanged on any failure; consumes it only on `ready`.
   */
  resumeClaim: (
    getGig: (gigId: string) => GigEligibility | null | Promise<GigEligibility | null>,
  ) => Promise<ClaimGateResult>;
  /** True once a Firebase account exists. */
  authed: boolean;
  /** True once identity verification has been approved (`users/{uid}.verified`). */
  verified: boolean;
}

export function useVerificationGate(
  options: UseVerificationGateOptions = {},
): UseVerificationGateResult {
  const { firebaseUser, user } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const { openModal } = useModalNavigate();
  const setIntent = useIntentStore((s) => s.setIntent);
  const getActiveClaimCount = options.getActiveClaimCount ?? defaultGetActiveClaimCount;

  const authed = Boolean(firebaseUser);
  const verified = Boolean(user?.verified);

  const attemptClaim = useCallback(
    async (gig: GigEligibility, claim: ClaimIntentPayload): Promise<ClaimGateResult> => {
      const returnTo = location.pathname + location.search;

      // 1. Auth gate (req 23.2, 23.3) — verification is meaningless before an account exists,
      // so an unauthenticated doer is chained through auth first; their next claim attempt
      // (after returning to `returnTo`) is what reaches gate 2.
      if (!authed) {
        setIntent({ kind: 'claim', returnTo, claim, createdAt: Date.now() });
        openModal('/auth');
        return { outcome: 'needs-auth' };
      }

      // 2. Identity-verification gate (req 11.11, 23.4, design §E.1) — required before a
      // FIRST claim, but verification remains available on demand at any other time.
      if (!verified) {
        setIntent({ kind: 'claim', returnTo, claim, createdAt: Date.now() });
        navigate('/me/verify');
        return { outcome: 'needs-verification' };
      }

      // 3. Every remaining eligibility gate, unconditionally (req 11.10, 11.12, 11.13, 17.12).
      const activeClaimCount = await getActiveClaimCount(firebaseUser!.uid);
      return recheckClaimEligibility(gig, user!.rank, activeClaimCount);
    },
    [authed, verified, location.pathname, location.search, openModal, navigate, setIntent, getActiveClaimCount, firebaseUser, user],
  );

  const resumeClaim = useCallback(
    async (
      getGig: (gigId: string) => GigEligibility | null | Promise<GigEligibility | null>,
    ): Promise<ClaimGateResult> => {
      const pending = useIntentStore.getState().pending;
      if (!pending || pending.kind !== 'claim' || !pending.claim) {
        return { outcome: 'recheck-failed', message: 'no preserved claim to resume' };
      }

      // Still mid-chain (e.g. verification was submitted but is only `pending`, not yet
      // `approved`) — retain the intent untouched and report where the doer still stands.
      if (!authed) return { outcome: 'needs-auth' };
      if (!verified) return { outcome: 'needs-verification' };

      const gig = await getGig(pending.claim.gigId);
      const result = gig
        ? recheckClaimEligibility(gig, user!.rank, await getActiveClaimCount(firebaseUser!.uid))
        : ({
            outcome: 'recheck-failed',
            reason: 'GIG_NOT_OPEN',
            message: 'this signal is gone',
          } satisfies ClaimGateResult);

      if (result.outcome === 'ready') {
        // Every gate passed — consume the intent now. Task 5.5 owns the actual atomic submit;
        // this boundary intentionally stops here.
        useIntentStore.getState().consumeIntent();
      }
      // Any failure retains the preserved intent unchanged (req 11.12) — it was never
      // consumed on this path, so there is nothing further to do to "retain" it.
      return result;
    },
    [authed, verified, getActiveClaimCount, firebaseUser, user],
  );

  return { attemptClaim, resumeClaim, authed, verified };
}
