import express from "express";
import { requireAuth, requireDeveloper, type AuthedRequest } from "../middleware/auth";
import { getFirebaseAdminDb } from "../config/firebase";
import { reduceHandshake, isTerminal } from "../../src/features/handshake/lib/reducer";
import type { Handshake, HandshakeState } from "../../src/types/handshake";
import type {
  HandshakeAction,
  TransitionError,
  Effect,
} from "../../src/features/handshake/lib/reducer";

const router = express.Router();

// ---- constants ---------------------------------------------------------------

/** Handshake states that are eligible for expiry processing. */
const EXPIRABLE_STATES: ReadonlySet<HandshakeState> = new Set(["NEGOTIATING", "AGREED"]);

/** Default stale threshold for expiry: 72 hours without activity. */
const EXPIRY_THRESHOLD_MS = 72 * 60 * 60 * 1000;

// ---- helpers -----------------------------------------------------------------

interface TransitionResponse {
  success: boolean;
  code?: string;
  error?: string;
  handshake?: Handshake & { id: string };
}

/**
 * Maps a reducer TransitionError to an HTTP status code. GIG_TAKEN and
 * ALREADY_ATTESTED are 409 (conflict), NOT_PARTICIPANT is 403, everything else
 * is 400.
 */
function statusForError(err: TransitionError): number {
  switch (err) {
    case "GIG_TAKEN":
      return 409;
    case "ALREADY_ATTESTED":
      return 409;
    case "NOT_PARTICIPANT":
      return 403;
    default:
      return 400;
  }
}

/**
 * Human-friendly error messages for reducer errors.
 */
function messageForError(err: TransitionError): string {
  switch (err) {
    case "ILLEGAL_STATE":
      return "that action is not allowed from the current state";
    case "NOT_PARTICIPANT":
      return "you are not a participant in this handshake";
    case "SELF_ACCEPT":
      return "you cannot accept your own offer";
    case "STALE_OFFER":
      return "you are looking at an outdated offer — refresh and try again";
    case "ALREADY_ATTESTED":
      return "you have already confirmed this";
    case "GIG_TAKEN":
      return "someone else was accepted first — this gig is no longer available";
    case "PRICE_OUT_OF_RANGE":
      return "that price is outside the allowed range";
    default:
      return "transition rejected";
  }
}

// ---- effect interpreter (runs inside the transaction) ------------------------

/**
 * Interprets effects produced by the reducer within the current Firestore
 * transaction. Only effects that require transactional atomicity are handled
 * here (CAS_GIG_AGREED, SET_GIG_STATE, DECLINE_OTHER_HANDSHAKES). The rest
 * (notifications, emails, rep grants, etc.) are fire-and-forget post-commit
 * concerns that will be wired in later phases.
 */
async function applyEffectsInTransaction(
  tx: any,
  db: any,
  effects: Effect[],
): Promise<{ error?: TransitionError }> {
  for (const effect of effects) {
    switch (effect.kind) {
      case "CAS_GIG_AGREED": {
        // Single-winner compare-and-set (requirements 12.8, 12.9, NFR-5.1).
        // Read the gig inside the transaction and ensure agreedHandshakeId is
        // still null. If another transaction already set it, abort with GIG_TAKEN.
        const gigRef = db.collection("gigs").doc(effect.gigId);
        const gigSnap = await tx.get(gigRef);
        if (!gigSnap.exists()) {
          return { error: "GIG_TAKEN" as TransitionError };
        }
        const gigData = gigSnap.data();
        if (gigData.agreedHandshakeId != null && gigData.agreedHandshakeId !== effect.handshakeId) {
          return { error: "GIG_TAKEN" as TransitionError };
        }
        // Set the pointer atomically
        tx.update(gigRef, { agreedHandshakeId: effect.handshakeId });
        break;
      }

      case "SET_GIG_STATE": {
        const gigRef = db.collection("gigs").doc(effect.gigId);
        tx.update(gigRef, { state: effect.state });
        break;
      }

      case "DECLINE_OTHER_HANDSHAKES": {
        // Query all handshakes for this gig that are not the winner and not
        // already terminal. The query happens outside the transaction (Firestore
        // transactions only support get-by-ref), but the writes are transactional.
        // This is safe because the CAS_GIG_AGREED above ensures only one winner.
        const allHandshakes = await db
          .collection("handshakes")
          .where("gigId", "==", effect.gigId)
          .get();
        const now = Date.now();
        for (const docSnap of allHandshakes.docs) {
          const data = docSnap.data();
          if (docSnap.id === effect.exceptHandshakeId) continue;
          if (isTerminal(data.state)) continue;
          const hsRef = db.collection("handshakes").doc(docSnap.id);
          tx.update(hsRef, { state: "DECLINED" as HandshakeState, updatedAt: now });
        }
        break;
      }

      case "RELEASE_GIG": {
        // On cancel: re-open the gig and clear the handshake pointer
        const gigRef = db.collection("gigs").doc(effect.gigId);
        tx.update(gigRef, { state: "OPEN", agreedHandshakeId: null });
        break;
      }

      // Effects that are not transactionally critical are no-ops here.
      // They will be processed asynchronously in later phases.
      case "NOTIFY":
      case "PUSH":
      case "EMAIL":
      case "TOUCH_THREAD":
      case "REVEAL_CONTACT":
      case "REVEAL_EXACT_LOCATION":
      case "MAYBE_MEETUP_NUDGE":
      case "GRANT_REP":
      case "OPEN_LOOP":
      case "SHOW_RECEIPT":
      case "RECORD_PAYMENT_ATTESTATION":
      case "OPEN_MODERATION_CASE":
      case "APPLY_MODERATOR_OUTCOME":
        break;
    }
  }
  return {};
}

// ---- POST /api/handshakes/:id/transition — generic transition endpoint --------

/**
 * POST /api/handshakes/:id/transition
 *
 * Server-authoritative handshake transition (requirements 12.8, 12.9, 12.11,
 * 12.12, 12.14, 12.15; NFR-5.1).
 *
 * Body: { action: HandshakeActionType, seq?: number, offer?: OfferInput,
 *         reason?: string, method?: 'upi' | 'cash' }
 *
 * The endpoint reads the handshake inside a Firestore transaction, constructs
 * the appropriate HandshakeAction, runs the pure reducer, and — if successful —
 * interprets effects atomically in the same transaction (including the
 * compare-and-set on gigs/{gigId}.agreedHandshakeId for ACCEPT).
 */
router.post("/:id/transition", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.auth?.uid;
  if (!uid) {
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "sign in first" });
  }

  const handshakeId = req.params.id;
  const { action: actionType, seq, offer, reason, method } = req.body ?? {};

  if (typeof actionType !== "string") {
    return res.status(400).json({ success: false, code: "ACTION_REQUIRED", error: "specify an action type" });
  }

  // RESOLVE is moderator-only (requirement 12.11 alternative path)
  if (actionType === "RESOLVE") {
    return res.status(403).json({
      success: false,
      code: "MODERATOR_ONLY",
      error: "only a moderator can resolve disputes",
    });
  }

  const db = getFirebaseAdminDb();

  try {
    const result = await db.runTransaction(async (tx: any) => {
      // 1. Read the handshake inside the transaction
      const hsRef = db.collection("handshakes").doc(handshakeId);
      const hsSnap = await tx.get(hsRef);
      if (!hsSnap.exists()) {
        return { notFound: true } as const;
      }
      const handshake: Handshake = { id: hsSnap.data().id ?? handshakeId, ...hsSnap.data() };

      // 2. Verify actor is a participant (except EXPIRE which is system-driven)
      if (actionType !== "EXPIRE") {
        if (uid !== handshake.posterUid && uid !== handshake.doerUid) {
          return { rejected: true, error: "NOT_PARTICIPANT" as TransitionError } as const;
        }
      }

      // 3. Pre-transaction CAS check for ACCEPT: read the gig to see if it is
      //    already taken BEFORE running the reducer. This provides an early
      //    rejection for races without wasting reducer computation.
      if (actionType === "ACCEPT") {
        const gigRef = db.collection("gigs").doc(handshake.gigId);
        const gigSnap = await tx.get(gigRef);
        if (gigSnap.exists()) {
          const gigData = gigSnap.data();
          if (gigData.agreedHandshakeId != null && gigData.agreedHandshakeId !== handshakeId) {
            return { rejected: true, error: "GIG_TAKEN" as TransitionError } as const;
          }
        }
      }

      // 4. Construct the action for the reducer
      const handshakeAction = buildAction(actionType, uid, { seq, offer, reason, method });
      if (!handshakeAction) {
        return { rejected: true, error: "ILLEGAL_STATE" as TransitionError } as const;
      }

      // 5. Run the pure reducer
      const now = Date.now();
      const transitionResult = reduceHandshake(handshake, handshakeAction, now);

      if (!transitionResult.ok) {
        return { rejected: true, error: transitionResult.error } as const;
      }

      // 6. Apply transactional effects (CAS, state changes, declines)
      const effectResult = await applyEffectsInTransaction(tx, db, transitionResult.effects);
      if (effectResult.error) {
        return { rejected: true, error: effectResult.error } as const;
      }

      // 7. Write the updated handshake
      const nextHandshake = transitionResult.next;
      tx.set(hsRef, nextHandshake);

      return { success: true, handshake: nextHandshake } as const;
    });

    if ("notFound" in result && result.notFound) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", error: "handshake not found" });
    }

    if ("rejected" in result && result.rejected) {
      const err = result.error as TransitionError;
      return res.status(statusForError(err)).json({
        success: false,
        code: err,
        error: messageForError(err),
      });
    }

    return res.json({
      success: true,
      handshake: result.handshake,
    });
  } catch (err: any) {
    console.error("[Handshakes] transition failed:", err?.message || err);
    return res.status(500).json({
      success: false,
      code: "TRANSITION_FAILED",
      error: err?.message || "transition did not go through — try again",
    });
  }
});

// ---- POST /api/handshakes/:id/resolve — moderator-only dispute resolution ----

/**
 * POST /api/handshakes/:id/resolve
 *
 * Moderator-only dispute resolution (requirement 12.11 alternative path).
 * Gated behind requireDeveloper which ensures only the verified developer
 * email can call this endpoint.
 *
 * Body: { outcome: 'settle' | 'void' }
 */
router.post("/:id/resolve", requireAuth, requireDeveloper, async (req: AuthedRequest, res) => {
  const uid = req.auth?.uid;
  if (!uid) {
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "sign in first" });
  }

  const handshakeId = req.params.id;
  const { outcome } = req.body ?? {};

  if (outcome !== "settle" && outcome !== "void") {
    return res.status(400).json({
      success: false,
      code: "OUTCOME_REQUIRED",
      error: "specify outcome as 'settle' or 'void'",
    });
  }

  const db = getFirebaseAdminDb();

  try {
    const result = await db.runTransaction(async (tx: any) => {
      const hsRef = db.collection("handshakes").doc(handshakeId);
      const hsSnap = await tx.get(hsRef);
      if (!hsSnap.exists()) {
        return { notFound: true } as const;
      }
      const handshake: Handshake = { id: hsSnap.data().id ?? handshakeId, ...hsSnap.data() };

      const action: HandshakeAction = { type: "RESOLVE", byModerator: uid, outcome };
      const now = Date.now();
      const transitionResult = reduceHandshake(handshake, action, now);

      if (!transitionResult.ok) {
        return { rejected: true, error: transitionResult.error } as const;
      }

      // Apply effects
      const effectResult = await applyEffectsInTransaction(tx, db, transitionResult.effects);
      if (effectResult.error) {
        return { rejected: true, error: effectResult.error } as const;
      }

      const nextHandshake = transitionResult.next;
      tx.set(hsRef, nextHandshake);

      return { success: true, handshake: nextHandshake } as const;
    });

    if ("notFound" in result && result.notFound) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", error: "handshake not found" });
    }

    if ("rejected" in result && result.rejected) {
      const err = result.error as TransitionError;
      return res.status(statusForError(err)).json({
        success: false,
        code: err,
        error: messageForError(err),
      });
    }

    return res.json({ success: true, handshake: result.handshake });
  } catch (err: any) {
    console.error("[Handshakes] resolve failed:", err?.message || err);
    return res.status(500).json({
      success: false,
      code: "RESOLVE_FAILED",
      error: err?.message || "resolution did not go through",
    });
  }
});

// ---- POST /api/handshakes/expire — batch expiry processing -------------------

/**
 * POST /api/handshakes/expire
 *
 * Batch expiry processing. Finds handshakes in NEGOTIATING or AGREED states
 * that have not been updated within the threshold window and transitions them
 * to EXPIRED. Intended to be called by a cron trigger.
 *
 * Body (optional): { thresholdMs?: number }
 * Auth: requireAuth (any authenticated user can trigger for now; in production
 * this would be gated behind a cron secret or requireDeveloper).
 */
router.post("/expire", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.auth?.uid;
  if (!uid) {
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "sign in first" });
  }

  const thresholdMs: number =
    typeof req.body?.thresholdMs === "number" && req.body.thresholdMs > 0
      ? req.body.thresholdMs
      : EXPIRY_THRESHOLD_MS;

  const db = getFirebaseAdminDb();
  const now = Date.now();
  const cutoff = now - thresholdMs;

  try {
    // Find stale NEGOTIATING handshakes
    const negotiatingSnap = await db
      .collection("handshakes")
      .where("state", "==", "NEGOTIATING")
      .get();

    const agreedSnap = await db
      .collection("handshakes")
      .where("state", "==", "AGREED")
      .get();

    const allDocs = [...negotiatingSnap.docs, ...agreedSnap.docs];
    const stale = allDocs.filter((d: any) => {
      const data = d.data();
      return data.updatedAt < cutoff;
    });

    let expired = 0;
    let failed = 0;

    for (const docSnap of stale) {
      try {
        await db.runTransaction(async (tx: any) => {
          const hsRef = db.collection("handshakes").doc(docSnap.id);
          const hsLiveSnap = await tx.get(hsRef);
          if (!hsLiveSnap.exists()) return;
          const handshake: Handshake = { id: docSnap.id, ...hsLiveSnap.data() };

          // Only expire if still in an expirable state (might have changed)
          if (!EXPIRABLE_STATES.has(handshake.state)) return;
          if (handshake.updatedAt >= cutoff) return;

          const action: HandshakeAction = { type: "EXPIRE" };
          const result = reduceHandshake(handshake, action, now);
          if (!result.ok) return;

          tx.set(hsRef, result.next);
        });
        expired++;
      } catch {
        failed++;
      }
    }

    return res.json({
      success: true,
      expired,
      failed,
      checked: stale.length,
    });
  } catch (err: any) {
    console.error("[Handshakes] expire failed:", err?.message || err);
    return res.status(500).json({
      success: false,
      code: "EXPIRE_FAILED",
      error: err?.message || "expiry processing failed",
    });
  }
});

// ---- action builder ----------------------------------------------------------

/**
 * Constructs a typed HandshakeAction from the request body fields. Returns null
 * if the action type is unrecognized or missing required fields.
 */
function buildAction(
  actionType: string,
  byUid: string,
  params: { seq?: number; offer?: any; reason?: string; method?: string },
): HandshakeAction | null {
  switch (actionType) {
    case "COUNTER":
      if (!params.offer || typeof params.offer.price !== "number") return null;
      return {
        type: "COUNTER",
        byUid,
        offer: {
          price: params.offer.price,
          date: params.offer.date ?? "",
          startTime: params.offer.startTime ?? "",
          ...(params.offer.endTime ? { endTime: params.offer.endTime } : {}),
          ...(params.offer.note ? { note: params.offer.note } : {}),
        },
      };

    case "ACCEPT":
      if (typeof params.seq !== "number") return null;
      return { type: "ACCEPT", byUid, seq: params.seq };

    case "DECLINE":
      return { type: "DECLINE", byUid };

    case "WITHDRAW":
      return { type: "WITHDRAW", byUid };

    case "EXPIRE":
      return { type: "EXPIRE" };

    case "START":
      return { type: "START", byUid };

    case "CANCEL":
      return { type: "CANCEL", byUid };

    case "ATTEST_DONE":
      return { type: "ATTEST_DONE", byUid };

    case "ATTEST_PAID":
      if (params.method !== "upi" && params.method !== "cash") return null;
      return { type: "ATTEST_PAID", byUid, method: params.method };

    case "DISPUTE":
      if (typeof params.reason !== "string" || params.reason.trim().length === 0) return null;
      return { type: "DISPUTE", byUid, reason: params.reason };

    default:
      return null;
  }
}

export default router;
