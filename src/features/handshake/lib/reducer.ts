/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * THE Handshake Engine — the pure state-machine reducer and offer model (design
 * §E.4, §H.6; requirements 12.1-12.7, 12.10-12.14, 30.11).
 *
 * This is the "correctness heart of the product" (design §E.4): the single
 * place that decides what a poster and a doer are legally allowed to do to one
 * negotiated agreement. It is a pure reducer over `(handshake, action, now)`
 * with no I/O and no ambient clock (requirement 12.1, 30.11) — `now` is always
 * injected, never read from `Date.now()`, so identical inputs always produce
 * identical results and the transition table is directly property-testable
 * (design §J.2, tasks 5.8-5.13).
 *
 * What this module does NOT do (left to task 5.14, the server-authoritative
 * layer): it does not talk to Firestore, does not perform the single-winner
 * compare-and-set on `gigs/{id}.agreedHandshakeId`, does not send
 * notifications, and does not grant rep. Every one of those is instead
 * described as a data-only {@link Effect} in the result — "the caller performs
 * the effects" (design §H.6 postcondition) — so the reducer itself stays free
 * of side effects while still telling the caller exactly what to do next.
 *
 * Result shape (requirement 12.2): {@link reduceHandshake} returns a
 * discriminated {@link TransitionResult}, `{ ok: true, next, effects }` or
 * `{ ok: false, error }`, exactly as design §H.6 specifies. On `ok: false` the
 * input `handshake` is never mutated and no partial offer/state change is
 * applied — callers (and the property tests in §J.2, e.g. P2.1) assert
 * rejection by checking `result.ok === false`, not object identity, which is
 * why a discriminated result rather than a same-reference contract was chosen:
 * it is impossible to accidentally read a stale `next` on the error branch
 * because that field does not exist there.
 */

import type { Handshake, HandshakeState, Offer } from '@/types/handshake';
import type { GigState } from '@/types/gig';

// ---- action model (design §H.6) --------------------------------------------

/** The fields a caller supplies for a new offer; the reducer fills in the rest. */
export type OfferInput = Omit<Offer, 'seq' | 'status' | 'createdAt' | 'byUid'>;

export type HandshakeAction =
  | { type: 'COUNTER'; byUid: string; offer: OfferInput }
  | { type: 'ACCEPT'; byUid: string; seq: number }
  | { type: 'DECLINE'; byUid: string }
  | { type: 'WITHDRAW'; byUid: string }
  | { type: 'EXPIRE' }
  | { type: 'START'; byUid: string }
  | { type: 'CANCEL'; byUid: string }
  | { type: 'ATTEST_DONE'; byUid: string }
  | { type: 'ATTEST_PAID'; byUid: string; method: 'upi' | 'cash' }
  | { type: 'DISPUTE'; byUid: string; reason: string }
  | { type: 'RESOLVE'; byModerator: string; outcome: 'settle' | 'void' };

export type HandshakeActionType = HandshakeAction['type'];

export type TransitionError =
  | 'ILLEGAL_STATE' // action not permitted from the current state (requirement 12.2)
  | 'NOT_PARTICIPANT' // actor is neither the poster nor the doer (requirement 12.6)
  | 'SELF_ACCEPT' // the accepting party authored the latest offer (requirement 12.4)
  | 'STALE_OFFER' // accept referenced a non-latest sequence number (requirement 12.5)
  | 'ALREADY_ATTESTED' // a second completion attestation from the same party (requirement 12.12)
  | 'GIG_TAKEN' // reserved for the server layer's compare-and-set failure (task 5.14)
  | 'PRICE_OUT_OF_RANGE'; // offer price outside (₹0, ₹1,00,000] (requirement 12.13)

/**
 * Notification-worthy moments the reducer surfaces as {@link Effect} data. The
 * literal names mirror design §H.6's pseudocode calls (`notify(uid, 'countered')`
 * etc.) so the server layer's effect interpreter has an unambiguous mapping.
 */
export type NotifyEvent = 'countered' | 'agreed' | 'confirm-done' | 'declined' | 'withdrawn' | 'cancelled';

/**
 * Data-only descriptions of the side effects design §H.6 lists next to each
 * transition (`casGigAgreed`, `notify`, `grantRep`, ...). The reducer never
 * performs any of these itself — it only returns them for a caller with I/O
 * access (task 5.14) to execute, which is what keeps this module pure.
 */
export type Effect =
  | { kind: 'NOTIFY'; uid: string; event: NotifyEvent }
  | { kind: 'PUSH'; uid: string; event: NotifyEvent }
  | { kind: 'EMAIL'; uid: string; event: NotifyEvent }
  | { kind: 'TOUCH_THREAD' }
  | { kind: 'CAS_GIG_AGREED'; gigId: string; handshakeId: string }
  | { kind: 'SET_GIG_STATE'; gigId: string; state: GigState }
  | { kind: 'DECLINE_OTHER_HANDSHAKES'; gigId: string; exceptHandshakeId: string }
  | { kind: 'REVEAL_CONTACT'; posterUid: string; doerUid: string }
  | { kind: 'REVEAL_EXACT_LOCATION'; handshakeId: string }
  | { kind: 'MAYBE_MEETUP_NUDGE'; handshakeId: string }
  | { kind: 'GRANT_REP'; uid: string; reason: string; idempotencyKey: string }
  | { kind: 'OPEN_LOOP'; handshakeId: string }
  | { kind: 'SHOW_RECEIPT'; handshakeId: string }
  | { kind: 'RECORD_PAYMENT_ATTESTATION'; handshakeId: string }
  | { kind: 'OPEN_MODERATION_CASE'; handshakeId: string; reason: string }
  | { kind: 'RELEASE_GIG'; gigId: string }
  | { kind: 'APPLY_MODERATOR_OUTCOME'; handshakeId: string; outcome: 'settle' | 'void' };

export type TransitionResult =
  | { ok: true; next: Handshake; effects: Effect[] }
  | { ok: false; error: TransitionError };

// ---- price bounds (requirement 12.13) --------------------------------------

/** Offer prices must be strictly greater than this (design §H.6: "at or below ₹0"). */
export const PRICE_MIN_EXCLUSIVE = 0;

/** Offer prices must be at most this (design §H.6: "above ₹1,00,000"). */
export const PRICE_MAX = 100_000;

/** True for a price the reducer will accept on an offer (requirement 12.13). */
export function isPriceInRange(price: number): boolean {
  return Number.isFinite(price) && price > PRICE_MIN_EXCLUSIVE && price <= PRICE_MAX;
}

// ---- legality table (design §H.6) ------------------------------------------

/**
 * The machine's whole contract in one place. SETTLED, DECLINED, WITHDRAWN,
 * EXPIRED, and CANCELLED are absorbing: no action is legal from them
 * (requirement 12.3).
 */
export const LEGAL: Readonly<Record<HandshakeState, ReadonlyArray<HandshakeActionType>>> = Object.freeze({
  NEGOTIATING: ['COUNTER', 'ACCEPT', 'DECLINE', 'WITHDRAW', 'EXPIRE'],
  AGREED: ['START', 'CANCEL', 'DISPUTE', 'EXPIRE'],
  LIVE: ['ATTEST_DONE', 'DISPUTE', 'CANCEL'],
  DONE_PENDING: ['ATTEST_DONE', 'ATTEST_PAID', 'DISPUTE'],
  DISPUTED: ['RESOLVE'],
  SETTLED: [],
  DECLINED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  CANCELLED: [],
});

const TERMINAL_STATES: ReadonlySet<HandshakeState> = new Set([
  'SETTLED',
  'DECLINED',
  'WITHDRAWN',
  'EXPIRED',
  'CANCELLED',
]);

/** True for the five absorbing terminal states (requirement 12.3, design §H.6). */
export function isTerminal(state: HandshakeState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * True when `actionType` may legally run from `state`. A thin, allocation-free
 * wrapper over {@link LEGAL} that property/unit tests can call directly without
 * constructing a full action or handshake.
 */
export function isLegalAction(state: HandshakeState, actionType: HandshakeActionType): boolean {
  return LEGAL[state].includes(actionType);
}

// ---- small pure helpers -----------------------------------------------------

/** The offer at `h.latestSeq` — the only offer that can ever be accepted or superseded. */
export function latestOffer(h: Handshake): Offer {
  const offer = h.offers[h.latestSeq];
  if (!offer) {
    throw new RangeError(`latestOffer: no offer at latestSeq ${h.latestSeq} (offers.length=${h.offers.length})`);
  }
  return offer;
}

/** The participant who is not `uid`. Throws for a uid that is neither party. */
export function otherParticipant(h: Handshake, uid: string): string {
  if (uid === h.posterUid) return h.doerUid;
  if (uid === h.doerUid) return h.posterUid;
  throw new RangeError(`otherParticipant: ${uid} is neither the poster nor the doer of ${h.id}`);
}

/** The actor uid carried by actions that have one; `null` for EXPIRE and RESOLVE. */
function actorUid(a: HandshakeAction): string | null {
  return 'byUid' in a ? a.byUid : null;
}

function reject(error: TransitionError): TransitionResult {
  return { ok: false, error };
}

function ok(next: Handshake, effects: Effect[]): TransitionResult {
  return { ok: true, next, effects };
}

// ---- the reducer (design §H.6) ---------------------------------------------

/**
 * PURE. No IO, no clock — `now` is injected (requirements 12.1, 30.11).
 *
 * Preconditions the caller is responsible for (design §H.6): `h.offers.length
 * === h.latestSeq + 1`; `h.posterUid !== h.doerUid`; `now >= h.updatedAt`.
 *
 * Postconditions this function guarantees on every `ok: true` result: the
 * returned state is reachable from `h.state` per {@link LEGAL}; terminal states
 * are never left; `offers` stays append-only with `seq` contiguous from 0; at
 * most one offer has `status === 'accepted'`; `h.agreed`, when present, mirrors
 * exactly the accepted offer's price/date/time (requirements 12.7, 12.10).
 */
export function reduceHandshake(h: Handshake, a: HandshakeAction, now: number): TransitionResult {
  // Requirement 12.3 / 12.2: terminal states admit nothing; illegal actions are
  // rejected without ever reaching the mutation logic below.
  if (!isLegalAction(h.state, a.type)) {
    return reject('ILLEGAL_STATE');
  }

  // Requirement 12.6: only the two named participants may act. EXPIRE has no
  // actor (system-driven) and RESOLVE's actor is a moderator, not a
  // participant, so neither carries a `byUid` and neither is checked here.
  const actor = actorUid(a);
  if (actor !== null && actor !== h.posterUid && actor !== h.doerUid) {
    return reject('NOT_PARTICIPANT');
  }

  switch (a.type) {
    case 'COUNTER': {
      const latest = latestOffer(h);
      // No self-counter: the party who moved last cannot move again until the
      // other party responds (design §H.6).
      if (latest.byUid === a.byUid) return reject('ILLEGAL_STATE');
      if (!isPriceInRange(a.offer.price)) return reject('PRICE_OUT_OF_RANGE');

      const nextSeq = h.latestSeq + 1;
      const supersededOffers = h.offers.map((o) => (o.seq === latest.seq ? { ...o, status: 'superseded' as const } : o));
      const newOffer: Offer = { ...a.offer, seq: nextSeq, byUid: a.byUid, status: 'live', createdAt: now };

      const next: Handshake = {
        ...h,
        offers: [...supersededOffers, newOffer],
        latestSeq: nextSeq,
        updatedAt: now,
      };
      return ok(next, [{ kind: 'NOTIFY', uid: otherParticipant(h, a.byUid), event: 'countered' }, { kind: 'TOUCH_THREAD' }]);
    }

    case 'ACCEPT': {
      const latest = latestOffer(h);
      // Race guard first: a stale view of the offer history is rejected before
      // we even ask who authored it (requirement 12.5).
      if (a.seq !== h.latestSeq) return reject('STALE_OFFER');
      // No self-accept: the author of the latest offer can never be the one
      // who accepts it (requirement 12.4).
      if (latest.byUid === a.byUid) return reject('SELF_ACCEPT');

      const offers = h.offers.map((o) => (o.seq === latest.seq ? { ...o, status: 'accepted' as const } : o));
      const next: Handshake = {
        ...h,
        offers,
        state: 'AGREED',
        agreed: {
          price: latest.price,
          date: latest.date,
          startTime: latest.startTime,
          endTime: latest.endTime,
          agreedAt: now,
          agreedOfferSeq: latest.seq,
        },
        updatedAt: now,
      };
      // Single-winner enforcement (requirement 12.8, 12.9) is the server
      // layer's job (task 5.14): it wraps this transition in a transaction
      // that compare-and-sets gigs/{gigId}.agreedHandshakeId from null, and
      // reports GIG_TAKEN back to the caller when that CAS fails. The pure
      // reducer only ever describes the intent as an effect.
      return ok(next, [
        { kind: 'CAS_GIG_AGREED', gigId: h.gigId, handshakeId: h.id },
        { kind: 'SET_GIG_STATE', gigId: h.gigId, state: 'MATCHED' },
        { kind: 'DECLINE_OTHER_HANDSHAKES', gigId: h.gigId, exceptHandshakeId: h.id },
        { kind: 'REVEAL_CONTACT', posterUid: h.posterUid, doerUid: h.doerUid },
        { kind: 'MAYBE_MEETUP_NUDGE', handshakeId: h.id },
        { kind: 'NOTIFY', uid: h.posterUid, event: 'agreed' },
        { kind: 'NOTIFY', uid: h.doerUid, event: 'agreed' },
        { kind: 'PUSH', uid: h.posterUid, event: 'agreed' },
        { kind: 'PUSH', uid: h.doerUid, event: 'agreed' },
        { kind: 'EMAIL', uid: h.posterUid, event: 'agreed' },
        { kind: 'EMAIL', uid: h.doerUid, event: 'agreed' },
      ]);
    }

    case 'DECLINE': {
      const next: Handshake = { ...h, state: 'DECLINED', updatedAt: now };
      return ok(next, [{ kind: 'NOTIFY', uid: h.doerUid, event: 'declined' }]);
    }

    case 'WITHDRAW': {
      const next: Handshake = { ...h, state: 'WITHDRAWN', updatedAt: now };
      return ok(next, [{ kind: 'NOTIFY', uid: h.posterUid, event: 'withdrawn' }]);
    }

    case 'EXPIRE': {
      const next: Handshake = { ...h, state: 'EXPIRED', updatedAt: now };
      return ok(next, []);
    }

    case 'START': {
      const next: Handshake = { ...h, state: 'LIVE', updatedAt: now };
      return ok(next, [
        { kind: 'SET_GIG_STATE', gigId: h.gigId, state: 'LIVE' },
        { kind: 'REVEAL_EXACT_LOCATION', handshakeId: h.id },
      ]);
    }

    case 'CANCEL': {
      const next: Handshake = { ...h, state: 'CANCELLED', updatedAt: now };
      return ok(next, [
        { kind: 'RELEASE_GIG', gigId: h.gigId },
        { kind: 'NOTIFY', uid: h.posterUid, event: 'cancelled' },
        { kind: 'NOTIFY', uid: h.doerUid, event: 'cancelled' },
      ]);
    }

    case 'ATTEST_DONE': {
      // Requirement 12.12: a second completion attestation from the same
      // party is rejected outright, not silently merged.
      if (h.attestations.done[a.byUid] !== undefined) return reject('ALREADY_ATTESTED');

      const done = { ...h.attestations.done, [a.byUid]: now };
      const attestations = { ...h.attestations, done };
      const bothAttested = Object.keys(done).length === 2;

      if (bothAttested) {
        // Requirement 12.11: SETTLED only when BOTH parties have attested (or
        // via RESOLVE below) — a single attestation alone never settles.
        const next: Handshake = { ...h, attestations, state: 'SETTLED', updatedAt: now };
        return ok(next, [
          { kind: 'SET_GIG_STATE', gigId: h.gigId, state: 'DONE' },
          { kind: 'GRANT_REP', uid: h.doerUid, reason: 'GIG_COMPLETED_AS_DOER', idempotencyKey: `${h.id}:doer` },
          { kind: 'GRANT_REP', uid: h.posterUid, reason: 'GIG_COMPLETED_AS_POSTER', idempotencyKey: `${h.id}:poster` },
          { kind: 'OPEN_LOOP', handshakeId: h.id },
          { kind: 'SHOW_RECEIPT', handshakeId: h.id },
        ]);
      }

      const next: Handshake = { ...h, attestations, state: 'DONE_PENDING', updatedAt: now };
      return ok(next, [{ kind: 'NOTIFY', uid: otherParticipant(h, a.byUid), event: 'confirm-done' }]);
    }

    case 'ATTEST_PAID': {
      const paid = { ...h.attestations.paid, [a.byUid]: now };
      const next: Handshake = {
        ...h,
        attestations: { ...h.attestations, paid },
        paymentMethod: a.method,
        updatedAt: now,
      };
      return ok(next, [{ kind: 'RECORD_PAYMENT_ATTESTATION', handshakeId: h.id }]);
    }

    case 'DISPUTE': {
      const next: Handshake = { ...h, state: 'DISPUTED', updatedAt: now };
      return ok(next, [{ kind: 'OPEN_MODERATION_CASE', handshakeId: h.id, reason: a.reason }]);
    }

    case 'RESOLVE': {
      // Requirement 12.11: the other legal path to SETTLED. `wasModeratorResolved`
      // records that this settlement did not come from two attestations, which
      // is exactly the distinction design §J.2's property P2.7 needs to state.
      const outcomeState: HandshakeState = a.outcome === 'settle' ? 'SETTLED' : 'CANCELLED';
      const next: Handshake = { ...h, state: outcomeState, wasModeratorResolved: true, updatedAt: now };
      return ok(next, [{ kind: 'APPLY_MODERATOR_OUTCOME', handshakeId: h.id, outcome: a.outcome }]);
    }

    default: {
      // Exhaustiveness guard: TypeScript rejects this file at compile time if a
      // new HandshakeAction variant is ever added without a matching case above.
      const neverAction: never = a;
      throw new Error(`reduceHandshake: unhandled action ${JSON.stringify(neverAction)}`);
    }
  }
}

/**
 * Alias for {@link reduceHandshake}. Both names refer to the same pure
 * function; `reduceHandshake` matches design §H.6's own naming (and is what
 * the §J.2 property-test pseudocode calls directly), while `applyAction` is
 * offered for callers that prefer a generic reducer-style name.
 */
export const applyAction = reduceHandshake;

// ---- genesis: constructing the offer-0 handshake ---------------------------

export type CreateHandshakeError = 'PRICE_OUT_OF_RANGE' | 'SAME_PARTY' | 'NOT_PARTICIPANT';

export type CreateHandshakeResult =
  | { ok: true; handshake: Handshake }
  | { ok: false; error: CreateHandshakeError };

export interface CreateHandshakeInput {
  id: string;
  gigId: string;
  hoodId: string;
  posterUid: string;
  doerUid: string;
  posterSnapshot: Handshake['posterSnapshot'];
  doerSnapshot: Handshake['doerSnapshot'];
  threadId: string;
  /** The doer's opening offer — becomes offer `seq: 0` (design §E.3, §E.4). */
  offer: OfferInput & { byUid: string };
}

/**
 * Builds the fresh NEGOTIATING handshake that a claim creates (design §E.3,
 * §E.4: "Submitting creates a Handshake ... (offer seq 0)"). Pure and
 * I/O-free like the reducer itself — the atomic Firestore write that persists
 * this document is the claim endpoint's job (task 5.5), not this module's.
 *
 * Enforces the same price bound as every later offer (requirement 12.13) and
 * the reducer's standing precondition that the two parties are distinct
 * (design §H.6).
 */
export function createHandshake(input: CreateHandshakeInput, now: number): CreateHandshakeResult {
  if (input.posterUid === input.doerUid) return { ok: false, error: 'SAME_PARTY' };
  if (input.offer.byUid !== input.posterUid && input.offer.byUid !== input.doerUid) {
    return { ok: false, error: 'NOT_PARTICIPANT' };
  }
  if (!isPriceInRange(input.offer.price)) return { ok: false, error: 'PRICE_OUT_OF_RANGE' };

  const genesisOffer: Offer = { ...input.offer, seq: 0, status: 'live', createdAt: now };

  const handshake: Handshake = {
    id: input.id,
    gigId: input.gigId,
    hoodId: input.hoodId,
    posterUid: input.posterUid,
    doerUid: input.doerUid,
    posterSnapshot: input.posterSnapshot,
    doerSnapshot: input.doerSnapshot,
    state: 'NEGOTIATING',
    offers: [genesisOffer],
    latestSeq: 0,
    attestations: { done: {}, paid: {} },
    meetupNudgeShown: false,
    threadId: input.threadId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
  return { ok: true, handshake };
}
