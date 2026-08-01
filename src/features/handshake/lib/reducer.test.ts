/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for THE Handshake Engine's pure reducer and offer model (design
 * §E.4, §H.6; requirements 12.1-12.7, 12.10-12.14, 30.11).
 *
 * These are example/edge-case tests, not the property-based suites — those are
 * separate dedicated tasks (5.8-5.13, 5.15) that each own their own
 * `reducer.P2.<n>.property.test.ts` file per design §J.2. This file exercises
 * one concrete scenario per rule so a regression here points at the exact
 * requirement that broke.
 */

import { describe, expect, it } from 'vitest';

import {
  LEGAL,
  PRICE_MAX,
  createHandshake,
  isLegalAction,
  isPriceInRange,
  isTerminal,
  latestOffer,
  otherParticipant,
  reduceHandshake,
  type HandshakeAction,
} from './reducer';
import type { Handshake, Offer } from '@/types/handshake';
import type { PublicIdentity } from '@/types/user';

// ---- fixtures ---------------------------------------------------------------

const POSTER_UID = 'poster-1';
const DOER_UID = 'doer-1';
const STRANGER_UID = 'stranger-1';

function identity(uid: string): PublicIdentity {
  return {
    uid,
    handle: uid,
    displayName: uid,
    avatarSeed: uid,
    rank: 'TAPPED_IN',
    rep: 0,
    verified: true,
    gigsSettled: 0,
    rating: null,
    ratingCount: 0,
  };
}

function offer(over: Partial<Offer> = {}): Offer {
  return {
    seq: 0,
    byUid: DOER_UID,
    price: 500,
    date: '2025-01-15',
    startTime: '18:00',
    createdAt: 1000,
    status: 'live',
    ...over,
  };
}

/** A fresh NEGOTIATING handshake with a single live offer authored by the doer. */
function freshHandshake(over: Partial<Handshake> = {}): Handshake {
  return {
    id: `${'gig-1'}_${DOER_UID}`,
    gigId: 'gig-1',
    hoodId: 'hood-1',
    posterUid: POSTER_UID,
    doerUid: DOER_UID,
    posterSnapshot: identity(POSTER_UID),
    doerSnapshot: identity(DOER_UID),
    state: 'NEGOTIATING',
    offers: [offer()],
    latestSeq: 0,
    attestations: { done: {}, paid: {} },
    meetupNudgeShown: false,
    threadId: 'thread-1',
    createdAt: 1000,
    updatedAt: 1000,
    schemaVersion: 1,
    ...over,
  };
}

// ---- requirement 12.1 / 30.11: purity ---------------------------------------

describe('purity (requirements 12.1, 30.11)', () => {
  it('never reads an ambient clock and always uses the injected now', () => {
    const h = freshHandshake();
    const action: HandshakeAction = { type: 'DECLINE', byUid: POSTER_UID };
    const r1 = reduceHandshake(h, action, 42);
    const r2 = reduceHandshake(h, action, 42);
    expect(r1).toEqual(r2);
    expect(r1.ok && r1.next.updatedAt).toBe(42);
  });

  it('never mutates the input handshake object', () => {
    const h = freshHandshake();
    const snapshotBefore = JSON.parse(JSON.stringify(h));
    reduceHandshake(h, { type: 'COUNTER', byUid: POSTER_UID, offer: { price: 600, date: '2025-01-15', startTime: '18:00' } }, 2000);
    expect(h).toEqual(snapshotBefore);
  });
});

// ---- requirement 12.2: illegal actions rejected without mutation -----------

describe('illegal actions (requirement 12.2)', () => {
  it('rejects an action absent from LEGAL[state] with ILLEGAL_STATE and an unchanged handshake', () => {
    const h = freshHandshake({ state: 'NEGOTIATING' });
    // ATTEST_DONE is not legal from NEGOTIATING.
    const r = reduceHandshake(h, { type: 'ATTEST_DONE', byUid: DOER_UID }, 2000);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('ILLEGAL_STATE');
  });

  it('agrees with the LEGAL table for every state/action pair it checks', () => {
    expect(isLegalAction('NEGOTIATING', 'COUNTER')).toBe(true);
    expect(isLegalAction('NEGOTIATING', 'START')).toBe(false);
    expect(isLegalAction('LIVE', 'ATTEST_DONE')).toBe(true);
    expect(isLegalAction('LIVE', 'COUNTER')).toBe(false);
  });
});

// ---- requirement 12.3: absorbing terminal states ----------------------------

describe('absorbing terminal states (requirement 12.3)', () => {
  const terminalStates = ['SETTLED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED'] as const;

  it.each(terminalStates)('accepts no legal actions from %s per LEGAL', (state) => {
    expect(LEGAL[state]).toHaveLength(0);
    expect(isTerminal(state)).toBe(true);
  });

  it('rejects any action attempted from a terminal state', () => {
    const h = freshHandshake({ state: 'SETTLED' });
    const r = reduceHandshake(h, { type: 'DISPUTE', byUid: POSTER_UID, reason: 'no show' }, 2000);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('ILLEGAL_STATE');
  });
});

// ---- requirement 12.6: participant checks -----------------------------------

describe('participant checks (requirement 12.6)', () => {
  it('rejects an action from a uid that is neither poster nor doer', () => {
    const h = freshHandshake();
    const r = reduceHandshake(h, { type: 'DECLINE', byUid: STRANGER_UID }, 2000);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('NOT_PARTICIPANT');
  });

  it('permits the poster to decline', () => {
    const h = freshHandshake();
    const r = reduceHandshake(h, { type: 'DECLINE', byUid: POSTER_UID }, 2000);
    expect(r.ok).toBe(true);
    expect(r.ok && r.next.state).toBe('DECLINED');
  });
});

// ---- requirement 12.4: self-accept rejection --------------------------------

describe('self-accept rejection (requirement 12.4)', () => {
  it('rejects an accept from the author of the latest offer with SELF_ACCEPT', () => {
    const h = freshHandshake(); // offer 0 authored by the doer
    const r = reduceHandshake(h, { type: 'ACCEPT', byUid: DOER_UID, seq: 0 }, 2000);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('SELF_ACCEPT');
  });

  it('rejects a self-counter (moving twice in a row) with ILLEGAL_STATE', () => {
    const h = freshHandshake(); // offer 0 authored by the doer
    const r = reduceHandshake(
      h,
      { type: 'COUNTER', byUid: DOER_UID, offer: { price: 600, date: '2025-01-15', startTime: '18:00' } },
      2000,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('ILLEGAL_STATE');
  });

  it('permits the counterparty to accept the latest offer', () => {
    const h = freshHandshake();
    const r = reduceHandshake(h, { type: 'ACCEPT', byUid: POSTER_UID, seq: 0 }, 2000);
    expect(r.ok).toBe(true);
    expect(r.ok && r.next.state).toBe('AGREED');
  });
});

// ---- requirement 12.5: stale-offer rejection --------------------------------

describe('stale-offer rejection (requirement 12.5)', () => {
  it('rejects an accept whose seq is not the latest with STALE_OFFER', () => {
    let h = freshHandshake();
    const countered = reduceHandshake(
      h,
      { type: 'COUNTER', byUid: POSTER_UID, offer: { price: 550, date: '2025-01-15', startTime: '18:00' } },
      1500,
    );
    expect(countered.ok).toBe(true);
    h = countered.ok ? countered.next : h;
    expect(h.latestSeq).toBe(1);

    // Doer tries to accept the now-superseded offer 0.
    const stale = reduceHandshake(h, { type: 'ACCEPT', byUid: DOER_UID, seq: 0 }, 2000);
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.error).toBe('STALE_OFFER');
  });

  it('checks staleness before self-accept, per design §H.6 ordering', () => {
    // seq is stale AND byUid authored offer 0 — STALE_OFFER wins.
    let h = freshHandshake();
    const countered = reduceHandshake(
      h,
      { type: 'COUNTER', byUid: POSTER_UID, offer: { price: 550, date: '2025-01-15', startTime: '18:00' } },
      1500,
    );
    h = countered.ok ? countered.next : h;
    const r = reduceHandshake(h, { type: 'ACCEPT', byUid: DOER_UID, seq: 0 }, 2000);
    expect(!r.ok && r.error).toBe('STALE_OFFER');
  });
});

// ---- requirement 12.13: price bounds ----------------------------------------

describe('price bounds (requirement 12.13)', () => {
  it.each([0, -1, PRICE_MAX + 1, 1_000_000])('rejects a counter-offer priced %d with PRICE_OUT_OF_RANGE', (price) => {
    const h = freshHandshake();
    const r = reduceHandshake(h, { type: 'COUNTER', byUid: POSTER_UID, offer: { price, date: '2025-01-15', startTime: '18:00' } }, 2000);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('PRICE_OUT_OF_RANGE');
  });

  it.each([1, 500, PRICE_MAX])('accepts a counter-offer priced %d', (price) => {
    const h = freshHandshake();
    const r = reduceHandshake(h, { type: 'COUNTER', byUid: POSTER_UID, offer: { price, date: '2025-01-15', startTime: '18:00' } }, 2000);
    expect(r.ok).toBe(true);
  });

  it('agrees with isPriceInRange at the boundaries', () => {
    expect(isPriceInRange(0)).toBe(false);
    expect(isPriceInRange(PRICE_MAX)).toBe(true);
    expect(isPriceInRange(PRICE_MAX + 1)).toBe(false);
    expect(isPriceInRange(1)).toBe(true);
  });
});

// ---- requirements 12.7, 12.10: append-only offers, mirrored agreed terms ---

describe('append-only contiguous offers (requirement 12.7)', () => {
  it('appends a new offer at latestSeq + 1 and marks the prior offer superseded', () => {
    const h = freshHandshake();
    const r = reduceHandshake(
      h,
      { type: 'COUNTER', byUid: POSTER_UID, offer: { price: 600, date: '2025-01-15', startTime: '18:00' } },
      1500,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.offers.map((o) => o.seq)).toEqual([0, 1]);
    expect(r.next.offers[0].status).toBe('superseded');
    expect(r.next.offers[1]).toMatchObject({ status: 'live', byUid: POSTER_UID, price: 600 });
    expect(r.next.latestSeq).toBe(1);
    // The original array/objects are untouched (no in-place mutation).
    expect(h.offers[0].status).toBe('live');
  });

  it('never leaves more than one offer with status accepted', () => {
    const h = freshHandshake();
    const r = reduceHandshake(h, { type: 'ACCEPT', byUid: POSTER_UID, seq: 0 }, 2000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.offers.filter((o) => o.status === 'accepted')).toHaveLength(1);
  });
});

describe('mirrored agreed terms (requirement 12.10)', () => {
  it('mirrors the accepted offer price/date/time exactly into h.agreed', () => {
    const h = freshHandshake({ offers: [offer({ price: 777, date: '2025-02-01', startTime: '09:00', endTime: '11:00' })] });
    const r = reduceHandshake(h, { type: 'ACCEPT', byUid: POSTER_UID, seq: 0 }, 5000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.agreed).toEqual({
      price: 777,
      date: '2025-02-01',
      startTime: '09:00',
      endTime: '11:00',
      agreedAt: 5000,
      agreedOfferSeq: 0,
    });
    expect(r.next.state).toBe('AGREED');
  });
});

// ---- requirement 12.11: two-attestation settlement --------------------------

describe('settlement requires both attestations (requirement 12.11)', () => {
  it('moves to DONE_PENDING after exactly one attestation, not SETTLED', () => {
    const h = freshHandshake({ state: 'LIVE' });
    const r = reduceHandshake(h, { type: 'ATTEST_DONE', byUid: DOER_UID }, 6000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.state).toBe('DONE_PENDING');
    expect(r.next.attestations.done).toEqual({ [DOER_UID]: 6000 });
  });

  it('settles only once both parties have attested', () => {
    const h = freshHandshake({ state: 'DONE_PENDING', attestations: { done: { [DOER_UID]: 6000 }, paid: {} } });
    const r = reduceHandshake(h, { type: 'ATTEST_DONE', byUid: POSTER_UID }, 6100);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.state).toBe('SETTLED');
    expect(Object.keys(r.next.attestations.done)).toHaveLength(2);
    expect(r.next.wasModeratorResolved).toBeUndefined();
  });

  it('settles via moderator resolution without any attestation', () => {
    const h = freshHandshake({ state: 'DISPUTED' });
    const r = reduceHandshake(h, { type: 'RESOLVE', byModerator: 'mod-1', outcome: 'settle' }, 7000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.state).toBe('SETTLED');
    expect(r.next.wasModeratorResolved).toBe(true);
  });

  it('rejects a second attestation from the same party with ALREADY_ATTESTED (requirement 12.12)', () => {
    const h = freshHandshake({ state: 'DONE_PENDING', attestations: { done: { [DOER_UID]: 6000 }, paid: {} } });
    const r = reduceHandshake(h, { type: 'ATTEST_DONE', byUid: DOER_UID }, 6200);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('ALREADY_ATTESTED');
  });
});

// ---- helpers -----------------------------------------------------------------

describe('small pure helpers', () => {
  it('latestOffer returns the offer at latestSeq', () => {
    const h = freshHandshake();
    expect(latestOffer(h)).toEqual(h.offers[0]);
  });

  it('otherParticipant returns the counterparty and throws for a stranger', () => {
    const h = freshHandshake();
    expect(otherParticipant(h, POSTER_UID)).toBe(DOER_UID);
    expect(otherParticipant(h, DOER_UID)).toBe(POSTER_UID);
    expect(() => otherParticipant(h, STRANGER_UID)).toThrow();
  });
});

// ---- genesis: createHandshake -----------------------------------------------

describe('createHandshake', () => {
  it('builds a NEGOTIATING handshake with a single seq-0 offer', () => {
    const r = createHandshake(
      {
        id: 'gig-1_doer-1',
        gigId: 'gig-1',
        hoodId: 'hood-1',
        posterUid: POSTER_UID,
        doerUid: DOER_UID,
        posterSnapshot: identity(POSTER_UID),
        doerSnapshot: identity(DOER_UID),
        threadId: 'thread-1',
        offer: { byUid: DOER_UID, price: 450, date: '2025-01-15', startTime: '18:00', note: "i've done this before" },
      },
      1000,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handshake.state).toBe('NEGOTIATING');
    expect(r.handshake.offers).toEqual([
      { seq: 0, byUid: DOER_UID, price: 450, date: '2025-01-15', startTime: '18:00', note: "i've done this before", createdAt: 1000, status: 'live' },
    ]);
    expect(r.handshake.latestSeq).toBe(0);
    expect(r.handshake.attestations).toEqual({ done: {}, paid: {} });
  });

  it('rejects a genesis offer priced out of range', () => {
    const r = createHandshake(
      {
        id: 'gig-1_doer-1',
        gigId: 'gig-1',
        hoodId: 'hood-1',
        posterUid: POSTER_UID,
        doerUid: DOER_UID,
        posterSnapshot: identity(POSTER_UID),
        doerSnapshot: identity(DOER_UID),
        threadId: 'thread-1',
        offer: { byUid: DOER_UID, price: 0, date: '2025-01-15', startTime: '18:00' },
      },
      1000,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('PRICE_OUT_OF_RANGE');
  });

  it('rejects poster and doer being the same identity', () => {
    const r = createHandshake(
      {
        id: 'gig-1_x',
        gigId: 'gig-1',
        hoodId: 'hood-1',
        posterUid: 'same-uid',
        doerUid: 'same-uid',
        posterSnapshot: identity('same-uid'),
        doerSnapshot: identity('same-uid'),
        threadId: 'thread-1',
        offer: { byUid: 'same-uid', price: 450, date: '2025-01-15', startTime: '18:00' },
      },
      1000,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe('SAME_PARTY');
  });
});
