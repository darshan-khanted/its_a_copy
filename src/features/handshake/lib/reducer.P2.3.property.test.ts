// Property test P2.3 — "Self-accept is always rejected" (design §J.2).
//
// Validates: Requirements 12.4
//
// The author of the latest offer can never accept it themselves. This enforces
// the fundamental negotiation invariant: agreement requires the OTHER party's
// consent. The reducer must reject with SELF_ACCEPT regardless of the offer's
// content, the handshake's history, or the timestamp.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  reduceHandshake,
  type OfferInput,
} from '@/features/handshake/lib/reducer';
import type { Handshake, Offer } from '@/types/handshake';
import type { PublicIdentity } from '@/types/user';

// ---- arbitraries ------------------------------------------------------------

function negotiatingHandshakeArb(): fc.Arbitrary<Handshake> {
  return fc.record({
    posterUid: fc.string({ minLength: 1, maxLength: 8 }),
    doerUid: fc.string({ minLength: 1, maxLength: 8 }),
    offerByPoster: fc.boolean(),
    price: fc.integer({ min: 1, max: 100_000 }),
  }).chain(({ posterUid, doerUid, offerByPoster, price }) => {
    const fixedDoerUid = doerUid === posterUid ? doerUid + 'x' : doerUid;
    const offerAuthor = offerByPoster ? posterUid : fixedDoerUid;
    const offer0: Offer = {
      seq: 0,
      byUid: offerAuthor,
      price,
      date: '2025-03-15',
      startTime: '10:00',
      createdAt: 1000,
      status: 'live',
    };
    return fc.constant<Handshake>({
      id: `gig1_${fixedDoerUid}`,
      gigId: 'gig1',
      hoodId: 'hood1',
      posterUid,
      doerUid: fixedDoerUid,
      posterSnapshot: { uid: posterUid, handle: 'poster', displayName: 'Poster', avatarSeed: 'a', rank: 'TAPPED_IN', rep: 0, verified: true, gigsSettled: 0, rating: null, ratingCount: 0 },
      doerSnapshot: { uid: fixedDoerUid, handle: 'doer', displayName: 'Doer', avatarSeed: 'b', rank: 'TAPPED_IN', rep: 0, verified: true, gigsSettled: 0, rating: null, ratingCount: 0 },
      state: 'NEGOTIATING',
      offers: [offer0],
      latestSeq: 0,
      attestations: { done: {}, paid: {} },
      meetupNudgeShown: false,
      threadId: 'thread1',
      createdAt: 1000,
      updatedAt: 1000,
      schemaVersion: 1,
    });
  });
}

// ---- property ---------------------------------------------------------------

describe('P2.3 self-accept is always rejected (req 12.4)', () => {
  it('rejects ACCEPT when byUid matches the latest offer author', () => {
    fc.assert(
      fc.property(
        negotiatingHandshakeArb(),
        fc.nat(),
        (h, now) => {
          const author = h.offers[h.latestSeq].byUid;
          const r = reduceHandshake(h, { type: 'ACCEPT', byUid: author, seq: h.latestSeq }, now);
          expect(r.ok).toBe(false);
          if (!r.ok) {
            expect(r.error).toBe('SELF_ACCEPT');
          }
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
