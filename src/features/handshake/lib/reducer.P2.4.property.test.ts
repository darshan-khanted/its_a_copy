// Property test P2.4 — "Stale offers cannot be accepted" (design §J.2).
//
// Validates: Requirements 12.5
//
// An ACCEPT that references any sequence number other than `h.latestSeq` is
// rejected with STALE_OFFER. This prevents race conditions where a party sees
// an old offer while a newer counter has already been submitted. The property
// holds for any non-latest seq value, whether it existed at some point or never
// did.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  reduceHandshake,
  otherParticipant,
  type OfferInput,
} from '@/features/handshake/lib/reducer';
import type { Handshake, Offer } from '@/types/handshake';
import type { PublicIdentity } from '@/types/user';

// ---- arbitraries ------------------------------------------------------------

function negotiatingHandshakeWithMultipleOffersArb(): fc.Arbitrary<Handshake> {
  return fc.record({
    posterUid: fc.string({ minLength: 1, maxLength: 8 }),
    doerUid: fc.string({ minLength: 1, maxLength: 8 }),
    numOffers: fc.integer({ min: 2, max: 10 }),
  }).chain(({ posterUid, doerUid, numOffers }) => {
    const fixedDoerUid = doerUid === posterUid ? doerUid + 'x' : doerUid;
    const parties = [fixedDoerUid, posterUid];
    const offers: Offer[] = [];
    for (let i = 0; i < numOffers; i++) {
      offers.push({
        seq: i,
        byUid: parties[i % 2],
        price: 100 * (i + 1),
        date: '2025-03-15',
        startTime: '10:00',
        createdAt: 1000 + i,
        status: i === numOffers - 1 ? 'live' : 'superseded',
      });
    }
    return fc.constant<Handshake>({
      id: `gig1_${fixedDoerUid}`,
      gigId: 'gig1',
      hoodId: 'hood1',
      posterUid,
      doerUid: fixedDoerUid,
      posterSnapshot: { uid: posterUid, handle: 'poster', displayName: 'Poster', avatarSeed: 'a', rank: 'TAPPED_IN', rep: 0, verified: true, gigsSettled: 0, rating: null, ratingCount: 0 },
      doerSnapshot: { uid: fixedDoerUid, handle: 'doer', displayName: 'Doer', avatarSeed: 'b', rank: 'TAPPED_IN', rep: 0, verified: true, gigsSettled: 0, rating: null, ratingCount: 0 },
      state: 'NEGOTIATING',
      offers,
      latestSeq: numOffers - 1,
      attestations: { done: {}, paid: {} },
      meetupNudgeShown: false,
      threadId: 'thread1',
      createdAt: 1000,
      updatedAt: 1000 + numOffers,
      schemaVersion: 1,
    });
  });
}

// ---- property ---------------------------------------------------------------

describe('P2.4 stale offers cannot be accepted (req 12.5)', () => {
  it('rejects ACCEPT with STALE_OFFER when seq != latestSeq', () => {
    fc.assert(
      fc.property(
        negotiatingHandshakeWithMultipleOffersArb(),
        fc.nat(100),
        fc.nat(),
        (h, staleSeqRaw, now) => {
          // Ensure the stale seq is different from latestSeq
          const staleSeq = staleSeqRaw === h.latestSeq
            ? (h.latestSeq > 0 ? h.latestSeq - 1 : h.latestSeq + 1)
            : staleSeqRaw;
          fc.pre(staleSeq !== h.latestSeq);

          // The counterparty (the one who did NOT author the latest offer) attempts accept
          const latestAuthor = h.offers[h.latestSeq].byUid;
          const other = otherParticipant(h, latestAuthor);
          const r = reduceHandshake(h, { type: 'ACCEPT', byUid: other, seq: staleSeq }, now);
          expect(r.ok).toBe(false);
          if (!r.ok) {
            expect(r.error).toBe('STALE_OFFER');
          }
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
