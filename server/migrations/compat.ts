import { hashEmail } from "./util";

/**
 * Schema-versioned compatibility layer (design §G.4/§G.8, requirement 31.9).
 *
 * The renamed gig fields (`price -> askPrice`, `description -> body`) are migrated
 * with a *dual-read* window: for one release the code reads whichever field is
 * present, preferring the new v2 field but transparently falling back to the legacy
 * v1 field. This lets the backfill migration and the running application coexist
 * while old documents are being upgraded, and lets rollout happen without a hard
 * cut-over.
 */

/** Current on-disk schema version for the public `Gig` document (design §G.4). */
export const GIG_SCHEMA_VERSION = 2;

/** Current on-disk schema version for the `User` document (design §G.4). */
export const USER_SCHEMA_VERSION = 2;

/** The subset of gig fields affected by the v1 -> v2 rename. */
export interface DualReadGigFields {
  // v2 (new) names
  askPrice?: number;
  body?: string;
  // v1 (legacy) names retained read-only for one release
  price?: number;
  description?: string;
  schemaVersion?: number;
}

/** Resolves the numeric ask price from either schema version (v2 wins, v1 is fallback). */
export function readGigAskPrice(gig: DualReadGigFields): number {
  if (typeof gig.askPrice === "number") return gig.askPrice;
  if (typeof gig.price === "number") return gig.price;
  return 0;
}

/** Resolves the gig body/description from either schema version (v2 wins, v1 is fallback). */
export function readGigBody(gig: DualReadGigFields): string {
  if (typeof gig.body === "string") return gig.body;
  if (typeof gig.description === "string") return gig.description;
  return "";
}

/**
 * Returns a normalised, dual-read view of a gig with the v2 fields guaranteed to be
 * populated regardless of which schema version produced the underlying document.
 * Callers in the running app should read through this rather than touching the raw
 * fields during the migration window.
 */
export function normalizeGigForRead<T extends DualReadGigFields>(
  gig: T,
): T & { askPrice: number; body: string; schemaVersion: number } {
  return {
    ...gig,
    askPrice: readGigAskPrice(gig),
    body: readGigBody(gig),
    schemaVersion: gig.schemaVersion ?? 1,
  };
}

/**
 * Computes the v2 backfill patch for a legacy gig, or `null` when the gig is already
 * at the current schema version with both renamed fields present. Legacy `price`/
 * `description` are intentionally *retained* (not deleted) so the dual-read window
 * stays valid for one release (requirement 31.9). This function is pure, which makes
 * the backfill migration idempotent and easy to unit/property test.
 */
export function computeGigBackfill(
  gig: DualReadGigFields,
): { askPrice: number; body: string; schemaVersion: number } | null {
  const alreadyCurrent =
    gig.schemaVersion === GIG_SCHEMA_VERSION &&
    typeof gig.askPrice === "number" &&
    typeof gig.body === "string";
  if (alreadyCurrent) return null;

  return {
    askPrice: readGigAskPrice(gig),
    body: readGigBody(gig),
    schemaVersion: GIG_SCHEMA_VERSION,
  };
}

/** The lookup document written to `emailIndex/{emailHash}` (design §G.5/§G.8). */
export interface EmailIndexEntry {
  uid: string;
  createdAt: number;
}

/** Builds the deterministic `emailIndex` key + payload for an email/uid pair. */
export function buildEmailIndexEntry(
  email: string,
  uid: string,
  now: number,
): { key: string; entry: EmailIndexEntry } {
  return {
    key: hashEmail(email),
    entry: { uid, createdAt: now },
  };
}
