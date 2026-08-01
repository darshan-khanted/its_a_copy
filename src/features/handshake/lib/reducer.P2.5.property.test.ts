// Property test P2.5 — "Every concurrent accept interleaving leaves exactly one
// AGREED Handshake" (design §J.2).
//
// Validates: Requirements 12.9
//
// Requirement 12.9 states that for any set of concurrent ACCEPT requests on a
// single gig, exactly one handshake reaches AGREED and the gig's
// `agreedHandshakeId` points to it, while every other concurrent caller
// receives GIG_TAKEN and its handshake is NOT mutated to AGREED. This property
// must hold regardless of the number of concurrent candidates, the
// interleaving/scheduling order, or whether calls arrive simultaneously.
//
// Since the Firebase emulator is not available in this environment, we simulate
// Firestore transaction serialization directly: a shared mutable gig state acts
// as the compare-and-set target, and a serializing mutex ensures that no two
// "transactions" overlap — exactly the isolation guarantee Firestore provides.
// fast-check generates arbitrary doer UID arrays (2–12 candidates) and
// arbitrary permutation orderings to verify the single-winner invariant holds
// under every interleaving.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  reduceHandshake,
  isTerminal,
  createHandshake,
  type HandshakeAction,
  type TransitionResult,
  type Effect,
} from '@/features/handshake/lib/reducer';
import type { Handshake, HandshakeState } from '@/types/handshake';
import type { PublicIdentity } from '@/types/user';

// ---- helpers ---------------------------------------------------------------

function makeIdentity(uid: string): PublicIdentity {
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

/** Build a NEGOTIATING handshake for a given doer against a fixed poster/gig. */
function buildHandshake(gigId: string, posterUid: string, doerUid: string, now: number): Handshake {
  const result = createHandshake(
    {
      id: `${gigId}_${doerUid}`,
      gigId,
      hoodId: 'hood-1',
      posterUid,
      doerUid,
      posterSnapshot: makeIdentity(posterUid),
      doerSnapshot: makeIdentity(doerUid),
      threadId: `thread_${gigId}_${doerUid}`,
      offer: { byUid: doerUid, price: 500, date: '2025-01-15', startTime: '18:00' },
    },
    now,
  );
  if (!result.ok) throw new Error(`fixture createHandshake failed: ${result.error}`);
  return result.handshake;
}

/**
 * Simulates the server endpoint's transactional ACCEPT logic:
 * 1. Read agreedHandshakeId (shared state).
 * 2. If already set → GIG_TAKEN (no mutation).
 * 3. Run reducer.
 * 4. CAS: set agreedHandshakeId.
 *
 * Serialization is enforced by chaining through a shared promise (mutex),
 * which mirrors Firestore's serializable transaction isolation.
 */
interface ConcurrencyHarness {
  gigAgreedHandshakeId: string | null;
  handshakeStates: Map<string, HandshakeState>;
  mutex: Promise<void>;
}

type AcceptOutcome = { handshakeId: string; result: 'AGREED' | 'GIG_TAKEN' | string };

function createHarness(): ConcurrencyHarness {
  return { gigAgreedHandshakeId: null, handshakeStates: new Map(), mutex: Promise.resolve() };
}

function attemptAcceptSerialized(
  harness: ConcurrencyHarness,
  handshake: Handshake,
  acceptorUid: string,
  now: number,
): Promise<AcceptOutcome> {
  return new Promise<AcceptOutcome>((resolve) => {
    harness.mutex = harness.mutex.then(() => {
      // Step 1: CAS precondition — is the gig already taken?
      if (harness.gigAgreedHandshakeId != null && harness.gigAgreedHandshakeId !== handshake.id) {
        resolve({ handshakeId: handshake.id, result: 'GIG_TAKEN' });
        return;
      }

      // Step 2: Run the pure reducer
      const action: HandshakeAction = { type: 'ACCEPT', byUid: acceptorUid, seq: handshake.latestSeq };
      const transitionResult = reduceHandshake(handshake, action, now);

      if (!transitionResult.ok) {
        resolve({ handshakeId: handshake.id, result: transitionResult.error });
        return;
      }

      // Step 3: CAS — double-check and set (within the same "transaction")
      if (harness.gigAgreedHandshakeId != null && harness.gigAgreedHandshakeId !== handshake.id) {
        resolve({ handshakeId: handshake.id, result: 'GIG_TAKEN' });
        return;
      }

      // Commit: set the pointer, record the state
      harness.gigAgreedHandshakeId = handshake.id;
      harness.handshakeStates.set(handshake.id, transitionResult.next.state);
      resolve({ handshakeId: handshake.id, result: 'AGREED' });
    });
  });
}

// ---- arbitraries -----------------------------------------------------------

/** Generates 2–12 distinct doer UIDs (the poster is always a separate fixed uid). */
const doerUidsArb: fc.Arbitrary<string[]> = fc
  .uniqueArray(fc.stringMatching(/^doer_[a-z0-9]{3,8}$/), { minLength: 2, maxLength: 12 })
  .filter((arr) => arr.every((uid) => uid !== 'poster_fixed'));

// ---- property test ----------------------------------------------------------

describe('P2.5 concurrent accepts leave exactly one AGREED Handshake (req 12.9)', () => {
  it('for any number of candidates and any arrival order, exactly one wins', () => {
    fc.assert(
      fc.property(doerUidsArb, fc.nat({ max: 100_000 }), (doerUids, seed) => {
        const gigId = 'gig_race';
        const posterUid = 'poster_fixed';
        const now = 10_000 + seed;

        // Build handshakes for each candidate
        const handshakes = doerUids.map((uid) => buildHandshake(gigId, posterUid, uid, now));

        // Shuffle the order using the seed (simulates arbitrary arrival order)
        const shuffled = [...handshakes];
        let s = seed;
        for (let i = shuffled.length - 1; i > 0; i--) {
          s = (s * 1664525 + 1013904223) >>> 0; // LCG
          const j = s % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Run all accepts synchronously (serialized, simulating transaction isolation)
        const harness = createHarness();
        const outcomes: AcceptOutcome[] = [];

        for (const h of shuffled) {
          // The poster accepts each doer's offer (the doer authored offer 0)
          const result = attemptAcceptSync(harness, h, posterUid, now + 1000);
          outcomes.push(result);
        }

        // Invariant 1: Exactly one AGREED
        const winners = outcomes.filter((o) => o.result === 'AGREED');
        expect(winners).toHaveLength(1);

        // Invariant 2: All others are GIG_TAKEN
        const losers = outcomes.filter((o) => o.result === 'GIG_TAKEN');
        expect(losers).toHaveLength(doerUids.length - 1);

        // Invariant 3: The gig pointer matches the winner
        expect(harness.gigAgreedHandshakeId).toBe(winners[0].handshakeId);

        // Invariant 4: The winner's state is AGREED in the recorded states
        expect(harness.handshakeStates.get(winners[0].handshakeId)).toBe('AGREED');

        // Invariant 5: No loser's handshake was mutated to AGREED
        for (const loser of losers) {
          expect(harness.handshakeStates.has(loser.handshakeId)).toBe(false);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('with Promise.all simulating true concurrency, exactly one winner emerges', async () => {
    await fc.assert(
      fc.asyncProperty(doerUidsArb, fc.nat({ max: 100_000 }), async (doerUids, seed) => {
        const gigId = 'gig_async_race';
        const posterUid = 'poster_fixed';
        const now = 20_000 + seed;

        const handshakes = doerUids.map((uid) => buildHandshake(gigId, posterUid, uid, now));
        const harness = createHarness();

        // All accepts fired concurrently — the mutex serializes them
        const outcomes = await Promise.all(
          handshakes.map((h) => attemptAcceptSerialized(harness, h, posterUid, now + 1000)),
        );

        const winners = outcomes.filter((o) => o.result === 'AGREED');
        const losers = outcomes.filter((o) => o.result === 'GIG_TAKEN');

        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(doerUids.length - 1);
        expect(harness.gigAgreedHandshakeId).toBe(winners[0].handshakeId);
      }),
      { numRuns: 200 },
    );
  });
});

// ---- synchronous version of the harness (for the non-async property) --------

function attemptAcceptSync(
  harness: ConcurrencyHarness,
  handshake: Handshake,
  acceptorUid: string,
  now: number,
): AcceptOutcome {
  // CAS precondition
  if (harness.gigAgreedHandshakeId != null && harness.gigAgreedHandshakeId !== handshake.id) {
    return { handshakeId: handshake.id, result: 'GIG_TAKEN' };
  }

  // Run reducer
  const action: HandshakeAction = { type: 'ACCEPT', byUid: acceptorUid, seq: handshake.latestSeq };
  const transitionResult = reduceHandshake(handshake, action, now);

  if (!transitionResult.ok) {
    return { handshakeId: handshake.id, result: transitionResult.error };
  }

  // CAS double-check + commit
  if (harness.gigAgreedHandshakeId != null && harness.gigAgreedHandshakeId !== handshake.id) {
    return { handshakeId: handshake.id, result: 'GIG_TAKEN' };
  }

  harness.gigAgreedHandshakeId = handshake.id;
  harness.handshakeStates.set(handshake.id, transitionResult.next.state);
  return { handshakeId: handshake.id, result: 'AGREED' };
}
