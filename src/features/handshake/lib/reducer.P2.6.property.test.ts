// Property test P2.6 — "Offer sequences remain contiguous, append-only, and singly accepted"
// (design §J.2).
//
// Validates: Requirements 12.7, 12.10
//
// After driving a fresh handshake through an arbitrary sequence of actions
// (some legal, some rejected), the resulting offers array must satisfy three
// invariants: (1) seq values are contiguous from 0, (2) at most one offer has
// status 'accepted', (3) if agreed is set, its price matches the accepted
// offer's price. These invariants ensure the offer history is a clean append-
// only log that the UI and settlement logic can trust unconditionally.

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
  );
}

// ---- property ---------------------------------------------------------------

describe('P2.6 offer sequences remain contiguous, append-only, and singly accepted (req 12.7, 12.10)', () => {
  it('maintains contiguous seq, at most one accepted, and agreed matches accepted offer', () => {
    fc.assert(
      fc.property(
        fc.array(handshakeActionArb(), { maxLength: 40 }),
        (actions) => {
          let h = freshHandshake();
          for (const a of actions) {
            const r = reduceHandshake(h, a, Date.now());
            if (r.ok) h = r.next;
          }

          // Invariant 1: seq values are contiguous from 0
          const seqContiguous = h.offers.every((o, i) => o.seq === i);
          expect(seqContiguous).toBe(true);

          // Invariant 2: at most one offer has status 'accepted'
          const acceptedCount = h.offers.filter(o => o.status === 'accepted').length;
          expect(acceptedCount).toBeLessThanOrEqual(1);

          // Invariant 3: if agreed is set, price matches the accepted offer
          if (h.agreed != null) {
            const acceptedOffer = h.offers[h.agreed.agreedOfferSeq];
            expect(acceptedOffer).toBeDefined();
            expect(h.agreed.price).toBe(acceptedOffer.price);
          }

          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
