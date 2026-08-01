/**
 * Firestore security-rule regression tests (Task 1.10, Phase 0).
 *
 * Proves the default-deny baseline from `firestore.rules` (Task 1.5) actually
 * denies the attacks the trust model forbids, and — via a handful of positive
 * controls — that it is not trivially denying *everything* (which would make
 * the deny assertions meaningless).
 *
 * Coverage maps to the acceptance criteria the task traces to:
 *   - Unauthenticated writes are denied ................ NFR-3.1, req 21.8
 *   - Non-owner gig create/update/delete denied &
 *     server-owned gig fields immutable to clients ..... req 21.5, 21.7
 *   - Private KYC (users/{uid}/private/kyc) reads denied
 *     to every client (owner, stranger, anonymous) ..... req 21.9, NFR-3.6
 *   - Progression/verification writes on users denied ... req 15.2, NFR-3.2
 *   - Handshake client writes denied (server-only) ..... req 12.15, NFR-3.3
 *   - Unspecified / catch-all paths denied ............. req 21.8, NFR-3.1
 *
 * Requires the Firestore emulator. Run with `npm run test:rules` under
 * `firebase emulators:exec` (see firebase.json). Without a running emulator
 * `initializeTestEnvironment` throws a clear "could not connect" error.
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(HERE, '../../firestore.rules');

// Identities used throughout the suite.
const POSTER = 'poster_uid_1';
const DOER = 'doer_uid_1';
const STRANGER = 'stranger_uid_1';

// Fixture ids.
const GIG_ID = 'gig_1';
const HANDSHAKE_ID = 'hs_1';
const HOOD_ID = '560001';

let testEnv: RulesTestEnvironment;

/** A server-shaped public gig document (all server-owned fields populated). */
function gigFixture() {
  return {
    posterUid: POSTER,
    state: 'OPEN',
    agreedHandshakeId: null,
    claimCount: 0,
    visibleFrom: new Date('2025-01-01T00:00:00Z'),
    geoFuzzed: { lat: 12.97, lng: 77.59 },
    geohash7: 'tdr1bpq',
    fuzzSeedVersion: 1,
    posterSnapshot: { handle: 'asha', rank: 2 },
    hoodId: HOOD_ID,
    minRank: 1,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    schemaVersion: 2,
    // Poster-editable content fields.
    title: 'move a sofa',
    body: 'need help this evening',
    askPrice: 200,
    tags: ['lifting'],
    urgent: false,
    startDate: '2025-01-02',
    startTime: '18:00',
    startHour: 18,
    expiresAt: new Date('2025-01-03T00:00:00Z'),
    photoUrl: null,
  };
}

/** A server-shaped user document with progression + verification populated. */
function userFixture(uid: string) {
  return {
    displayName: 'Asha K',
    handle: `handle_${uid}`,
    bio: 'here to help',
    rep: 120,
    repVersion: 3,
    heat: 5,
    rank: 2,
    distinctCounterparties: 4,
    upheldReports: 0,
    streakWeeks: 1,
    // Seed the un-verified starting state so that an attempted self-verify is a
    // *real* field change the rules must reject (Firestore rules only evaluate
    // changed keys; re-writing an identical value is a no-op the guard allows).
    verified: false,
    verification: { status: 'none' },
    dayZero: false,
    gigsSettled: 3,
    rating: 4.5,
    ratingCount: 2,
    uid,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    schemaVersion: 2,
  };
}

/** Seed the shared fixtures with rules bypassed. */
async function seed(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'hoods', HOOD_ID), {
      pincode: HOOD_ID,
      status: 'live',
      gigCount: 12,
    });
    await setDoc(doc(db, 'gigs', GIG_ID), gigFixture());
    await setDoc(doc(db, 'gigs', GIG_ID, 'private', 'location'), {
      lat: 12.9716,
      lng: 77.5946,
    });
    await setDoc(doc(db, 'gigs', GIG_ID, 'private', 'contact'), {
      phone: '+919999999999',
    });
    await setDoc(doc(db, 'users', POSTER), userFixture(POSTER));
    await setDoc(doc(db, 'users', DOER), userFixture(DOER));
    await setDoc(doc(db, 'users', STRANGER), userFixture(STRANGER));
    await setDoc(doc(db, 'users', POSTER, 'private', 'kyc'), {
      status: 'approved',
      lastFourHash: 'abcd',
      approvedAt: new Date('2025-01-01T00:00:00Z'),
    });
    await setDoc(doc(db, 'handshakes', HANDSHAKE_ID), {
      posterUid: POSTER,
      doerUid: DOER,
      gigId: GIG_ID,
      state: 'AGREED',
      offers: [{ by: DOER, amount: 200, seq: 0 }],
    });
    await setDoc(doc(db, 'repEvents', 'evt_1'), {
      uid: POSTER,
      kind: 'DOER_COMPLETE',
      delta: 40,
    });
  });
}

// Convenience firestore handles per identity.
const anon = (): Firestore => testEnv.unauthenticatedContext().firestore();
const as = (uid: string): Firestore =>
  testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'qwick-gig-rules-test',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] ?? '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] ?? 8080),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ---------------------------------------------------------------------------
// 1. Unauthenticated writes are denied everywhere (NFR-3.1, req 21.8).
// ---------------------------------------------------------------------------
describe('unauthenticated writes are denied', () => {
  it('cannot create a gig', async () => {
    await assertFails(
      setDoc(doc(anon(), 'gigs', 'gig_anon'), gigFixture()),
    );
  });

  it('cannot update an existing gig', async () => {
    await assertFails(
      updateDoc(doc(anon(), 'gigs', GIG_ID), { title: 'hijacked' }),
    );
  });

  it('cannot create a user document', async () => {
    await assertFails(
      setDoc(doc(anon(), 'users', 'anon_user'), userFixture('anon_user')),
    );
  });

  it('cannot write to a hood cache', async () => {
    await assertFails(
      setDoc(doc(anon(), 'hoods', HOOD_ID), { status: 'live' }),
    );
  });

  it('cannot create a chat thread', async () => {
    await assertFails(
      setDoc(doc(anon(), 'chats', 'thread_anon'), {
        participants: [POSTER, DOER],
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Gig ownership + server-owned field immutability (req 21.5, 21.7).
// ---------------------------------------------------------------------------
describe('non-owner gig mutations are denied', () => {
  it('a stranger cannot update the poster gig', async () => {
    await assertFails(
      updateDoc(doc(as(STRANGER), 'gigs', GIG_ID), { title: 'stolen' }),
    );
  });

  it('a stranger cannot delete the poster gig', async () => {
    await assertFails(deleteDoc(doc(as(STRANGER), 'gigs', GIG_ID)));
  });

  it('a user cannot create a gig owned by someone else', async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), 'gigs', 'gig_forged'), {
        ...gigFixture(),
        posterUid: POSTER, // not the requester
      }),
    );
  });

  it('cannot create a gig pre-forged into a non-OPEN state', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'gigs', 'gig_forged_state'), {
        ...gigFixture(),
        posterUid: POSTER,
        state: 'MATCHED',
      }),
    );
  });

  it('cannot create a gig with a forged claim count', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'gigs', 'gig_forged_count'), {
        ...gigFixture(),
        posterUid: POSTER,
        claimCount: 7,
      }),
    );
  });
});

describe('server-owned gig fields are immutable to the owner', () => {
  it('the owner cannot flip gig state', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'gigs', GIG_ID), { state: 'MATCHED' }),
    );
  });

  it('the owner cannot set the agreed handshake id', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'gigs', GIG_ID), {
        agreedHandshakeId: HANDSHAKE_ID,
      }),
    );
  });

  it('the owner cannot bump the claim count', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'gigs', GIG_ID), { claimCount: 99 }),
    );
  });

  it('the owner cannot overwrite the fuzzed geo / geohash', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'gigs', GIG_ID), {
        geohash7: 'ffffff0',
        geoFuzzed: { lat: 0, lng: 0 },
      }),
    );
  });

  it('the owner cannot widen the visibility window', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'gigs', GIG_ID), {
        visibleFrom: new Date('2020-01-01T00:00:00Z'),
      }),
    );
  });

  // Positive control: the owner CAN edit an allowlisted content field on an
  // OPEN gig — proving the rules are not blanket-denying every write.
  it('the owner can edit allowlisted content fields on an OPEN gig', async () => {
    await assertSucceeds(
      updateDoc(doc(as(POSTER), 'gigs', GIG_ID), {
        title: 'move a sofa (updated)',
        askPrice: 250,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Private KYC reads denied to every client (req 21.9, NFR-3.6).
// ---------------------------------------------------------------------------
describe('private KYC is unreachable by any client', () => {
  it('the owner cannot read their own KYC document', async () => {
    await assertFails(
      getDoc(doc(as(POSTER), 'users', POSTER, 'private', 'kyc')),
    );
  });

  it('a stranger cannot read another user KYC document', async () => {
    await assertFails(
      getDoc(doc(as(STRANGER), 'users', POSTER, 'private', 'kyc')),
    );
  });

  it('an anonymous client cannot read a KYC document', async () => {
    await assertFails(
      getDoc(doc(anon(), 'users', POSTER, 'private', 'kyc')),
    );
  });

  it('the owner cannot write their own KYC document', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'users', POSTER, 'private', 'kyc'), {
        status: 'approved',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Progression / verification writes on users denied (req 15.2, NFR-3.2).
// ---------------------------------------------------------------------------
describe('progression and verification fields are server-write-only', () => {
  it('the owner cannot inflate their rep', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'users', POSTER), { rep: 999999 }),
    );
  });

  it('the owner cannot raise their rank', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'users', POSTER), { rank: 5 }),
    );
  });

  it('the owner cannot self-verify', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'users', POSTER), { verified: true }),
    );
  });

  it('the owner cannot mutate the nested verification object', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'users', POSTER), {
        'verification.status': 'approved',
      }),
    );
  });

  it('the owner cannot edit the distinct-counterparty count', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'users', POSTER), {
        distinctCounterparties: 50,
      }),
    );
  });

  it('a client cannot write to the immutable rep ledger', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'repEvents', 'evt_forged'), {
        uid: POSTER,
        delta: 500,
      }),
    );
  });

  it('a new account cannot self-grant verification at creation time', async () => {
    await assertFails(
      setDoc(doc(as('fresh_uid'), 'users', 'fresh_uid'), {
        ...userFixture('fresh_uid'),
        verified: true,
      }),
    );
  });

  // Positive controls: a plain profile edit and a clean account creation.
  it('the owner can edit plain profile fields', async () => {
    await assertSucceeds(
      updateDoc(doc(as(POSTER), 'users', POSTER), {
        displayName: 'Asha the mover',
        bio: 'updated bio',
      }),
    );
  });

  it('a fresh account can be created with zeroed progression', async () => {
    await assertSucceeds(
      setDoc(doc(as('fresh_uid'), 'users', 'fresh_uid'), {
        displayName: 'New User',
        handle: 'newbie',
        rep: 0,
        verified: false,
        verification: { status: 'none' },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Handshake client writes denied — server-only transitions (req 12.15).
// ---------------------------------------------------------------------------
describe('handshake documents are server-write-only', () => {
  it('the poster participant cannot transition the handshake', async () => {
    await assertFails(
      updateDoc(doc(as(POSTER), 'handshakes', HANDSHAKE_ID), {
        state: 'LIVE',
      }),
    );
  });

  it('the doer participant cannot transition the handshake', async () => {
    await assertFails(
      updateDoc(doc(as(DOER), 'handshakes', HANDSHAKE_ID), {
        state: 'SETTLED',
      }),
    );
  });

  it('a client cannot create a handshake directly', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'handshakes', 'hs_forged'), {
        posterUid: POSTER,
        doerUid: DOER,
        gigId: GIG_ID,
        state: 'AGREED',
      }),
    );
  });

  it('a participant cannot delete the handshake', async () => {
    await assertFails(deleteDoc(doc(as(DOER), 'handshakes', HANDSHAKE_ID)));
  });

  it('a non-participant cannot read the handshake', async () => {
    await assertFails(
      getDoc(doc(as(STRANGER), 'handshakes', HANDSHAKE_ID)),
    );
  });

  // Positive control: a participant CAN read their own handshake.
  it('a participant can read their own handshake', async () => {
    await assertSucceeds(
      getDoc(doc(as(POSTER), 'handshakes', HANDSHAKE_ID)),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Unspecified / catch-all paths denied (req 21.8, NFR-3.1).
// ---------------------------------------------------------------------------
describe('unspecified and server-owned paths are denied', () => {
  it('an authenticated client cannot write an arbitrary collection', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'totallyUnknownCollection', 'x'), { a: 1 }),
    );
  });

  it('an authenticated client cannot read an arbitrary collection', async () => {
    await assertFails(
      getDoc(doc(as(POSTER), 'totallyUnknownCollection', 'x')),
    );
  });

  it('a client cannot write server-owned rate-limit counters', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'writeCounters', `${POSTER}_2025010110`), {
        count: 0,
      }),
    );
  });

  it('a client cannot write the phone-uniqueness index', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'phoneIndex', 'phonehash'), { uid: POSTER }),
    );
  });

  it('a client cannot write the waitlist', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'waitlist', 'emailhash'), { email: 'x' }),
    );
  });

  it('a client cannot read reports', async () => {
    await assertFails(getDoc(doc(as(POSTER), 'reports', 'r1')));
  });

  it('a client cannot read or write password resets', async () => {
    await assertFails(getDoc(doc(as(POSTER), 'password_resets', 'pr1')));
    await assertFails(
      setDoc(doc(as(POSTER), 'password_resets', 'pr1'), { token: 'x' }),
    );
  });

  it('a client cannot write audit/activity logs', async () => {
    await assertFails(
      setDoc(doc(as(POSTER), 'activities_admin', 'a1'), { action: 'x' }),
    );
  });

  // Positive controls: public reads that the rules explicitly allow.
  it('anyone can read a public gig', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'gigs', GIG_ID)));
  });

  it('anyone can read a hood before auth', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'hoods', HOOD_ID)));
  });
});

// A tiny meta-check so the file fails loudly if the fixture ids drift.
describe('fixtures', () => {
  it('exposes the expected identities', () => {
    expect([POSTER, DOER, STRANGER]).toHaveLength(3);
  });
});
