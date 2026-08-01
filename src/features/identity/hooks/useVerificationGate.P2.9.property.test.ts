// Property test P2.9 — "Preserved claims resume only when every eligibility gate still passes"
// (design §J.2).
//
// Validates: Requirements 11.10, 11.12, 11.13, 17.12
//
// The recheckClaimEligibility function must check ALL three gates in order:
// (1) gig state is OPEN, (2) viewer rank meets gig's minRank, (3) active claim
// count is below the rank's allowance. A preserved claim can only resume (reach
// 'ready' outcome) when ALL gates pass simultaneously. This property exercises
// all combinations of gig state, rank vs minRank, and active claims vs
// allowance to verify the gate logic is correct and complete.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  recheckClaimEligibility,
  type GigEligibility,
  type ClaimGateResult,
} from '@/features/identity/hooks/useVerificationGate';
import { RANK_ORDER, rankIndex, unlocksForRank } from '@/features/rep/lib/unlocks';
import type { RankId } from '@/types/user';
import type { GigState } from '@/types/gig';

// ---- arbitraries ------------------------------------------------------------

const ALL_GIG_STATES: GigState[] = ['OPEN', 'MATCHED', 'LIVE', 'DONE', 'CLOSED', 'CANCELLED', 'EXPIRED'];

function gigEligibilityArb(): fc.Arbitrary<GigEligibility> {
  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 12 }),
    state: fc.constantFrom(...ALL_GIG_STATES),
    minRank: fc.oneof(
      fc.constant(null as RankId | null),
      fc.constantFrom(...RANK_ORDER),
    ),
  });
}

// ---- property ---------------------------------------------------------------

describe('P2.9 preserved claims resume only when every eligibility gate still passes (req 11.10, 11.12, 11.13, 17.12)', () => {
  it('ready is returned if and only if all three gates pass', () => {
    fc.assert(
      fc.property(
        gigEligibilityArb(),
        fc.constantFrom(...RANK_ORDER),
        fc.nat(10),
        (gig, viewerRank, activeClaimCount) => {
          const result = recheckClaimEligibility(gig, viewerRank, activeClaimCount);

          // Compute expected gate results
          const gigIsOpen = gig.state === 'OPEN';
          const rankSufficient = gig.minRank == null || rankIndex(viewerRank) >= rankIndex(gig.minRank);
          const allowance = unlocksForRank(viewerRank).maxActiveClaims;
          const claimsWithinLimit = activeClaimCount < allowance;

          const allPass = gigIsOpen && rankSufficient && claimsWithinLimit;

          if (allPass) {
            expect(result.outcome).toBe('ready');
          } else {
            expect(result.outcome).toBe('recheck-failed');
            // Verify the correct reason is reported (gates are checked in order)
            if (!gigIsOpen) {
              expect(result.reason).toBe('GIG_NOT_OPEN');
            } else if (!rankSufficient) {
              expect(result.reason).toBe('RANK_TOO_LOW');
            } else {
              expect(result.reason).toBe('CLAIM_LIMIT_REACHED');
            }
          }

          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
