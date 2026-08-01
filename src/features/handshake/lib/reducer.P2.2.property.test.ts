// Property test P2.2 — "Terminal states are absorbing" (design §J.2).
//
// Validates: Requirements 12.3
//
// A handshake in any terminal state (SETTLED, DECLINED, WITHDRAWN, EXPIRED,
// CANCELLED) must reject every possible action. No transition ever leaves a
// terminal state -- the machine has reached a fixed point. This property
// guarantees that the absorbing quality holds for all action types, regardless
// of the handshake's internal content (offers, attestations, etc.).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  reduceHandshake,
  isTerminal,
  type HandshakeAction,
  type HandshakeActionType,
  type OfferInput,
} from '@/features/handshake/lib/reducer';
import type { Handshake, HandshakeState, Offer } from '@/types/handshake';
import type { PublicIdentity } from '@/types/user';

// ---- arbitraries ------------------------------------------------------------

const TERMINAL_STATES: HandshakeState[] = ['SETTLED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED'];

const ALL_ACTION_TYPES: HandshakeActionType[] = [
  'COUNTER', 'ACCEPT', 'DECLINE', 'WITHDRAW', 'EXPIRE',
  'START', 'CANCEL', 'ATTEST_DONE', 'ATTEST_PAID', 'DISPUTE', 'RESOLVE',
];

const publicIdentityArb: fc.Arbitrary<PublicIdentity> = fc.record({
  uid: fc.string({ minLength: 1, maxLength: 8 }),
  handle: fc.string({ minLength: 1, maxLength: 8 }),
  displayName: fc.string({ minLength: 1, maxLength: 8 }),
  avatarSeed: fc.string({ minLength: 1, maxLength: 8 }),
  rank: fc.constantFrom('TAPPED_IN' as const, 'HUSTLER' as const, 'LEGEND' as const, 'MAX_CHARISMA' as const, 'MYTH' as const),
  rep: fc.nat(1000),
  verified: fc.boolean(),
  gigsSettled: fc.nat(100),
  rating: fc.oneof(fc.constant(null), fc.double({ min: 1, max: 5, noNaN: true, noDefaultInfinity: true })),
  ratingCount: fc.nat(100),
});

function terminalHandshakeArb(): fc.Arbitrary<Handshake> {
  return fc.record({
    state: fc.constantFrom(...TERMINAL_STATES),
    posterUid: fc.string({ minLength: 1, maxLength: 8 }),
    doerUid: fc.string({ minLength: 1, maxLength: 8 }),
  }).chain(({ state, posterUid, doerUid }) => {
    const fixedDoerUid = doerUid === posterUid ? doerUid + 'x' : doerUid;
    const offer0: Offer = {
      seq: 0,
      byUid: fixedDoerUid,
      price: 500,
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
      state,
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

function buildAction(actionType: HandshakeActionType, posterUid: string, doerUid: string): HandshakeAction {
  switch (actionType) {
    case 'COUNTER':
      return { type: 'COUNTER', byUid: posterUid, offer: { price: 500, date: '2025-03-15', startTime: '10:00' } as OfferInput };
    case 'ACCEPT':
      return { type: 'ACCEPT', byUid: posterUid, seq: 0 };
    case 'DECLINE':
      return { type: 'DECLINE', byUid: posterUid };
    case 'WITHDRAW':
      return { type: 'WITHDRAW', byUid: posterUid };
    case 'EXPIRE':
      return { type: 'EXPIRE' };
    case 'START':
      return { type: 'START', byUid: posterUid };
    case 'CANCEL':
      return { type: 'CANCEL', byUid: posterUid };
    case 'ATTEST_DONE':
      return { type: 'ATTEST_DONE', byUid: posterUid };
    case 'ATTEST_PAID':
      return { type: 'ATTEST_PAID', byUid: posterUid, method: 'cash' };
    case 'DISPUTE':
      return { type: 'DISPUTE', byUid: posterUid, reason: 'test' };
    case 'RESOLVE':
      return { type: 'RESOLVE', byModerator: 'mod1', outcome: 'settle' };
  }
}

// ---- property ---------------------------------------------------------------

describe('P2.2 terminal states are absorbing (req 12.3)', () => {
  it('rejects every action from any terminal state', () => {
    fc.assert(
      fc.property(
        terminalHandshakeArb(),
        fc.constantFrom(...ALL_ACTION_TYPES),
        fc.nat(),
        (h, actionType, now) => {
          expect(isTerminal(h.state)).toBe(true);
          const action = buildAction(actionType, h.posterUid, h.doerUid);
          const r = reduceHandshake(h, action, now);
          expect(r.ok).toBe(false);
          if (!r.ok) {
            expect(r.error).toBe('ILLEGAL_STATE');
          }
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});
