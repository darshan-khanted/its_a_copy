// Property test P2.8 — "Unverified claims preserve intent; verified rank-01 gets exactly one
// active claim allowance" (design §J.2).
//
// Validates: Requirements 11.10, 11.11, 11.13, 17.12
//
// The pure recheckClaimEligibility function has three distinct behaviours for a
// rank-01 (TAPPED_IN) verified user depending on their active claim count:
//   - 0 active claims: returns 'ready' (the single slot is available)
//   - 1 active claim: returns 'recheck-failed' with reason 'CLAIM_LIMIT_REACHED'
// Additionally, for any gig that is NOT in OPEN state, the function rejects
// with 'GIG_NOT_OPEN' regardless of rank or claim count. And for any rank
// lower than the gig's minRank, it rejects with 'RANK_TOO_LOW'.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  recheckClaimEligibility,
  type GigEligibility,
} from '@/features/identity/hooks/useVerificationGate';
import { RANK_ORDER } from '@/features/rep/lib/unlocks';
import type { RankId } from '@/types/user';
import type { GigState } from '@/types/gig';

// ---- arbitraries ------------------------------------------------------------

const ALL_GIG_STATES: GigState[] = ['OPEN', 'MATCHED', 'LIVE', 'DONE', 'CLOSED', 'CANCELLED', 'EXPIRED'];
const NON_OPEN_STATES: GigState[] = ['MATCHED', 'LIVE', 'DONE', 'CLOSED', 'CANCELLED', 'EXPIRED'];

const gigIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 12 });

function openGigArb(): fc.Arbitrary<GigEligibility> {
  return fc.record({
    id: gigIdArb,
    state: fc.constant('OPEN' as GigState),
    minRank: fc.constant(null as RankId | null),
  });
}

function nonOpenGigArb(): fc.Arbitrary<GigEligibility> {
  return fc.record({
    id: gigIdArb,
    state: fc.constantFrom(...NON_OPEN_STATES),
    minRank: fc.oneof(
      fc.constant(null as RankId | null),
      fc.constantFrom(...RANK_ORDER),
    ),
  });
}

// ---- properties -------------------------------------------------------------

describe('P2.8 unverified claims preserve intent; verified rank-01 gets exactly one active claim allowance (req 11.10, 11.11, 11.13, 17.12)', () => {
  it('a verified TAPPED_IN user with 0 active claims on an OPEN gig gets ready', () => {
    fc.assert(
      fc.property(
        openGigArb(),
        (gig) => {
          const result = recheckClaimEligibility(gig, 'TAPPED_IN', 0);
          expect(result.outcome).toBe('ready');
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });

  it('a verified TAPPED_IN user with 1 active claim gets CLAIM_LIMIT_REACHED', () => {
    fc.assert(
      fc.property(
        openGigArb(),
        fc.integer({ min: 1, max: 100 }),
        (gig, claimCount) => {
          const result = recheckClaimEligibility(gig, 'TAPPED_IN', claimCount);
          expect(result.outcome).toBe('recheck-failed');
          expect(result.reason).toBe('CLAIM_LIMIT_REACHED');
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });

  it('any non-OPEN gig state yields GIG_NOT_OPEN regardless of rank or claims', () => {
    fc.assert(
      fc.property(
        nonOpenGigArb(),
        fc.constantFrom(...RANK_ORDER),
        fc.nat(10),
        (gig, rank, claimCount) => {
          const result = recheckClaimEligibility(gig, rank, claimCount);
          expect(result.outcome).toBe('recheck-failed');
          expect(result.reason).toBe('GIG_NOT_OPEN');
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
