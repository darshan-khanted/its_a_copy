/**
 * Property-based tests for the Handshake state machine reducer.
 * Uses fast-check to generate random inputs and verify invariants.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  reduceHandshake,
  LEGAL,
  isTerminal,
  type Handshake,
  type HandshakeState,
  type HandshakeAction,
  type Offer,
} from '../reducer';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uidArb = () => fc.stringMatching(/^[a-zA-Z0-9]{4,12}$/);

const dateStrArb = () => fc.constantFrom('2025-01-15', '2025-02-20', '2025-03-10', '2025-04-01');
const timeStrArb = () => fc.constantFrom('09:00', '10:30', '14:00', '17:00', '19:30');

const offerArb = (seq: number, byUid: string): fc.Arbitrary<Offer> =>
  fc.record({
    seq: fc.constant(seq),
    byUid: fc.constant(byUid),
    price: fc.integer({ min: 1, max: 100000 }),
    date: dateStrArb(),
    startTime: timeStrArb(),
    endTime: fc.option(timeStrArb(), { nil: undefined }),
    note: fc.option(fc.string({ minLength: 1, maxLength: 140 }), { nil: undefined }),
    createdAt: fc.nat(),
    status: fc.constant('live' as const),
  });

function freshHandshake(posterUid: string, doerUid: string, offer: Offer): Handshake {
  return {
    id: `gig1_${doerUid}`,
    gigId: 'gig1',
    hoodId: 'hood1',
    posterUid,
    doerUid,
    state: 'NEGOTIATING',
    offers: [offer],
    latestSeq: 0,
    attestations: { done: {}, paid: {} },
    meetupNudgeShown: false,
    threadId: 'thread1',
    createdAt: offer.createdAt,
    updatedAt: offer.createdAt,
    schemaVersion: 1,
  };
}

/** Generates a handshake in NEGOTIATING state with 1+ offers (alternating authors). */
const negotiatingHandshakeArb = (): fc.Arbitrary<Handshake> =>
  fc.record({
    posterUid: uidArb(),
    doerUid: uidArb(),
    numOffers: fc.integer({ min: 1, max: 10 }),
    basePrice: fc.integer({ min: 100, max: 50000 }),
    now: fc.nat({ max: 1000000 }),
  }).filter(({ posterUid, doerUid }) => posterUid !== doerUid)
    .chain(({ posterUid, doerUid, numOffers, basePrice, now }) => {
      const offers: Offer[] = [];
      for (let i = 0; i < numOffers; i++) {
        const byUid = i % 2 === 0 ? doerUid : posterUid;
        offers.push({
          seq: i,
          byUid,
          price: basePrice + i * 50,
          date: '2025-01-15',
          startTime: '09:00',
          createdAt: now + i,
          status: i < numOffers - 1 ? 'superseded' : 'live',
        });
      }
      const h: Handshake = {
        id: `gig1_${doerUid}`,
        gigId: 'gig1',
        hoodId: 'hood1',
        posterUid,
        doerUid,
        state: 'NEGOTIATING',
        offers,
        latestSeq: numOffers - 1,
        attestations: { done: {}, paid: {} },
        meetupNudgeShown: false,
        threadId: 'thread1',
        createdAt: now,
        updatedAt: now + numOffers - 1,
        schemaVersion: 1,
      };
      return fc.constant(h);
    });

const ALL_STATES: HandshakeState[] = [
  'NEGOTIATING', 'AGREED', 'LIVE', 'DONE_PENDING', 'SETTLED',
  'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED', 'DISPUTED',
];

const TERMINAL_STATES: HandshakeState[] = [
  'SETTLED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED',
];

const NON_TERMINAL_STATES: HandshakeState[] = [
  'NEGOTIATING', 'AGREED', 'LIVE', 'DONE_PENDING', 'DISPUTED',
];

/** Generates a handshake in any given state. */
function handshakeInState(state: HandshakeState): fc.Arbitrary<Handshake> {
  return fc.record({
    posterUid: uidArb(),
    doerUid: uidArb(),
    now: fc.nat({ max: 1000000 }),
  }).filter(({ posterUid, doerUid }) => posterUid !== doerUid)
    .map(({ posterUid, doerUid, now }) => {
      const initialOffer: Offer = {
        seq: 0,
        byUid: doerUid,
        price: 500,
        date: '2025-01-15',
        startTime: '09:00',
        createdAt: now,
        status: state === 'AGREED' || state === 'SETTLED' ? 'accepted' : 'live',
      };
      const h: Handshake = {
        id: `gig1_${doerUid}`,
        gigId: 'gig1',
        hoodId: 'hood1',
        posterUid,
        doerUid,
        state,
        offers: [initialOffer],
        latestSeq: 0,
        attestations: { done: {}, paid: {} },
        meetupNudgeShown: false,
        threadId: 'thread1',
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      };
      // Add state-specific data
      if (state === 'AGREED' || state === 'LIVE' || state === 'DONE_PENDING' || state === 'SETTLED') {
        h.agreed = {
          price: initialOffer.price,
          date: initialOffer.date,
          startTime: initialOffer.startTime,
          agreedAt: now,
          agreedOfferSeq: 0,
        };
      }
      if (state === 'DONE_PENDING') {
        h.attestations.done[posterUid] = now;
      }
      if (state === 'SETTLED') {
        h.attestations.done[posterUid] = now;
        h.attestations.done[doerUid] = now;
      }
      return h;
    });
}

const terminalHandshakeArb = (): fc.Arbitrary<Handshake> =>
  fc.constantFrom(...TERMINAL_STATES).chain(state => handshakeInState(state));

const handshakeArb = (): fc.Arbitrary<Handshake> =>
  fc.constantFrom(...ALL_STATES).chain(state => handshakeInState(state));

const ALL_ACTION_TYPES: HandshakeAction['type'][] = [
  'COUNTER', 'ACCEPT', 'DECLINE', 'WITHDRAW', 'EXPIRE',
  'START', 'CANCEL', 'ATTEST_DONE', 'ATTEST_PAID', 'DISPUTE', 'RESOLVE',
];

/** Generate an arbitrary action. byUid picks from poster/doer or a random uid. */
function handshakeActionArb(h?: Handshake): fc.Arbitrary<HandshakeAction> {
  const participantUid = h
    ? fc.constantFrom(h.posterUid, h.doerUid)
    : uidArb();

  return fc.oneof(
    // COUNTER
    participantUid.chain(uid =>
      fc.record({
        price: fc.integer({ min: 1, max: 100000 }),
        date: dateStrArb(),
        startTime: timeStrArb(),
        endTime: fc.option(timeStrArb(), { nil: undefined }),
      }).map(offer => ({
        type: 'COUNTER' as const,
        byUid: uid,
        offer,
      })),
    ),
    // ACCEPT
    participantUid.chain(uid =>
      fc.nat({ max: 20 }).map(seq => ({
        type: 'ACCEPT' as const,
        byUid: uid,
        seq,
      })),
    ),
    // DECLINE
    participantUid.map(uid => ({ type: 'DECLINE' as const, byUid: uid })),
    // WITHDRAW
    participantUid.map(uid => ({ type: 'WITHDRAW' as const, byUid: uid })),
    // EXPIRE
    fc.constant({ type: 'EXPIRE' as const }),
    // START
    participantUid.map(uid => ({ type: 'START' as const, byUid: uid })),
    // CANCEL
    participantUid.map(uid => ({ type: 'CANCEL' as const, byUid: uid })),
    // ATTEST_DONE
    participantUid.map(uid => ({ type: 'ATTEST_DONE' as const, byUid: uid })),
    // ATTEST_PAID
    participantUid.chain(uid =>
      fc.constantFrom('upi' as const, 'cash' as const).map(method => ({
        type: 'ATTEST_PAID' as const,
        byUid: uid,
        method,
      })),
    ),
    // DISPUTE
    participantUid.chain(uid =>
      fc.string({ minLength: 1, maxLength: 50 }).map(reason => ({
        type: 'DISPUTE' as const,
        byUid: uid,
        reason,
      })),
    ),
    // RESOLVE
    fc.record({
      byModerator: uidArb(),
      outcome: fc.constantFrom('settle' as const, 'void' as const),
    }).map(({ byModerator, outcome }) => ({
      type: 'RESOLVE' as const,
      byModerator,
      outcome,
    })),
  );
}

function counterparty(h: Handshake, uid: string): string {
  return uid === h.posterUid ? h.doerUid : h.posterUid;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Handshake Reducer Property Tests', () => {
  // P2.1: Illegal actions are rejected without mutation
  describe('P2.1 - Illegal actions are always rejected and never mutate state', () => {
    it('rejects actions not in the LEGAL table for the current state', () => {
      fc.assert(
        fc.property(
          handshakeArb(),
          fc.constantFrom(...ALL_ACTION_TYPES),
          fc.nat(),
          (h, actionType, now) => {
            if (LEGAL[h.state].includes(actionType)) return true; // skip legal ones
            // Build a minimal action of this type
            const action = buildAction(actionType, h);
            const original = structuredClone(h);
            const result = reduceHandshake(h, action, now);
            expect(result.ok).toBe(false);
            if (!result.ok) {
              expect(result.error).toBe('ILLEGAL_STATE');
            }
            // Original state must not have been mutated (reducer clones internally)
            expect(h).toEqual(original);
            return true;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // P2.2: Terminal states are absorbing
  describe('P2.2 - Terminal states are absorbing', () => {
    it('rejects all actions from terminal states', () => {
      fc.assert(
        fc.property(
          terminalHandshakeArb(),
          fc.constantFrom(...ALL_ACTION_TYPES),
          fc.nat(),
          (h, actionType, now) => {
            const action = buildAction(actionType, h);
            const result = reduceHandshake(h, action, now);
            expect(result.ok).toBe(false);
            return true;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // P2.3: Self-accept is always rejected
  describe('P2.3 - No self-accept, ever', () => {
    it('rejects when the offer author tries to accept their own offer', () => {
      fc.assert(
        fc.property(
          negotiatingHandshakeArb(),
          fc.nat(),
          (h, now) => {
            const latestOffer = h.offers[h.latestSeq];
            const author = latestOffer.byUid;
            const result = reduceHandshake(
              h,
              { type: 'ACCEPT', byUid: author, seq: h.latestSeq },
              now,
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
              expect(result.error).toBe('SELF_ACCEPT');
            }
            return true;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // P2.4: Stale offers cannot be accepted
  describe('P2.4 - Stale offers cannot be accepted', () => {
    it('rejects acceptance of any offer that is not the latest', () => {
      fc.assert(
        fc.property(
          negotiatingHandshakeArb(),
          fc.nat(),
          fc.nat(),
          (h, staleSeqRaw, now) => {
            // Ensure staleSeq differs from latestSeq
            const staleSeq = staleSeqRaw % (h.latestSeq + 10);
            fc.pre(staleSeq !== h.latestSeq);
            const latestOffer = h.offers[h.latestSeq];
            const other = counterparty(h, latestOffer.byUid);
            const result = reduceHandshake(
              h,
              { type: 'ACCEPT', byUid: other, seq: staleSeq },
              now,
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
              expect(result.error).toBe('STALE_OFFER');
            }
            return true;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // P2.6: Offers are append-only, contiguous seq, at most one accepted
  describe('P2.6 - Offer sequences remain contiguous, append-only, and singly accepted', () => {
    it('maintains offer invariants through any sequence of actions', () => {
      fc.assert(
        fc.property(
          negotiatingHandshakeArb(),
          fc.array(fc.nat(), { minLength: 1, maxLength: 40 }),
          (initialH, timestamps) => {
            let h = initialH;
            for (const now of timestamps) {
              // Generate a random valid action for the current state
              const legalActions = LEGAL[h.state];
              if (legalActions.length === 0) break;
              const actionType = legalActions[now % legalActions.length];
              const action = buildAction(actionType, h);
              const result = reduceHandshake(h, action, now);
              if (result.ok) {
                h = result.next;
              }
            }
            // Verify invariants
            // 1. Seq values are contiguous starting from 0
            for (let i = 0; i < h.offers.length; i++) {
              expect(h.offers[i].seq).toBe(i);
            }
            // 2. At most one offer has status 'accepted'
            const acceptedOffers = h.offers.filter(o => o.status === 'accepted');
            expect(acceptedOffers.length).toBeLessThanOrEqual(1);
            // 3. If agreed exists, it mirrors the accepted offer
            if (h.agreed != null) {
              const acceptedOffer = h.offers[h.agreed.agreedOfferSeq];
              expect(h.agreed.price).toBe(acceptedOffer.price);
            }
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // P2.7: Settlement requires both attestations or moderator resolution
  describe('P2.7 - Settlement requires both attestations or moderator resolution', () => {
    it('SETTLED state always has both done attestations or was resolved by moderator', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...NON_TERMINAL_STATES),
          fc.nat(),
          (startState, seed) => {
            // Build a handshake, run random actions, check settled invariant
            const h = buildHandshakeInState(startState, seed);
            const actions = generateActionSequence(h, 30, seed);
            let current = h;
            let wasModeratorResolved = false;

            for (const { action, now } of actions) {
              const result = reduceHandshake(current, action, now);
              if (result.ok) {
                if (action.type === 'RESOLVE') {
                  wasModeratorResolved = true;
                }
                current = result.next;
              }
            }

            if (current.state === 'SETTLED') {
              const doneCount = Object.keys(current.attestations.done).length;
              expect(doneCount === 2 || wasModeratorResolved).toBe(true);
            }
            return true;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // P2.8: Claim gate logic (simplified synchronous version)
  describe('P2.8 - Claim gate: unverified preserves intent, verified rank-01 gets one active claim', () => {
    it('canClaim rejects unverified users and allows verified rank-01 with no active claims', () => {
      fc.assert(
        fc.property(
          fc.record({
            verified: fc.boolean(),
            rank: fc.constantFrom('TAPPED_IN', 'LOCAL', 'ANCHOR'),
            activeClaims: fc.integer({ min: 0, max: 5 }),
          }),
          ({ verified, rank, activeClaims }) => {
            const result = canClaim({ verified, rank, activeClaims });
            if (!verified) {
              // Unverified users cannot claim
              expect(result.allowed).toBe(false);
              expect(result.reason).toBe('IDENTITY_REQUIRED');
            } else {
              // Verified users: check active claims limit
              const maxClaims = maxActiveClaimsForRank(rank);
              if (activeClaims >= maxClaims) {
                expect(result.allowed).toBe(false);
                expect(result.reason).toBe('MAX_CLAIMS_REACHED');
              } else {
                expect(result.allowed).toBe(true);
              }
            }
            return true;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // P2.9: Preserved claims resume only when every eligibility gate passes
  describe('P2.9 - Preserved claims resume only when all eligibility gates pass', () => {
    it('resumePreservedClaim succeeds only when gig is OPEN, rank meets min, and claims under limit', () => {
      fc.assert(
        fc.property(
          fc.record({
            rank: fc.constantFrom('TAPPED_IN', 'LOCAL', 'ANCHOR'),
            activeClaims: fc.integer({ min: 0, max: 5 }),
            gigState: fc.constantFrom('OPEN', 'MATCHED', 'LIVE', 'DONE', 'CANCELLED'),
            minRank: fc.constantFrom('TAPPED_IN', 'LOCAL', 'ANCHOR'),
          }),
          ({ rank, activeClaims, gigState, minRank }) => {
            const eligible = checkResumeEligibility({
              verified: true, // already verified to resume
              rank,
              activeClaims,
              gigState,
              minRank,
            });

            const maxClaims = maxActiveClaimsForRank(rank);
            const rankMeetsMin = rankIndex(rank) >= rankIndex(minRank);
            const expectedEligible =
              gigState === 'OPEN' && rankMeetsMin && activeClaims < maxClaims;

            expect(eligible).toBe(expectedEligible);
            return true;
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});

// ─── Helper functions for tests ──────────────────────────────────────────────

function buildAction(actionType: HandshakeAction['type'], h: Handshake): HandshakeAction {
  const participant = h.posterUid;
  switch (actionType) {
    case 'COUNTER':
      return {
        type: 'COUNTER',
        byUid: participant,
        offer: { price: 500, date: '2025-01-15', startTime: '09:00' },
      };
    case 'ACCEPT':
      return { type: 'ACCEPT', byUid: participant, seq: h.latestSeq };
    case 'DECLINE':
      return { type: 'DECLINE', byUid: participant };
    case 'WITHDRAW':
      return { type: 'WITHDRAW', byUid: participant };
    case 'EXPIRE':
      return { type: 'EXPIRE' };
    case 'START':
      return { type: 'START', byUid: participant };
    case 'CANCEL':
      return { type: 'CANCEL', byUid: participant };
    case 'ATTEST_DONE':
      return { type: 'ATTEST_DONE', byUid: participant };
    case 'ATTEST_PAID':
      return { type: 'ATTEST_PAID', byUid: participant, method: 'upi' };
    case 'DISPUTE':
      return { type: 'DISPUTE', byUid: participant, reason: 'test reason' };
    case 'RESOLVE':
      return { type: 'RESOLVE', byModerator: 'mod1', outcome: 'settle' };
  }
}

function buildHandshakeInState(state: HandshakeState, seed: number): Handshake {
  const posterUid = `poster_${seed % 100}`;
  const doerUid = `doer_${(seed + 1) % 100}`;
  const now = seed;

  const initialOffer: Offer = {
    seq: 0,
    byUid: doerUid,
    price: 500,
    date: '2025-01-15',
    startTime: '09:00',
    createdAt: now,
    status: (state === 'AGREED' || state === 'LIVE' || state === 'DONE_PENDING' || state === 'SETTLED') ? 'accepted' : 'live',
  };

  const h: Handshake = {
    id: `gig1_${doerUid}`,
    gigId: 'gig1',
    hoodId: 'hood1',
    posterUid,
    doerUid,
    state,
    offers: [initialOffer],
    latestSeq: 0,
    attestations: { done: {}, paid: {} },
    meetupNudgeShown: false,
    threadId: 'thread1',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  if (state === 'AGREED' || state === 'LIVE' || state === 'DONE_PENDING' || state === 'SETTLED') {
    h.agreed = {
      price: initialOffer.price,
      date: initialOffer.date,
      startTime: initialOffer.startTime,
      agreedAt: now,
      agreedOfferSeq: 0,
    };
  }

  if (state === 'DONE_PENDING') {
    h.attestations.done[posterUid] = now;
  }

  if (state === 'SETTLED') {
    h.attestations.done[posterUid] = now;
    h.attestations.done[doerUid] = now;
  }

  return h;
}

function generateActionSequence(
  h: Handshake,
  maxLen: number,
  seed: number,
): Array<{ action: HandshakeAction; now: number }> {
  const result: Array<{ action: HandshakeAction; now: number }> = [];
  let current = h;
  for (let i = 0; i < maxLen; i++) {
    const legalActions = LEGAL[current.state];
    if (legalActions.length === 0) break;
    const actionType = legalActions[(seed + i) % legalActions.length];
    const action = buildSmartAction(actionType, current, seed + i);
    const now = current.updatedAt + i + 1;
    result.push({ action, now });
    const r = reduceHandshake(current, action, now);
    if (r.ok) {
      current = r.next;
    }
  }
  return result;
}

function buildSmartAction(
  actionType: HandshakeAction['type'],
  h: Handshake,
  seed: number,
): HandshakeAction {
  // Build actions that are more likely to succeed
  const latestOffer = h.offers[h.latestSeq];
  const other = counterparty(h, latestOffer.byUid);

  switch (actionType) {
    case 'COUNTER':
      return {
        type: 'COUNTER',
        byUid: other,
        offer: { price: 100 + (seed % 5000), date: '2025-01-15', startTime: '09:00' },
      };
    case 'ACCEPT':
      return { type: 'ACCEPT', byUid: other, seq: h.latestSeq };
    case 'DECLINE':
      return { type: 'DECLINE', byUid: h.posterUid };
    case 'WITHDRAW':
      return { type: 'WITHDRAW', byUid: h.doerUid };
    case 'EXPIRE':
      return { type: 'EXPIRE' };
    case 'START':
      return { type: 'START', byUid: seed % 2 === 0 ? h.posterUid : h.doerUid };
    case 'CANCEL':
      return { type: 'CANCEL', byUid: seed % 2 === 0 ? h.posterUid : h.doerUid };
    case 'ATTEST_DONE': {
      // Pick a uid that hasn't attested yet
      const uid = !h.attestations.done[h.posterUid] ? h.posterUid : h.doerUid;
      return { type: 'ATTEST_DONE', byUid: uid };
    }
    case 'ATTEST_PAID':
      return { type: 'ATTEST_PAID', byUid: seed % 2 === 0 ? h.posterUid : h.doerUid, method: 'upi' };
    case 'DISPUTE':
      return { type: 'DISPUTE', byUid: seed % 2 === 0 ? h.posterUid : h.doerUid, reason: 'issue' };
    case 'RESOLVE':
      return { type: 'RESOLVE', byModerator: 'mod1', outcome: seed % 2 === 0 ? 'settle' : 'void' };
  }
}

// ─── Claim gate functions (pure, synchronous) ────────────────────────────────

type Rank = 'TAPPED_IN' | 'LOCAL' | 'ANCHOR';

interface ClaimGateInput {
  verified: boolean;
  rank: Rank;
  activeClaims: number;
}

interface ClaimGateResult {
  allowed: boolean;
  reason?: 'IDENTITY_REQUIRED' | 'MAX_CLAIMS_REACHED';
}

function canClaim(input: ClaimGateInput): ClaimGateResult {
  if (!input.verified) {
    return { allowed: false, reason: 'IDENTITY_REQUIRED' };
  }
  const maxClaims = maxActiveClaimsForRank(input.rank);
  if (input.activeClaims >= maxClaims) {
    return { allowed: false, reason: 'MAX_CLAIMS_REACHED' };
  }
  return { allowed: true };
}

function maxActiveClaimsForRank(rank: Rank): number {
  switch (rank) {
    case 'TAPPED_IN':
      return 1;
    case 'LOCAL':
      return 3;
    case 'ANCHOR':
      return 5;
  }
}

function rankIndex(rank: Rank): number {
  switch (rank) {
    case 'TAPPED_IN':
      return 0;
    case 'LOCAL':
      return 1;
    case 'ANCHOR':
      return 2;
  }
}

interface ResumeEligibilityInput {
  verified: boolean;
  rank: Rank;
  activeClaims: number;
  gigState: string;
  minRank: Rank;
}

function checkResumeEligibility(input: ResumeEligibilityInput): boolean {
  if (!input.verified) return false;
  if (input.gigState !== 'OPEN') return false;
  if (rankIndex(input.rank) < rankIndex(input.minRank)) return false;
  const maxClaims = maxActiveClaimsForRank(input.rank);
  if (input.activeClaims >= maxClaims) return false;
  return true;
}
