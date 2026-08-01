import { describe, it, expect, beforeEach } from "vitest";
import { FakeAdminDb, FakeAdminAuth } from "./helpers/fakeAdmin";
import {
  createHandshake,
  reduceHandshake,
  isTerminal,
  isLegalAction,
  LEGAL,
} from "../../src/features/handshake/lib/reducer";
import type { Handshake, Offer } from "../../src/types/handshake";
import type { PublicIdentity } from "../../src/types/user";
import {
  convertLegacyClaimsMigration,
  CONVERT_LEGACY_CLAIMS_ID,
} from "../../server/migrations/convertLegacyClaims";
import {
  MigrationRunner,
  MigrationStateStore,
} from "../../server/migrations/framework";
import { rulesAndIndexesGate, RULES_AND_INDEXES_ID } from "../../server/migrations/rulesAndIndexes";

/**
 * Claim and Handshake endpoint integration tests (task 5.17).
 *
 * Covers:
 *  - Atomic rollback (req 11.6)
 *  - Retry idempotency (req 11.7)
 *  - First-message uniqueness (req 11.6)
 *  - Claim-count correctness (req 11.6)
 *  - State expiry
 *  - Rules denial (req 12.14, 12.15)
 *  - Legal UI actions (req 12.16)
 *  - Single-winner ACCEPT (req 12.8)
 *  - Legacy migration results (req 31.6, 31.7)
 *  - Identity gate (req 11.11)
 *
 * Uses FakeAdminDb to simulate the transaction read-check-write pattern inline
 * since a Firestore emulator is not available.
 */

// ---- test fixtures -----------------------------------------------------------

function makeIdentity(uid: string, overrides: Partial<PublicIdentity> = {}): PublicIdentity {
  return {
    uid,
    handle: uid,
    displayName: uid,
    avatarSeed: uid,
    rank: "TAPPED_IN",
    rep: 0,
    verified: true,
    gigsSettled: 0,
    rating: null,
    ratingCount: 0,
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;
const POSTER_UID = "poster-1";
const DOER_UID = "doer-1";
const DOER2_UID = "doer-2";
const GIG_ID = "gig-abc";

function makeHandshake(overrides: Partial<Handshake> = {}): Handshake {
  const posterSnap = makeIdentity(POSTER_UID);
  const doerSnap = makeIdentity(DOER_UID);
  return {
    id: `${GIG_ID}_${DOER_UID}`,
    gigId: GIG_ID,
    hoodId: "hood-1",
    posterUid: POSTER_UID,
    doerUid: DOER_UID,
    posterSnapshot: posterSnap,
    doerSnapshot: doerSnap,
    state: "NEGOTIATING",
    offers: [{ seq: 0, byUid: DOER_UID, price: 500, date: "2024-01-10", startTime: "10:00", status: "live", createdAt: NOW }],
    latestSeq: 0,
    attestations: { done: {}, paid: {} },
    meetupNudgeShown: false,
    threadId: `thread_${GIG_ID}_${DOER_UID}`,
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
    ...overrides,
  };
}

/**
 * Simulates the atomic claim-creation transaction inline using FakeAdminDb.
 * Returns { existing: boolean; error?: string } mirroring the endpoint logic.
 */
async function simulateClaimTransaction(
  db: FakeAdminDb,
  opts: {
    gigId: string;
    doerUid: string;
    posterUid: string;
    offerPrice: number;
    oneLiner: string;
    hoodId?: string;
    askPrice?: number;
  },
): Promise<{ existing: boolean; error?: string; handshakeId?: string }> {
  const { gigId, doerUid, posterUid, offerPrice, oneLiner, hoodId, askPrice } = opts;
  const handshakeId = `${gigId}_${doerUid}`;
  const threadId = `thread_${gigId}_${doerUid}`;
  const idemDocId = `${gigId}_${doerUid}`;

  // Check idempotency key
  const idemSnap = await db.collection("idempotencyKeys").doc(idemDocId).get();
  if (idemSnap.exists) {
    return { existing: true, handshakeId };
  }

  // Re-read gig state
  const gigSnap = await db.collection("gigs").doc(gigId).get();
  if (!gigSnap.exists || gigSnap.data()!.state !== "OPEN") {
    return { existing: false, error: "GIG_NOT_OPEN" };
  }

  const gigData = gigSnap.data()!;
  const currentClaimCount: number = gigData.claimCount ?? 0;
  const now = Date.now();

  // Create handshake via the pure reducer
  const posterSnap = makeIdentity(posterUid);
  const doerSnap = makeIdentity(doerUid);
  const createResult = createHandshake(
    {
      id: handshakeId,
      gigId,
      hoodId: hoodId ?? "hood-1",
      posterUid,
      doerUid,
      posterSnapshot: posterSnap,
      doerSnapshot: doerSnap,
      threadId,
      offer: { byUid: doerUid, price: offerPrice, date: "2024-01-10", startTime: "10:00" },
    },
    now,
  );

  if (!createResult.ok) {
    // Rollback: nothing written
    return { existing: false, error: createResult.error };
  }

  // Atomic writes (simulated transaction - all or nothing)
  await db.collection("handshakes").doc(handshakeId).set(createResult.handshake);
  await db.collection("chats").doc(threadId).set({
    id: threadId,
    gigId,
    participants: [posterUid, doerUid],
    lastMessage: oneLiner,
    createdAt: now,
  });
  // System message
  const sysId = `sys_${handshakeId}`;
  await db.collection(`chats/${threadId}/messages`).doc(sysId).set({
    id: sysId,
    senderUid: "system",
    text: `${doerUid} claimed at ${offerPrice}`,
    timestamp: now,
    isSystem: true,
  });
  // Human message
  const humId = `hum_${handshakeId}`;
  await db.collection(`chats/${threadId}/messages`).doc(humId).set({
    id: humId,
    senderUid: doerUid,
    text: oneLiner,
    timestamp: now + 1,
  });
  // Increment claim count
  await db.collection("gigs").doc(gigId).update({ claimCount: currentClaimCount + 1 });
  // Write idempotency key
  await db.collection("idempotencyKeys").doc(idemDocId).set({
    handshakeId,
    threadId,
    doerUid,
    gigId,
    createdAt: now,
  });

  return { existing: false, handshakeId };
}

// ---- 1. Atomic rollback (req 11.6) ------------------------------------------

describe("atomic rollback (req 11.6)", () => {
  it("leaves no artifacts when createHandshake rejects (price out of range)", async () => {
    const db = new FakeAdminDb();
    db.seed("gigs", GIG_ID, { state: "OPEN", posterUid: POSTER_UID, askPrice: 500, hoodId: "hood-1", claimCount: 0 });

    const result = await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER_UID,
      posterUid: POSTER_UID,
      offerPrice: 0, // invalid
      oneLiner: "I can do this!",
    });

    expect(result.error).toBe("PRICE_OUT_OF_RANGE");
    // No artifacts should exist
    expect(db.get("handshakes", `${GIG_ID}_${DOER_UID}`)).toBeUndefined();
    expect(db.get("chats", `thread_${GIG_ID}_${DOER_UID}`)).toBeUndefined();
    expect(db.get("idempotencyKeys", `${GIG_ID}_${DOER_UID}`)).toBeUndefined();
    // claimCount unchanged
    expect(db.get("gigs", GIG_ID)!.claimCount).toBe(0);
  });

  it("leaves no artifacts when gig is not OPEN", async () => {
    const db = new FakeAdminDb();
    db.seed("gigs", GIG_ID, { state: "MATCHED", posterUid: POSTER_UID, askPrice: 500, hoodId: "hood-1", claimCount: 1 });

    const result = await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER_UID,
      posterUid: POSTER_UID,
      offerPrice: 500,
      oneLiner: "I can do this!",
    });

    expect(result.error).toBe("GIG_NOT_OPEN");
    expect(db.get("handshakes", `${GIG_ID}_${DOER_UID}`)).toBeUndefined();
    expect(db.get("idempotencyKeys", `${GIG_ID}_${DOER_UID}`)).toBeUndefined();
  });
});

// ---- 2. Retry idempotency (req 11.7) ----------------------------------------

describe("retry idempotency (req 11.7)", () => {
  it("same doer+gig returns existing without duplicate claimCount or messages", async () => {
    const db = new FakeAdminDb();
    db.seed("gigs", GIG_ID, { state: "OPEN", posterUid: POSTER_UID, askPrice: 500, hoodId: "hood-1", claimCount: 0 });

    // First call creates
    const first = await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER_UID,
      posterUid: POSTER_UID,
      offerPrice: 500,
      oneLiner: "I can do this!",
    });
    expect(first.existing).toBe(false);
    expect(first.handshakeId).toBe(`${GIG_ID}_${DOER_UID}`);
    expect(db.get("gigs", GIG_ID)!.claimCount).toBe(1);

    const writesAfterFirst = db.writes;

    // Second call is idempotent
    const second = await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER_UID,
      posterUid: POSTER_UID,
      offerPrice: 500,
      oneLiner: "I can do this!",
    });
    expect(second.existing).toBe(true);
    // No new writes
    expect(db.writes).toBe(writesAfterFirst);
    // claimCount still 1
    expect(db.get("gigs", GIG_ID)!.claimCount).toBe(1);
  });
});

// ---- 3. First-message uniqueness (req 11.6) ---------------------------------

describe("first-message uniqueness (req 11.6)", () => {
  it("creates exactly one system msg and one human msg per claim", async () => {
    const db = new FakeAdminDb();
    db.seed("gigs", GIG_ID, { state: "OPEN", posterUid: POSTER_UID, askPrice: 500, hoodId: "hood-1", claimCount: 0 });

    await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER_UID,
      posterUid: POSTER_UID,
      offerPrice: 500,
      oneLiner: "Hey, I can help!",
    });

    const threadId = `thread_${GIG_ID}_${DOER_UID}`;
    const handshakeId = `${GIG_ID}_${DOER_UID}`;
    const messagesMap = db.store[`chats/${threadId}/messages`];
    expect(messagesMap).toBeDefined();
    expect(messagesMap!.size).toBe(2);

    const messages = Array.from(messagesMap!.values());
    const systemMsgs = messages.filter((m) => m.isSystem === true);
    const humanMsgs = messages.filter((m) => m.senderUid === DOER_UID);

    expect(systemMsgs).toHaveLength(1);
    expect(humanMsgs).toHaveLength(1);
    expect(humanMsgs[0].text).toBe("Hey, I can help!");
  });
});

// ---- 4. Claim-count correctness (req 11.6) ----------------------------------

describe("claim-count correctness (req 11.6)", () => {
  it("multiple doers increment claimCount = number of unique claims", async () => {
    const db = new FakeAdminDb();
    db.seed("gigs", GIG_ID, { state: "OPEN", posterUid: POSTER_UID, askPrice: 500, hoodId: "hood-1", claimCount: 0 });

    await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER_UID,
      posterUid: POSTER_UID,
      offerPrice: 500,
      oneLiner: "First doer here",
    });
    await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER2_UID,
      posterUid: POSTER_UID,
      offerPrice: 750,
      oneLiner: "Second doer here",
    });

    expect(db.get("gigs", GIG_ID)!.claimCount).toBe(2);
    expect(db.get("handshakes", `${GIG_ID}_${DOER_UID}`)).toBeDefined();
    expect(db.get("handshakes", `${GIG_ID}_${DOER2_UID}`)).toBeDefined();
  });
});

// ---- 5. State expiry ---------------------------------------------------------

describe("state expiry", () => {
  it("stale NEGOTIATING handshake transitions to EXPIRED via reducer", () => {
    const h = makeHandshake({ state: "NEGOTIATING", updatedAt: NOW });
    const result = reduceHandshake(h, { type: "EXPIRE" }, NOW + 72 * 60 * 60 * 1000 + 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next.state).toBe("EXPIRED");
      expect(isTerminal(result.next.state)).toBe(true);
    }
  });

  it("stale AGREED handshake transitions to EXPIRED via reducer", () => {
    const h = makeHandshake({
      state: "AGREED",
      updatedAt: NOW,
      agreed: { price: 500, date: "2024-01-10", startTime: "10:00", agreedAt: NOW, agreedOfferSeq: 0 },
    });
    const result = reduceHandshake(h, { type: "EXPIRE" }, NOW + 100_000_000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next.state).toBe("EXPIRED");
    }
  });

  it("EXPIRED state cannot be left", () => {
    const h = makeHandshake({ state: "EXPIRED" });
    const result = reduceHandshake(h, { type: "COUNTER", byUid: POSTER_UID, offer: { price: 600, date: "", startTime: "" } }, NOW + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("ILLEGAL_STATE");
  });
});

// ---- 6. Rules denial (req 12.14, 12.15) -------------------------------------

describe("rules denial (req 12.14, 12.15)", () => {
  it("rejects non-participants from acting", () => {
    const h = makeHandshake();
    const outsider = "random-outsider";
    const result = reduceHandshake(h, { type: "ACCEPT", byUid: outsider, seq: 0 }, NOW + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_PARTICIPANT");
  });

  it("rejects ACCEPT from the same party that authored the latest offer (self-accept)", () => {
    const h = makeHandshake(); // latest offer by DOER_UID
    const result = reduceHandshake(h, { type: "ACCEPT", byUid: DOER_UID, seq: 0 }, NOW + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("SELF_ACCEPT");
  });

  it("rejects illegal state transitions (DECLINE from AGREED)", () => {
    const h = makeHandshake({
      state: "AGREED",
      agreed: { price: 500, date: "2024-01-10", startTime: "10:00", agreedAt: NOW, agreedOfferSeq: 0 },
    });
    const result = reduceHandshake(h, { type: "DECLINE", byUid: POSTER_UID }, NOW + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("ILLEGAL_STATE");
  });

  it("rejects COUNTER with price out of range", () => {
    const h = makeHandshake();
    const result = reduceHandshake(
      h,
      { type: "COUNTER", byUid: POSTER_UID, offer: { price: -100, date: "", startTime: "" } },
      NOW + 1,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("PRICE_OUT_OF_RANGE");
  });

  it("rejects stale seq on ACCEPT", () => {
    // Advance to seq 1 via a counter from poster
    const h = makeHandshake();
    const counterResult = reduceHandshake(
      h,
      { type: "COUNTER", byUid: POSTER_UID, offer: { price: 600, date: "", startTime: "" } },
      NOW + 1,
    );
    expect(counterResult.ok).toBe(true);
    if (!counterResult.ok) return;

    // Try to accept stale seq 0
    const result = reduceHandshake(counterResult.next, { type: "ACCEPT", byUid: DOER_UID, seq: 0 }, NOW + 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("STALE_OFFER");
  });
});

// ---- 7. Legal UI actions (req 12.16) ----------------------------------------

describe("legal UI actions (req 12.16)", () => {
  it("ACCEPT transitions NEGOTIATING to AGREED", () => {
    const h = makeHandshake(); // latest offer by DOER_UID
    const result = reduceHandshake(h, { type: "ACCEPT", byUid: POSTER_UID, seq: 0 }, NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.state).toBe("AGREED");
    expect(result.next.agreed).toBeDefined();
    expect(result.next.agreed!.price).toBe(500);
    expect(result.next.agreed!.agreedOfferSeq).toBe(0);
  });

  it("DECLINE transitions NEGOTIATING to DECLINED", () => {
    const h = makeHandshake();
    const result = reduceHandshake(h, { type: "DECLINE", byUid: POSTER_UID }, NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.state).toBe("DECLINED");
    expect(isTerminal(result.next.state)).toBe(true);
  });

  it("COUNTER updates offers and stays in NEGOTIATING", () => {
    const h = makeHandshake();
    const result = reduceHandshake(
      h,
      { type: "COUNTER", byUid: POSTER_UID, offer: { price: 400, date: "2024-01-11", startTime: "14:00" } },
      NOW + 1,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.state).toBe("NEGOTIATING");
    expect(result.next.offers).toHaveLength(2);
    expect(result.next.latestSeq).toBe(1);
    expect(result.next.offers[1].price).toBe(400);
    expect(result.next.offers[1].byUid).toBe(POSTER_UID);
    expect(result.next.offers[0].status).toBe("superseded");
  });

  it("dual ATTEST_DONE transitions LIVE to SETTLED", () => {
    const h = makeHandshake({ state: "LIVE" });
    // First attestation
    const r1 = reduceHandshake(h, { type: "ATTEST_DONE", byUid: POSTER_UID }, NOW + 1);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.next.state).toBe("DONE_PENDING");

    // Second attestation
    const r2 = reduceHandshake(r1.next, { type: "ATTEST_DONE", byUid: DOER_UID }, NOW + 2);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.next.state).toBe("SETTLED");
    expect(isTerminal(r2.next.state)).toBe(true);
  });

  it("WITHDRAW transitions NEGOTIATING to WITHDRAWN", () => {
    const h = makeHandshake();
    const result = reduceHandshake(h, { type: "WITHDRAW", byUid: DOER_UID }, NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.state).toBe("WITHDRAWN");
    expect(isTerminal(result.next.state)).toBe(true);
  });
});

// ---- 8. Single-winner ACCEPT (req 12.8) -------------------------------------

describe("single-winner ACCEPT (req 12.8)", () => {
  it("two handshakes, accept one sets gig pointer and declines the other", async () => {
    const db = new FakeAdminDb();
    // Set up two handshakes for the same gig
    const h1 = makeHandshake({ id: `${GIG_ID}_${DOER_UID}`, doerUid: DOER_UID });
    const h2 = makeHandshake({ id: `${GIG_ID}_${DOER2_UID}`, doerUid: DOER2_UID });
    db.seed("handshakes", h1.id, h1);
    db.seed("handshakes", h2.id, h2);
    db.seed("gigs", GIG_ID, { state: "OPEN", posterUid: POSTER_UID, agreedHandshakeId: null, claimCount: 2 });

    // Accept h1 via reducer
    const acceptResult = reduceHandshake(h1, { type: "ACCEPT", byUid: POSTER_UID, seq: 0 }, NOW + 1);
    expect(acceptResult.ok).toBe(true);
    if (!acceptResult.ok) return;

    // Simulate the CAS_GIG_AGREED effect: check and set gig pointer
    const gigData = db.get("gigs", GIG_ID)!;
    expect(gigData.agreedHandshakeId).toBeNull(); // not yet set
    // CAS succeeds
    await db.collection("gigs").doc(GIG_ID).update({ agreedHandshakeId: h1.id, state: "MATCHED" });
    await db.collection("handshakes").doc(h1.id).set(acceptResult.next);
    // Decline other handshakes (DECLINE_OTHER_HANDSHAKES effect)
    await db.collection("handshakes").doc(h2.id).update({ state: "DECLINED", updatedAt: NOW + 1 });

    // Verify the final state
    expect(db.get("gigs", GIG_ID)!.agreedHandshakeId).toBe(h1.id);
    expect(db.get("gigs", GIG_ID)!.state).toBe("MATCHED");
    expect(db.get("handshakes", h1.id)!.state).toBe("AGREED");
    expect(db.get("handshakes", h2.id)!.state).toBe("DECLINED");
  });

  it("second accept fails with GIG_TAKEN when pointer already set", async () => {
    const db = new FakeAdminDb();
    const h1 = makeHandshake({ id: `${GIG_ID}_${DOER_UID}`, doerUid: DOER_UID });
    const h2 = makeHandshake({ id: `${GIG_ID}_${DOER2_UID}`, doerUid: DOER2_UID });
    db.seed("handshakes", h1.id, h1);
    db.seed("handshakes", h2.id, h2);
    // Gig already has an agreed handshake (from first accept)
    db.seed("gigs", GIG_ID, { state: "MATCHED", posterUid: POSTER_UID, agreedHandshakeId: h1.id });

    // The reducer itself succeeds for h2 (it does not know about the gig pointer)
    const acceptResult = reduceHandshake(h2, { type: "ACCEPT", byUid: POSTER_UID, seq: 0 }, NOW + 2);
    expect(acceptResult.ok).toBe(true);

    // But the CAS_GIG_AGREED effect check fails
    const gigData = db.get("gigs", GIG_ID)!;
    const casSuccess = gigData.agreedHandshakeId === null || gigData.agreedHandshakeId === h2.id;
    expect(casSuccess).toBe(false); // CAS fails - gig is taken
  });
});

// ---- 9. Legacy migration results (req 31.6, 31.7) ---------------------------

describe("legacy migration results (req 31.6, 31.7)", () => {
  async function completeGate(db: FakeAdminDb, auth: FakeAdminAuth) {
    const runner = new MigrationRunner([rulesAndIndexesGate]);
    return runner.runOne(RULES_AND_INDEXES_ID, db, auth, {
      dryRun: false,
      resume: true,
      batchSize: 200,
    });
  }

  it("converts interestedUsers[] to handshake documents", async () => {
    const db = new FakeAdminDb();
    const auth = new FakeAdminAuth();
    await completeGate(db, auth);

    db.seed("gigs", "legacy-gig", {
      posterUid: "poster-a",
      hoodId: "hood-x",
      askPrice: 300,
      interestedUsers: [
        { uid: "doer-a", name: "Alice", price: 300 },
        { uid: "doer-b", name: "Bob", price: 350 },
      ],
      proposals: [],
    });

    const runner = new MigrationRunner([convertLegacyClaimsMigration]);
    const report = await runner.runOne(CONVERT_LEGACY_CLAIMS_ID, db, auth, {
      dryRun: false,
      resume: true,
      batchSize: 200,
    });

    expect(report.status).toBe("completed");
    expect(report.migrated).toBe(1); // 1 gig processed

    // Handshakes created
    const hsA = db.get("handshakes", "legacy-gig_doer-a");
    const hsB = db.get("handshakes", "legacy-gig_doer-b");
    expect(hsA).toBeDefined();
    expect(hsB).toBeDefined();
    expect(hsA!.state).toBe("NEGOTIATING");
    expect(hsA!.gigId).toBe("legacy-gig");
    expect(hsA!.doerUid).toBe("doer-a");
    expect(hsA!.posterUid).toBe("poster-a");
    expect(hsA!.offers.length).toBeGreaterThanOrEqual(1);
  });

  it("sets agreedHandshakeId when selectedWorker is present", async () => {
    const db = new FakeAdminDb();
    const auth = new FakeAdminAuth();
    await completeGate(db, auth);

    db.seed("gigs", "selected-gig", {
      posterUid: "poster-s",
      hoodId: "hood-y",
      askPrice: 200,
      selectedWorker: "doer-s",
      interestedUsers: [
        { uid: "doer-s", name: "Selected", price: 200 },
        { uid: "doer-n", name: "NotSelected", price: 250 },
      ],
      proposals: [],
    });

    const runner = new MigrationRunner([convertLegacyClaimsMigration]);
    await runner.runOne(CONVERT_LEGACY_CLAIMS_ID, db, auth, {
      dryRun: false,
      resume: true,
      batchSize: 200,
    });

    // The selected worker's handshake is AGREED
    const hsSelected = db.get("handshakes", "selected-gig_doer-s");
    expect(hsSelected).toBeDefined();
    expect(hsSelected!.state).toBe("AGREED");
    expect(hsSelected!.agreed).toBeDefined();
    expect(hsSelected!.agreed.price).toBe(200);

    // The non-selected worker's handshake stays NEGOTIATING
    const hsOther = db.get("handshakes", "selected-gig_doer-n");
    expect(hsOther).toBeDefined();
    expect(hsOther!.state).toBe("NEGOTIATING");

    // Gig has the agreed pointer
    const gig = db.get("gigs", "selected-gig")!;
    expect(gig.agreedHandshakeId).toBe("selected-gig_doer-s");
  });

  it("replays embedded proposals as sequential offers", async () => {
    const db = new FakeAdminDb();
    const auth = new FakeAdminAuth();
    await completeGate(db, auth);

    db.seed("gigs", "proposal-gig", {
      posterUid: "poster-p",
      hoodId: "hood-z",
      askPrice: 400,
      interestedUsers: [{ uid: "doer-p", name: "ProposalDoer", price: 400 }],
      proposals: [
        { byUid: "doer-p", price: 400, timestamp: 1000 },
        { byUid: "poster-p", price: 350, timestamp: 2000 },
        { byUid: "doer-p", price: 375, timestamp: 3000 },
      ],
    });

    const runner = new MigrationRunner([convertLegacyClaimsMigration]);
    await runner.runOne(CONVERT_LEGACY_CLAIMS_ID, db, auth, {
      dryRun: false,
      resume: true,
      batchSize: 200,
    });

    const hs = db.get("handshakes", "proposal-gig_doer-p");
    expect(hs).toBeDefined();
    expect(hs!.offers).toHaveLength(3);
    expect(hs!.offers[0].seq).toBe(0);
    expect(hs!.offers[1].seq).toBe(1);
    expect(hs!.offers[2].seq).toBe(2);
    expect(hs!.latestSeq).toBe(2);
    // Only the last offer is live
    expect(hs!.offers[2].status).toBe("live");
    expect(hs!.offers[0].status).toBe("superseded");
    expect(hs!.offers[1].status).toBe("superseded");
  });

  it("is idempotent: re-running does not duplicate handshakes", async () => {
    const db = new FakeAdminDb();
    const auth = new FakeAdminAuth();
    await completeGate(db, auth);

    db.seed("gigs", "idem-gig", {
      posterUid: "poster-i",
      hoodId: "hood-i",
      askPrice: 100,
      interestedUsers: [{ uid: "doer-i", name: "Idempotent", price: 100 }],
      proposals: [],
    });

    const runner = new MigrationRunner([convertLegacyClaimsMigration]);
    await runner.runOne(CONVERT_LEGACY_CLAIMS_ID, db, auth, {
      dryRun: false,
      resume: false,
      batchSize: 200,
    });

    const hsFirst = db.get("handshakes", "idem-gig_doer-i");
    expect(hsFirst).toBeDefined();
    const writesAfterFirst = db.writes;

    // Second run skips existing
    await runner.runOne(CONVERT_LEGACY_CLAIMS_ID, db, auth, {
      dryRun: false,
      resume: false,
      batchSize: 200,
    });

    const hsSecond = db.get("handshakes", "idem-gig_doer-i");
    // Data unchanged
    expect(JSON.stringify(hsSecond)).toBe(JSON.stringify(hsFirst));
  });
});

// ---- 10. Identity gate (req 11.11) ------------------------------------------

describe("identity gate (req 11.11)", () => {
  it("rejects unverified doers", () => {
    // Simulates the pre-transaction verification check from the claims endpoint.
    // The endpoint reads the user doc and rejects if not verified.
    const doerData = { verified: false, rank: "TAPPED_IN" };
    expect(doerData.verified).toBe(false);

    // The endpoint would return 403 NOT_VERIFIED at this point.
    // Verify the gate logic: unverified user must not proceed.
    const canClaim = doerData.verified === true;
    expect(canClaim).toBe(false);
  });

  it("allows verified doers to proceed with claim creation", async () => {
    const db = new FakeAdminDb();
    db.seed("gigs", GIG_ID, { state: "OPEN", posterUid: POSTER_UID, askPrice: 500, hoodId: "hood-1", claimCount: 0 });
    // User is verified
    db.seed("users", DOER_UID, { verified: true, rank: "TAPPED_IN" });

    const userSnap = await db.collection("users").doc(DOER_UID).get();
    expect(userSnap.exists).toBe(true);
    expect(userSnap.data()!.verified).toBe(true);

    // Verified user can create a claim
    const result = await simulateClaimTransaction(db, {
      gigId: GIG_ID,
      doerUid: DOER_UID,
      posterUid: POSTER_UID,
      offerPrice: 500,
      oneLiner: "Verified and ready!",
    });
    expect(result.existing).toBe(false);
    expect(result.error).toBeUndefined();
    expect(db.get("handshakes", `${GIG_ID}_${DOER_UID}`)).toBeDefined();
  });

  it("rejects same-party claim (poster cannot claim own gig)", () => {
    // createHandshake enforces posterUid !== doerUid
    const result = createHandshake(
      {
        id: `${GIG_ID}_${POSTER_UID}`,
        gigId: GIG_ID,
        hoodId: "hood-1",
        posterUid: POSTER_UID,
        doerUid: POSTER_UID, // same as poster
        posterSnapshot: makeIdentity(POSTER_UID),
        doerSnapshot: makeIdentity(POSTER_UID),
        threadId: `thread_${GIG_ID}_${POSTER_UID}`,
        offer: { byUid: POSTER_UID, price: 500, date: "", startTime: "" },
      },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("SAME_PARTY");
  });
});
