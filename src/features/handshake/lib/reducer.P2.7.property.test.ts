// Property test P2.7 — "Settlement requires both attestations or moderator resolution"
// (design §J.2).
//
// Validates: Requirements 12.11
//
// A handshake can only reach SETTLED through one of two paths: (a) both parties
// have attested completion (Object.keys(attestations.done).length === 2), or
// (b) a moderator resolved the dispute in favour of settlement (the
// wasModeratorResolved flag is set). This property ensures no code path allows
// a handshake to become SETTLED without satisfying one of these two conditions.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  reduceHandshake,
  createHandshake,
  type HandshakeAction,
  type OfferInput,
  type CreateHandshakeInput,
} from '@/features/handshake/lib/reducer';
import type { Handshake } from '@/types/handshake';
import type { PublicIdentity } from '@/types/user';

// ---- helpers ----------------------------------------------------------------

const POSTER_UID = 'poster1';
const DOER_UID = 'doer1';

const posterSnapshot: PublicIdentity = {
  uid: POSTER_UID,
  handle: 'poster',
  displayName: 'Poster',
  avatarSeed: 'a',
  rank: 'TAPPED_IN',
  rep: 0,
  verified: true,
  gigsSettled: 0,
  rating: null,
  ratingCount: 0,
};

const doerSnapshot: PublicIdentity = {
  uid: DOER_UID,
  handle: 'doer',
  displayName: 'Doer',
  avatarSeed: 'b',
  rank: 'TAPPED_IN',
  rep: 0,
  verified: true,
  gigsSettled: 0,
  rating: null,
  ratingCount: 0,
};

function freshHandshake(): Handshake {
  const input: CreateHandshakeInput = {
    id: 'gig1_doer1',
    gigId: 'gig1',
    hoodId: 'hood1',
    posterUid: POSTER_UID,
    doerUid: DOER_UID,
    posterSnapshot,
    doerSnapshot,
    threadId: 'thread1',
    offer: { byUid: DOER_UID, price: 500, date: '2025-03-15', startTime: '10:00' },
  };
  const result = createHandshake(input, 1000);
  if (!result.ok) throw new Error('freshHandshake failed');
  return result.handshake;
}

// ---- arbitraries ------------------------------------------------------------

function handshakeActionArb(): fc.Arbitrary<HandshakeAction> {
  return fc.oneof(
    fc.record({
      type: fc.constant('COUNTER' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
      offer: fc.record({
        price: fc.integer({ min: 1, max: 100_000 }),
        date: fc.constant('2025-03-15'),
        startTime: fc.constant('10:00'),
      }) as fc.Arbitrary<OfferInput>,
    }),
    fc.record({
      type: fc.constant('ACCEPT' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
      seq: fc.nat(50),
    }),
    fc.record({
      type: fc.constant('DECLINE' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
    }),
    fc.record({
      type: fc.constant('WITHDRAW' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
    }),
    fc.constant({ type: 'EXPIRE' as const }),
    fc.record({
      type: fc.constant('START' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
    }),
    fc.record({
      type: fc.constant('CANCEL' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
    }),
    fc.record({
      type: fc.constant('ATTEST_DONE' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
    }),
    fc.record({
      type: fc.constant('ATTEST_PAID' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
      method: fc.constantFrom('upi' as const, 'cash' as const),
    }),
    fc.record({
      type: fc.constant('DISPUTE' as const),
      byUid: fc.constantFrom(POSTER_UID, DOER_UID),
      reason: fc.constant('test'),
    }),
    fc.constant({ type: 'RESOLVE' as const, byModerator: 'mod1', outcome: 'settle' as const }),
    fc.constant({ type: 'RESOLVE' as const, byModerator: 'mod1', outcome: 'void' as const }),
  );
}

// ---- property ---------------------------------------------------------------

describe('P2.7 settlement requires both attestations or moderator resolution (req 12.11)', () => {
  it('every reachable SETTLED state has both attestations or wasModeratorResolved', () => {
    fc.assert(
      fc.property(
        fc.array(handshakeActionArb(), { maxLength: 40 }),
        (actions) => {
          let h = freshHandshake();
          for (const a of actions) {
            const r = reduceHandshake(h, a, Date.now());
            if (r.ok) h = r.next;
          }

          // Only assert on handshakes that reached SETTLED
          if (h.state === 'SETTLED') {
            const bothAttested = Object.keys(h.attestations.done).length === 2;
            const moderatorResolved = h.wasModeratorResolved === true;
            expect(bothAttested || moderatorResolved).toBe(true);
          }

          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
