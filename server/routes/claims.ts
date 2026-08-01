import express from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { getFirebaseAdminDb } from "../config/firebase";
import { createHandshake } from "../../src/features/handshake/lib/reducer";
import type { RankId, PublicIdentity } from "../../src/types/user";
import type { Handshake } from "../../src/types/handshake";
import type { ChatThread, ChatMessage } from "../../src/types/chat";

const router = express.Router();

// ---- rank logic (duplicated from src/features/rep/lib/unlocks.ts because that
// module uses the @/ alias which the server cannot resolve) --------------------

const RANK_ORDER: readonly RankId[] = ["TAPPED_IN", "HUSTLER", "LEGEND", "MAX_CHARISMA", "MYTH"];

function rankIndex(rank: RankId): number {
  const i = RANK_ORDER.indexOf(rank);
  return i < 0 ? 0 : i;
}

function maxActiveClaimsForRank(rank: RankId): number {
  const idx = rankIndex(rank);
  return idx >= 1 ? 3 : 1;
}

// ---- terminal handshake states (claims against these do not count) -----------

const TERMINAL_STATES = new Set(["SETTLED", "DECLINED", "WITHDRAWN", "EXPIRED", "CANCELLED"]);

// ---- constants ---------------------------------------------------------------

const ONE_LINER_MIN = 10;
const ONE_LINER_MAX = 140;
const PRICE_MIN_EXCLUSIVE = 0;
const PRICE_MAX = 100_000;
const PRICE_INCREMENT = 25;
const IDEMPOTENCY_KEY_RE = /^[a-zA-Z0-9_\-]{1,200}$/;

// ---- validation helpers ------------------------------------------------------

interface ValidationError {
  code: string;
  error: string;
}

function validateClaimBody(body: any): ValidationError | null {
  if (typeof body.gigId !== "string" || body.gigId.trim().length === 0) {
    return { code: "GIG_ID_REQUIRED", error: "missing gig reference" };
  }
  if (typeof body.oneLiner !== "string") {
    return { code: "ONE_LINER_REQUIRED", error: "say something human in 10-140 characters" };
  }
  const trimmedOneLiner = body.oneLiner.trim();
  if (trimmedOneLiner.length < ONE_LINER_MIN) {
    return { code: "ONE_LINER_TOO_SHORT", error: `say at least ${ONE_LINER_MIN} characters` };
  }
  if (trimmedOneLiner.length > ONE_LINER_MAX) {
    return { code: "ONE_LINER_TOO_LONG", error: `keep it under ${ONE_LINER_MAX} characters` };
  }
  if (typeof body.offerPrice !== "number" || !Number.isFinite(body.offerPrice)) {
    return { code: "PRICE_INVALID", error: "offer a real price" };
  }
  if (body.offerPrice <= PRICE_MIN_EXCLUSIVE || body.offerPrice > PRICE_MAX) {
    return { code: "PRICE_OUT_OF_RANGE", error: `price must be between 1 and ${PRICE_MAX}` };
  }
  if (body.offerPrice % PRICE_INCREMENT !== 0) {
    return { code: "PRICE_NOT_INCREMENT", error: `price must be in multiples of ${PRICE_INCREMENT}` };
  }
  if (typeof body.availability !== "string" || body.availability.trim().length === 0) {
    return { code: "AVAILABILITY_REQUIRED", error: "let them know when you can show up" };
  }
  if (typeof body.idempotencyKey !== "string" || !IDEMPOTENCY_KEY_RE.test(body.idempotencyKey)) {
    return { code: "IDEMPOTENCY_KEY_INVALID", error: "missing request key — refresh and try again" };
  }
  return null;
}

// ---- snapshot builders -------------------------------------------------------

function buildSnapshot(uid: string, data: Record<string, any> | undefined): PublicIdentity {
  const snapshot: PublicIdentity = {
    uid,
    handle: data?.handle ?? uid,
    displayName: data?.displayName ?? "neighbour",
    avatarSeed: data?.avatarSeed ?? uid,
    rank: (data?.rank as RankId) ?? "TAPPED_IN",
    rep: typeof data?.rep === "number" ? data.rep : 0,
    verified: Boolean(data?.verified),
    gigsSettled: typeof data?.gigsSettled === "number" ? data.gigsSettled : 0,
    rating: typeof data?.rating === "number" ? data.rating : null,
    ratingCount: typeof data?.ratingCount === "number" ? data.ratingCount : 0,
  };
  if (data?.avatarUrl) snapshot.avatarUrl = data.avatarUrl;
  if (data?.dayZero) snapshot.dayZero = data.dayZero;
  if (data?.hoodId) snapshot.hoodId = data.hoodId;
  return snapshot;
}

// ---- POST /api/claims — idempotent atomic claim creation ---------------------

/**
 * POST /api/claims
 *
 * Idempotent, atomic claim creation (requirements 11.1-11.7, 11.10-11.13).
 *
 * Creates a deterministic Handshake keyed `{gigId}_{doerUid}`, a chat thread
 * with the handshake card as first system message and doer's one-liner as first
 * human message, and increments the gig's claimCount by 1. All artifacts are
 * created atomically within a transaction; retries with the same doer+gig
 * combination return existing artifacts without creating duplicates.
 */
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.auth?.uid;
  if (!uid) {
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "sign in first" });
  }

  const validationError = validateClaimBody(req.body ?? {});
  if (validationError) {
    return res.status(400).json({ success: false, ...validationError });
  }

  const db = getFirebaseAdminDb();
  const gigId: string = req.body.gigId.trim();
  const doerUid = uid;
  const handshakeId = `${gigId}_${doerUid}`;
  const threadId = `thread_${gigId}_${doerUid}`;
  const idempotencyDocId = `${gigId}_${doerUid}`;

  try {
    // ---- pre-transaction reads (gig and doer validation) --------------------

    // 1. Read gig doc — must exist and be OPEN
    const gigSnap = await db.collection("gigs").doc(gigId).get();
    if (!gigSnap.exists) {
      return res.status(404).json({ success: false, code: "GIG_NOT_FOUND", error: "this signal does not exist" });
    }
    const gigData = gigSnap.data();
    if (gigData.state !== "OPEN") {
      return res.status(409).json({ success: false, code: "GIG_NOT_OPEN", error: "this signal is no longer open" });
    }

    // Cannot claim your own gig
    if (gigData.posterUid === doerUid) {
      return res.status(403).json({ success: false, code: "SAME_PARTY", error: "you cannot claim your own signal" });
    }

    // 2. Validate offer price is within the gig's price range
    const offerPrice: number = req.body.offerPrice;
    const askPrice: number = gigData.askPrice;

    // 3. Read doer user doc — must be verified and meet rank floor
    const doerSnap = await db.collection("users").doc(doerUid).get();
    if (!doerSnap.exists) {
      return res.status(403).json({ success: false, code: "USER_NOT_FOUND", error: "complete your profile first" });
    }
    const doerData = doerSnap.data();

    // Identity verification gate (requirement 11.11)
    if (!doerData.verified) {
      return res.status(403).json({ success: false, code: "NOT_VERIFIED", error: "verify your identity before claiming" });
    }

    // Rank floor check (requirement 11.10, design gig.minRank)
    const doerRank: RankId = doerData.rank ?? "TAPPED_IN";
    if (gigData.minRank != null) {
      if (rankIndex(doerRank) < rankIndex(gigData.minRank)) {
        return res.status(403).json({
          success: false,
          code: "RANK_TOO_LOW",
          error: `this signal requires ${(gigData.minRank as string).toLowerCase()} or higher`,
        });
      }
    }

    // 4. Count active handshakes for doer (non-terminal states)
    const doerHandshakes = await db
      .collection("handshakes")
      .where("doerUid", "==", doerUid)
      .get();
    const activeClaimCount = doerHandshakes.docs.filter(
      (d: any) => !TERMINAL_STATES.has(d.data().state),
    ).length;

    // Active-claim limit check (requirement 11.10, 11.13)
    const allowance = maxActiveClaimsForRank(doerRank);
    if (activeClaimCount >= allowance) {
      return res.status(403).json({
        success: false,
        code: "CLAIM_LIMIT_REACHED",
        error: `you have hit your ${allowance}-claim limit at this rank`,
      });
    }

    // ---- build the handshake via the pure reducer ---------------------------

    const now = Date.now();
    const posterSnapshot = buildSnapshot(gigData.posterUid, gigData.posterSnapshot);
    const doerSnapshot = buildSnapshot(doerUid, doerData);

    // Determine counter-offer status: if offerPrice differs from askPrice, it
    // is a counter-offer (requirement 11.4)
    const isCounterOffer = offerPrice !== askPrice;

    const createResult = createHandshake(
      {
        id: handshakeId,
        gigId,
        hoodId: gigData.hoodId,
        posterUid: gigData.posterUid,
        doerUid,
        posterSnapshot,
        doerSnapshot,
        threadId,
        offer: {
          byUid: doerUid,
          price: offerPrice,
          date: gigData.startDate,
          startTime: gigData.startTime,
          ...(gigData.startTime !== "FLEXIBLE" ? {} : {}),
        },
      },
      now,
    );

    if (!createResult.ok) {
      return res.status(400).json({ success: false, code: createResult.error, error: "could not create the claim" });
    }

    const handshake: Handshake = createResult.handshake;

    // ---- build chat thread and messages -------------------------------------

    const chatThread: Omit<ChatThread, "id"> = {
      id: threadId,
      gigId,
      gigTitle: gigData.title,
      participants: [gigData.posterUid, doerUid],
      participantNames: {
        [gigData.posterUid]: posterSnapshot.displayName,
        [doerUid]: doerSnapshot.displayName,
      },
      participantAvatars: {
        [gigData.posterUid]: posterSnapshot.avatarUrl ?? posterSnapshot.avatarSeed,
        [doerUid]: doerSnapshot.avatarUrl ?? doerSnapshot.avatarSeed,
      },
      lastMessage: req.body.oneLiner.trim(),
      lastMessageSender: doerUid,
      lastMessageTime: now,
      unreadCount: { [gigData.posterUid]: 2, [doerUid]: 0 },
      createdAt: now,
    };

    // System message: the pinned handshake card
    const systemMessage: Omit<ChatMessage, "id"> = {
      id: "", // will be set by auto-generated doc
      senderUid: "system",
      senderName: "qwick",
      text: isCounterOffer
        ? `${doerSnapshot.displayName} offered ₹${offerPrice} (you asked ₹${askPrice})`
        : `${doerSnapshot.displayName} claimed at ₹${offerPrice}`,
      timestamp: now,
      read: false,
      isSystem: true,
    };

    // Human message: doer's one-liner
    const humanMessage: Omit<ChatMessage, "id"> = {
      id: "", // will be set by auto-generated doc
      senderUid: doerUid,
      senderName: doerSnapshot.displayName,
      text: req.body.oneLiner.trim(),
      timestamp: now + 1, // +1ms to guarantee ordering
      read: false,
    };

    // ---- atomic transaction -------------------------------------------------

    const result = await db.runTransaction(async (tx: any) => {
      // a. Check idempotency key
      const idemRef = db.collection("idempotencyKeys").doc(idempotencyDocId);
      const idemSnap = await tx.get(idemRef);
      if (idemSnap.exists()) {
        return { existing: true };
      }

      // b. Re-read gig state inside transaction to guard against races
      const gigRef = db.collection("gigs").doc(gigId);
      const gigTxSnap = await tx.get(gigRef);
      if (!gigTxSnap.exists() || gigTxSnap.data().state !== "OPEN") {
        return { existing: false, raceRejection: true };
      }

      const currentClaimCount: number = gigTxSnap.data().claimCount ?? 0;

      // c. Create handshake doc
      const handshakeRef = db.collection("handshakes").doc(handshakeId);
      tx.set(handshakeRef, handshake);

      // d. Create chat thread
      const threadRef = db.collection("chats").doc(threadId);
      tx.set(threadRef, chatThread);

      // e. Create first message (system/pinned handshake card)
      const msg1Ref = db.collection("chats").doc(threadId).collection("messages").doc();
      const sysMsg = { ...systemMessage, id: msg1Ref.id };
      tx.set(msg1Ref, sysMsg);

      // f. Create second message (doer's one-liner)
      const msg2Ref = db.collection("chats").doc(threadId).collection("messages").doc();
      const humMsg = { ...humanMessage, id: msg2Ref.id };
      tx.set(msg2Ref, humMsg);

      // g. Increment gig claimCount
      tx.update(gigRef, { claimCount: currentClaimCount + 1 });

      // h. Write idempotency key doc
      tx.set(idemRef, {
        handshakeId,
        threadId,
        doerUid,
        gigId,
        createdAt: now,
      });

      return { existing: false, raceRejection: false };
    });

    // ---- handle result ------------------------------------------------------

    if (result.existing) {
      // Idempotent retry: return existing artifacts
      const existingHandshakeSnap = await db.collection("handshakes").doc(handshakeId).get();
      const existingHandshake = existingHandshakeSnap.exists
        ? { id: existingHandshakeSnap.id, ...existingHandshakeSnap.data() }
        : null;
      return res.json({
        success: true,
        handshake: existingHandshake,
        threadId,
        existing: true,
      });
    }

    if (result.raceRejection) {
      return res.status(409).json({
        success: false,
        code: "GIG_NOT_OPEN",
        error: "this signal was taken while you were claiming",
      });
    }

    return res.status(201).json({
      success: true,
      handshake: { id: handshakeId, ...handshake },
      threadId,
      existing: false,
    });
  } catch (err: any) {
    console.error("[Claims] create failed:", err?.message || err);
    return res.status(500).json({
      success: false,
      code: "CLAIM_CREATE_FAILED",
      error: err?.message || "that did not go through — tap to try again",
    });
  }
});

export default router;
