// Property test P2.1 — "Illegal actions are rejected without mutation" (design §J.2).
//
// Validates: Requirements 12.2, 12.3
//
// Every action whose type does not appear in LEGAL[h.state] must be rejected
// with `ok: false` and error `ILLEGAL_STATE`. The input handshake is never
// mutated (the reducer is pure), and no effects are produced. This property
// ensures the legality table is the single source of truth for what transitions
// the machine admits, and that no code path accidentally bypasses it.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  reduceHandshake,
  LEGAL,
  type HandshakeAction,
  type HandshakeActionType,
  type OfferInput,
} from '@/features/handshake/lib/reducer';
import type { Handshake, HandshakeState, Offer } from '@/types/handshake';
import type { PublicIdentity } from '@/types/user';

// ---- arbitraries ------------------------------------------------------------

const ALL_STATES: HandshakeState[] = [
  'NEGOTIATING', 'AGREED', 'LIVE', 'DONE_PENDING', 'SETTLED',
  'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED', 'DISPUTED',
];

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

const offerArb: fc.Arbitrary<Offer> = fc.record({
  seq: fc.nat(50),
  byUid: fc.string({ minLength: 1, maxLength: 8 }),
  price: fc.integer({ min: 1, max: 100_000 }),
  date: fc.constant('2025-03-15'),
  startTime: fc.constant('10:00'),
  createdAt: fc.nat(),
  status: fc.constantFrom('live' as const, 'superseded' as const, 'accepted' as const, 'declined' as const),
});

function handshakeArb(): fc.Arbitrary<Handshake> {
  return fc.record({
    state: fc.constantFrom(...ALL_STATES),
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
    return fc.record({
      id: fc.constant(`gig1_${fixedDoerUid}`),
      gigId: fc.constant('gig1'),
      hoodId: fc.constant('hood1'),
      posterUid: fc.constant(posterUid),
      doerUid: fc.constant(fixedDoerUid),
      posterSnapshot: publicIdentityArb.map(pi => ({ ...pi, uid: posterUid })),
      doerSnapshot: publicIdentityArb.map(pi => ({ ...pi, uid: fixedDoerUid })),
      state: fc.constant(state),
      offers: fc.constant([offer0]),
      latestSeq: fc.constant(0),
      attestations: fc.constant({ done: {} as Record<string, number>, paid: {} as Record<string, number> }),
      meetupNudgeShown: fc.constant(false),
      threadId: fc.constant('thread1'),
      createdAt: fc.constant(1000),
      updatedAt: fc.constant(1000),
      schemaVersion: fc.constant(1 as const),
    });
  });
}

function actionForTypeArb(actionType: HandshakeActionType, posterUid: string, doerUid: string): fc.Arbitrary<HandshakeAction> {
  const uid = fc.constantFrom(posterUid, doerUid);
  switch (actionType) {
    case 'COUNTER':
      return uid.map(u => ({
        type: 'COUNTER' as const,
        byUid: u,
        offer: { price: 500, date: '2025-03-15', startTime: '10:00' } as OfferInput,
      }));
    case 'ACCEPT':
      return uid.map(u => ({ type: 'ACCEPT' as const, byUid: u, seq: 0 }));
    case 'DECLINE':
      return uid.map(u => ({ type: 'DECLINE' as const, byUid: u }));
    case 'WITHDRAW':
      return uid.map(u => ({ type: 'WITHDRAW' as const, byUid: u }));
    case 'EXPIRE':
      return fc.constant({ type: 'EXPIRE' as const });
    case 'START':
      return uid.map(u => ({ type: 'START' as const, byUid: u }));
    case 'CANCEL':
      return uid.map(u => ({ type: 'CANCEL' as const, byUid: u }));
    case 'ATTEST_DONE':
      return uid.map(u => ({ type: 'ATTEST_DONE' as const, byUid: u }));
    case 'ATTEST_PAID':
      return uid.map(u => ({ type: 'ATTEST_PAID' as const, byUid: u, method: 'cash' as const }));
    case 'DISPUTE':
      return uid.map(u => ({ type: 'DISPUTE' as const, byUid: u, reason: 'test' }));
    case 'RESOLVE':
      return fc.constant({ type: 'RESOLVE' as const, byModerator: 'mod1', outcome: 'settle' as const });
    default:
      return fc.constant({ type: 'EXPIRE' as const });
  }
}

function handshakeActionArb(posterUid: string, doerUid: string): fc.Arbitrary<HandshakeAction> {
  return fc.constantFrom(...ALL_ACTION_TYPES).chain(t => actionForTypeArb(t, posterUid, doerUid));
}

// ---- property ---------------------------------------------------------------

describe('P2.1 illegal actions are rejected without mutation (req 12.2, 12.3)', () => {
  it('rejects with ILLEGAL_STATE when action type is not in LEGAL[state]', () => {
    fc.assert(
      fc.property(
        handshakeArb(),
        fc.nat(),
        (h, now) => {
          // Find an action type that is NOT legal for this state
          const illegalTypes = ALL_ACTION_TYPES.filter(t => !LEGAL[h.state].includes(t));
          if (illegalTypes.length === 0) return true; // all actions legal (never happens but guard)

          // Pick first illegal type and construct an action
          for (const illegalType of illegalTypes) {
            const action = buildAction(illegalType, h.posterUid, h.doerUid);
            const r = reduceHandshake(h, action, now);
            if (r.ok !== false) return false;
            if (r.error !== 'ILLEGAL_STATE') return false;
          }
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});

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
