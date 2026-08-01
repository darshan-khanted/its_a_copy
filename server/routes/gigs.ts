import express from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { getFirebaseAdminDb } from "../config/firebase";
import { geohashEncode, type GeoPoint } from "../services/geo";
import { isValidPincode } from "../services/hood";
import type { Gig, GigState } from "../../src/types/gig";
import type { PublicIdentity, RankId } from "../../src/types/user";

const router = express.Router();

// Mirrors `RANK_ORDER` in `src/features/rep/lib/unlocks.ts`. Duplicated (rather
// than imported) because that module resolves through the client-only `@/`
// alias, which the server's tsconfig/runtime does not configure.
const RANK_ORDER: readonly RankId[] = ["TAPPED_IN", "HUSTLER", "LEGEND", "MAX_CHARISMA", "MYTH"];

/** Photo attachment unlocks from rank 02 (HUSTLER) onward (design §D.5, requirement 10.10). */
function canAttachPhoto(rank: RankId): boolean {
  const idx = RANK_ORDER.indexOf(rank);
  return idx >= 1;
}

// ---- constants (design §E.2, requirement 10.9) ------------------------------

/** Urgent flares expire exactly 6 hours after publication (requirement 10.9). */
const URGENT_EXPIRY_MS = 6 * 60 * 60 * 1000;

/**
 * Non-urgent default expiry window. Not specified by requirements 10.1-10.11 —
 * this is a reasonable documented default (a flare stays listed for a week
 * unless the poster picks urgent) rather than a guessed production constant.
 */
const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** A poster-supplied non-urgent expiry may not exceed 30 days out. */
const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

const TITLE_MAX = 100;
const BODY_MAX = 500;
const TAGS_MAX = 5;
const TAG_MAX = 24;
const PRICE_MAX = 100_000; // mirrors the Handshake price bound (design §H.6)

const IDEMPOTENCY_KEY_RE = /^[a-zA-Z0-9_\-]{1,200}$/;

// ---- validation helpers ------------------------------------------------------

interface ValidationError {
  code: string;
  error: string;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidLocation(v: unknown): v is GeoPoint {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    isFiniteNumber(p.lat) &&
    isFiniteNumber(p.lng) &&
    Math.abs(p.lat as number) <= 90 &&
    Math.abs(p.lng as number) <= 180
  );
}

/** `"HH:MM"` → hour, `"FLEXIBLE"` → null. Anything else is invalid (returns undefined). */
function parseStartHour(startTime: string): number | null | undefined {
  if (startTime === "FLEXIBLE") return null;
  const m = /^([0-1]?\d|2[0-3]):[0-5]\d$/.exec(startTime);
  if (!m) return undefined;
  return Number(m[1]);
}

function validateBody(body: any): ValidationError | null {
  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    return { code: "TITLE_REQUIRED", error: "tell us what you actually need doing" };
  }
  if (body.title.trim().length > TITLE_MAX) {
    return { code: "TITLE_TOO_LONG", error: `keep the title under ${TITLE_MAX} characters` };
  }
  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return { code: "BODY_REQUIRED", error: "a couple of lines helps people say yes" };
  }
  if (body.body.trim().length > BODY_MAX) {
    return { code: "BODY_TOO_LONG", error: `keep the details under ${BODY_MAX} characters` };
  }
  if (!isFiniteNumber(body.askPrice) || body.askPrice <= 0) {
    return { code: "PRICE_ZERO", error: "put a real number — ₹0 is a favour, not a gig" };
  }
  if (body.askPrice > PRICE_MAX) {
    return { code: "PRICE_OUT_OF_RANGE", error: `keep it at or below ₹${PRICE_MAX.toLocaleString("en-IN")}` };
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((t: unknown) => typeof t !== "string")) {
      return { code: "TAGS_INVALID", error: "tags must be a list of short words" };
    }
    if (body.tags.length > TAGS_MAX || body.tags.some((t: string) => t.trim().length > TAG_MAX)) {
      return { code: "TAGS_INVALID", error: `at most ${TAGS_MAX} tags, ${TAG_MAX} characters each` };
    }
  }
  if (body.urgent !== undefined && typeof body.urgent !== "boolean") {
    return { code: "URGENT_INVALID", error: "urgent must be true or false" };
  }
  if (typeof body.hoodId !== "string" || !isValidPincode(body.hoodId)) {
    return { code: "HOOD_INVALID", error: "6 digits. the one on your courier packages" };
  }
  if (typeof body.startDate !== "string" || body.startDate.trim().length === 0) {
    return { code: "START_DATE_REQUIRED", error: "pick a date" };
  }
  if (typeof body.startTime !== "string" || parseStartHour(body.startTime) === undefined) {
    return { code: "START_TIME_INVALID", error: 'give a time like "18:00" or FLEXIBLE' };
  }
  if (!isValidLocation(body.location)) {
    return { code: "LOCATION_INVALID", error: "pin an actual spot on the map" };
  }
  if (body.expiresAt !== undefined && !isFiniteNumber(body.expiresAt)) {
    return { code: "EXPIRY_INVALID", error: "that expiry date does not compute" };
  }
  if (
    typeof body.idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_RE.test(body.idempotencyKey)
  ) {
    return { code: "IDEMPOTENCY_KEY_INVALID", error: "missing request key — refresh and try again" };
  }
  return null;
}

/**
 * Default fields for a poster snapshot when the user doc is missing or partial.
 * Optional fields are omitted entirely rather than set to `undefined` — the
 * underlying Firestore client SDK (wrapped by `getFirebaseAdminDb()`) rejects
 * `undefined` field values on write.
 */
function buildPosterSnapshot(uid: string, data: Record<string, any> | undefined): PublicIdentity {
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

/**
 * WHEN a poster marks a flare urgent THE App Shell SHALL expire the gig 6 hours
 * after publication (requirement 10.9). Otherwise honour a sane poster-supplied
 * expiry, clamped to [now, now + 30 days], defaulting to 7 days.
 */
function resolveExpiresAt(now: number, urgent: boolean, requested: number | undefined): number {
  if (urgent) return now + URGENT_EXPIRY_MS;
  if (typeof requested === "number" && requested > now && requested <= now + MAX_EXPIRY_MS) {
    return requested;
  }
  return now + DEFAULT_EXPIRY_MS;
}

/**
 * POST /api/gigs — authoritative, idempotent flare creation (requirements 10.1-10.11,
 * 18.4, 18.5, 18.9, 18.10).
 *
 * Idempotency: the client generates an idempotency key once per compose attempt
 * (e.g. `crypto.randomUUID()`) and resends it on retry. The key is scoped per-poster
 * (`idempotencyKeys/{uid}_{key}`) so one user's retry key can never resolve to
 * another user's gig. A retry with the same key returns the original gig unchanged
 * rather than creating a duplicate (requirement 10.12's create-side half; the
 * offline queue transport itself is Phase 5 / task 11.18).
 */
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.auth?.uid;
  if (!uid) {
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "sign in to flare" });
  }

  const validationError = validateBody(req.body ?? {});
  if (validationError) {
    return res.status(400).json({ success: false, ...validationError });
  }

  const db = getFirebaseAdminDb();
  const idempotencyDocId = `${uid}_${req.body.idempotencyKey}`;

  try {
    // Hood must exist and be live before a flare can be published in it
    // (requirement 8.10 — flaring is withheld in a non-live hood; the client's
    // useGatedAction already gates this, this is the server-authoritative half).
    const hoodSnap = await db.collection("hoods").doc(req.body.hoodId).get();
    if (!hoodSnap.exists) {
      return res.status(404).json({ success: false, code: "HOOD_NOT_FOUND", error: "we do not know this hood yet" });
    }
    const hood = hoodSnap.data() || {};
    if (hood.status !== "live") {
      return res.status(403).json({
        success: false,
        code: "HOOD_NOT_LIVE",
        error: "this hood is not live yet",
      });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const posterSnapshot = buildPosterSnapshot(uid, userSnap.exists ? userSnap.data() : undefined);

    const now = Date.now();
    const urgent = Boolean(req.body.urgent);
    const location: GeoPoint = req.body.location;
    const startHour = parseStartHour(req.body.startTime) ?? null;

    // Photo attachment is rank-gated (requirement 10.10, design §D.5). If a
    // photoUrl is present but the poster's rank does not include the unlock,
    // drop it server-side rather than failing the whole flare.
    const photoUrl =
      canAttachPhoto(posterSnapshot.rank) &&
      typeof req.body.photoUrl === "string" &&
      req.body.photoUrl.trim().length > 0
        ? req.body.photoUrl.trim()
        : undefined;

    const tags: string[] = Array.isArray(req.body.tags)
      ? req.body.tags.map((t: string) => t.trim()).filter(Boolean)
      : [];

    const gigData: Omit<Gig, "id"> = {
      title: req.body.title.trim(),
      body: req.body.body.trim(),
      askPrice: req.body.askPrice,
      tags,
      urgent,
      ...(photoUrl ? { photoUrl } : {}),

      hoodId: req.body.hoodId,
      areaLabel: hood.area ?? req.body.hoodId,
      // TODO(task 9.1): insert real coordinate fuzzing + private exact-location
      // subdoc here. For now the poster's raw pinned point is written directly
      // as the public geoFuzzed field, which is a known, temporary privacy gap
      // closed by task 9.1's server-side displacement + private/location subdoc.
      geoFuzzed: { lat: location.lat, lng: location.lng },
      geohash7: geohashEncode(location, 7),
      fuzzSeedVersion: 1,

      startDate: req.body.startDate,
      startTime: req.body.startTime,
      startHour,
      expiresAt: resolveExpiresAt(now, urgent, req.body.expiresAt),

      state: "OPEN" as GigState,
      agreedHandshakeId: null,
      claimCount: 0,
      posterUid: uid,
      posterSnapshot,

      // TODO(task 7.4): rank-gate-cap enforcement. The poster-set minimum-rank
      // control and the hood's 25% rank-gated cap (design §H.5.1) are not wired
      // yet, so every flare is published fully open rather than guessing a cap.
      minRank: null,
      visibleFrom: { legend: now, all: now },

      createdAt: now,
      schemaVersion: 2,
    };

    const result = await db.runTransaction(async (tx: any) => {
      const idemRef = db.collection("idempotencyKeys").doc(idempotencyDocId);
      const idemSnap = await tx.get(idemRef);
      if (idemSnap.exists) {
        return { existing: true, gigId: idemSnap.data().gigId as string };
      }
      const gigRef = db.collection("gigs").doc();
      tx.set(gigRef, gigData);
      tx.set(idemRef, { gigId: gigRef.id, posterUid: uid, createdAt: now });
      return { existing: false, gigId: gigRef.id };
    });

    if (result.existing) {
      const existingSnap = await db.collection("gigs").doc(result.gigId).get();
      if (!existingSnap.exists) {
        // The idempotency pointer outlived the gig somehow — fail closed rather
        // than fabricating a response.
        return res.status(500).json({ success: false, code: "GIG_LOOKUP_FAILED", error: "that flare vanished — try again" });
      }
      return res.json({ success: true, gig: { id: existingSnap.id, ...existingSnap.data() } });
    }

    return res.status(201).json({ success: true, gig: { id: result.gigId, ...gigData } });
  } catch (err: any) {
    console.error("[Gigs] create failed:", err?.message || err);
    return res.status(500).json({ success: false, code: "GIG_CREATE_FAILED", error: err?.message || "that did not go through — tap to try again" });
  }
});

export default router;
