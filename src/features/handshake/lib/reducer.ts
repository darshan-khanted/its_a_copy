/**
 * Pure Handshake state machine reducer.
 * No I/O, no clock access - `now` is always injected.
 * This is what makes it property-testable.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type HandshakeState =
  | 'NEGOTIATING'
  | 'AGREED'
  | 'LIVE'
  | 'DONE_PENDING'
  | 'SETTLED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

export interface Offer {
  seq: number;
  byUid: string;
  price: number;
  date: string;
  startTime: string;
  endTime?: string;
  note?: string;
  createdAt: number;
  status: 'live' | 'superseded' | 'accepted' | 'declined';
}

export interface Handshake {
  id: string;
  gigId: string;
  hoodId: string;
  posterUid: string;
  doerUid: string;
  state: HandshakeState;
  offers: Offer[];
  latestSeq: number;
  agreed?: {
    price: number;
    date: string;
    startTime: string;
    endTime?: string;
    agreedAt: number;
    agreedOfferSeq: number;
  };
  attestations: {
    done: Record<string, number>;
    paid: Record<string, number>;
  };
  paymentMethod?: 'upi' | 'cash';
  meetupNudgeShown: boolean;
  threadId: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type HandshakeAction =
  | { type: 'COUNTER'; byUid: string; offer: Omit<Offer, 'seq' | 'status' | 'createdAt' | 'byUid'> }
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

// ─── Effects ─────────────────────────────────────────────────────────────────

export type Effect =
  | { type: 'NOTIFY'; uid: string; kind: string }
  | { type: 'NOTIFY_BOTH'; kind: string }
  | { type: 'PUSH_BOTH'; kind: string }
  | { type: 'EMAIL_BOTH'; kind: string }
  | { type: 'TOUCH_THREAD' }
  | { type: 'CAS_GIG_AGREED'; gigId: string; handshakeId: string }
  | { type: 'SET_GIG_STATE'; gigId: string; state: string }
  | { type: 'DECLINE_OTHER_HANDSHAKES'; gigId: string; except: string }
  | { type: 'REVEAL_CONTACT'; uid1: string; uid2: string }
  | { type: 'REVEAL_EXACT_LOCATION'; handshakeId: string }
  | { type: 'MEETUP_NUDGE'; handshakeId: string }
  | { type: 'GRANT_REP'; uid: string; kind: string; key: string }
  | { type: 'OPEN_LOOP'; handshakeId: string }
  | { type: 'SHOW_RECEIPT'; handshakeId: string }
  | { type: 'RECORD_PAYMENT_ATTESTATION'; handshakeId: string }
  | { type: 'OPEN_MODERATION_CASE'; handshakeId: string; reason: string }
  | { type: 'RELEASE_GIG'; gigId: string }
  | { type: 'APPLY_MODERATOR_OUTCOME'; handshakeId: string; outcome: string };

// ─── Errors ──────────────────────────────────────────────────────────────────

export type TransitionError =
  | 'ILLEGAL_STATE'
  | 'NOT_PARTICIPANT'
  | 'SELF_ACCEPT'
  | 'STALE_OFFER'
  | 'ALREADY_ATTESTED'
  | 'GIG_TAKEN'
  | 'PRICE_OUT_OF_RANGE';

// ─── Result ──────────────────────────────────────────────────────────────────

export type TransitionResult =
  | { ok: true; next: Handshake; effects: Effect[] }
  | { ok: false; error: TransitionError };

// ─── Legality table ──────────────────────────────────────────────────────────

export const LEGAL: Readonly<Record<HandshakeState, ReadonlyArray<HandshakeAction['type']>>> = {
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
};

const TERMINAL_STATES: ReadonlySet<HandshakeState> = new Set([
  'SETTLED',
  'DECLINED',
  'WITHDRAWN',
  'EXPIRED',
  'CANCELLED',
]);

export function isTerminal(s: HandshakeState): boolean {
  return TERMINAL_STATES.has(s);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function err(error: TransitionError): TransitionResult {
  return { ok: false, error };
}

function ok(next: Handshake, effects: Effect[]): TransitionResult {
  return { ok: true, next, effects };
}

function otherParticipant(h: Handshake, uid: string): string {
  return uid === h.posterUid ? h.doerUid : h.posterUid;
}

function getByUid(a: HandshakeAction): string | undefined {
  if ('byUid' in a) return a.byUid;
  if ('byModerator' in a) return (a as { byModerator: string }).byModerator;
  return undefined;
}

function isParticipant(h: Handshake, uid: string): boolean {
  return uid === h.posterUid || uid === h.doerUid;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function reduceHandshake(
  h: Handshake,
  a: HandshakeAction,
  now: number,
): TransitionResult {
  // Deep clone to ensure purity
  const state = structuredClone(h);

  // Check legality
  if (!LEGAL[state.state].includes(a.type)) {
    return err('ILLEGAL_STATE');
  }

  // Check participant for actions that have byUid (not EXPIRE, not RESOLVE)
  if (a.type !== 'EXPIRE' && a.type !== 'RESOLVE') {
    const byUid = (a as { byUid: string }).byUid;
    if (!isParticipant(state, byUid)) {
      return err('NOT_PARTICIPANT');
    }
  }

  switch (a.type) {
    case 'COUNTER': {
      const latest = state.offers[state.latestSeq];
      // No self-counter: you cannot counter your own offer
      if (latest.byUid === a.byUid) {
        return err('ILLEGAL_STATE');
      }
      // Price validation
      if (a.offer.price <= 0 || a.offer.price > 100000) {
        return err('PRICE_OUT_OF_RANGE');
      }
      // Mark previous offer as superseded
      latest.status = 'superseded';
      // Append new offer
      const newOffer: Offer = {
        ...a.offer,
        seq: state.latestSeq + 1,
        byUid: a.byUid,
        status: 'live',
        createdAt: now,
      };
      state.offers.push(newOffer);
      state.latestSeq = state.latestSeq + 1;
      state.updatedAt = now;
      return ok(state, [
        { type: 'NOTIFY', uid: otherParticipant(state, a.byUid), kind: 'countered' },
        { type: 'TOUCH_THREAD' },
      ]);
    }

    case 'ACCEPT': {
      const latest = state.offers[state.latestSeq];
      // Stale offer check
      if (a.seq !== state.latestSeq) {
        return err('STALE_OFFER');
      }
      // Self-accept check
      if (latest.byUid === a.byUid) {
        return err('SELF_ACCEPT');
      }
      // Mark offer as accepted
      latest.status = 'accepted';
      state.state = 'AGREED';
      state.agreed = {
        price: latest.price,
        date: latest.date,
        startTime: latest.startTime,
        endTime: latest.endTime,
        agreedAt: now,
        agreedOfferSeq: latest.seq,
      };
      state.updatedAt = now;
      return ok(state, [
        { type: 'CAS_GIG_AGREED', gigId: state.gigId, handshakeId: state.id },
        { type: 'SET_GIG_STATE', gigId: state.gigId, state: 'MATCHED' },
        { type: 'DECLINE_OTHER_HANDSHAKES', gigId: state.gigId, except: state.id },
        { type: 'REVEAL_CONTACT', uid1: state.posterUid, uid2: state.doerUid },
        { type: 'NOTIFY_BOTH', kind: 'agreed' },
        { type: 'PUSH_BOTH', kind: 'agreed' },
        { type: 'EMAIL_BOTH', kind: 'agreed' },
      ]);
    }

    case 'START': {
      state.state = 'LIVE';
      state.updatedAt = now;
      return ok(state, [
        { type: 'SET_GIG_STATE', gigId: state.gigId, state: 'LIVE' },
        { type: 'REVEAL_EXACT_LOCATION', handshakeId: state.id },
      ]);
    }

    case 'ATTEST_DONE': {
      if (state.attestations.done[a.byUid] != null) {
        return err('ALREADY_ATTESTED');
      }
      state.attestations.done[a.byUid] = now;
      if (Object.keys(state.attestations.done).length === 2) {
        // Both parties attested - settled
        state.state = 'SETTLED';
        state.updatedAt = now;
        return ok(state, [
          { type: 'SET_GIG_STATE', gigId: state.gigId, state: 'DONE' },
          { type: 'GRANT_REP', uid: state.doerUid, kind: 'GIG_COMPLETED_AS_DOER', key: `${state.id}:doer` },
          { type: 'GRANT_REP', uid: state.posterUid, kind: 'GIG_COMPLETED_AS_POSTER', key: `${state.id}:poster` },
          { type: 'OPEN_LOOP', handshakeId: state.id },
          { type: 'SHOW_RECEIPT', handshakeId: state.id },
        ]);
      } else {
        state.state = 'DONE_PENDING';
        state.updatedAt = now;
        return ok(state, [
          { type: 'NOTIFY', uid: otherParticipant(state, a.byUid), kind: 'confirm-done' },
        ]);
      }
    }

    case 'ATTEST_PAID': {
      state.attestations.paid[a.byUid] = now;
      state.paymentMethod = a.method;
      state.updatedAt = now;
      return ok(state, [
        { type: 'RECORD_PAYMENT_ATTESTATION', handshakeId: state.id },
      ]);
    }

    case 'DISPUTE': {
      state.state = 'DISPUTED';
      state.updatedAt = now;
      return ok(state, [
        { type: 'OPEN_MODERATION_CASE', handshakeId: state.id, reason: a.reason },
      ]);
    }

    case 'DECLINE': {
      state.state = 'DECLINED';
      state.updatedAt = now;
      return ok(state, [
        { type: 'NOTIFY', uid: state.doerUid, kind: 'declined' },
      ]);
    }

    case 'WITHDRAW': {
      state.state = 'WITHDRAWN';
      state.updatedAt = now;
      return ok(state, [
        { type: 'NOTIFY', uid: state.posterUid, kind: 'withdrawn' },
      ]);
    }

    case 'CANCEL': {
      state.state = 'CANCELLED';
      state.updatedAt = now;
      return ok(state, [
        { type: 'RELEASE_GIG', gigId: state.gigId },
        { type: 'NOTIFY_BOTH', kind: 'cancelled' },
      ]);
    }

    case 'EXPIRE': {
      state.state = 'EXPIRED';
      state.updatedAt = now;
      return ok(state, []);
    }

    case 'RESOLVE': {
      state.state = a.outcome === 'settle' ? 'SETTLED' : 'CANCELLED';
      state.updatedAt = now;
      return ok(state, [
        { type: 'APPLY_MODERATOR_OUTCOME', handshakeId: state.id, outcome: a.outcome },
      ]);
    }
  }
}
