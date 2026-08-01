// The server-authoritative Hood service (design §C.7, §G.7).
//
// Responsibilities (Task 3.6):
//   - validate six-digit pincodes (`^[1-9][0-9]{5}$`)
//   - resolve a pincode against the postal API, a static fallback table, or a
//     manually entered area name
//   - cache every resolution in `hoods/{pincode}` so the second neighbour in a
//     hood never hits the third-party API
//   - compute the adjacency list from centroid distances (<= 3 km, capped at 9)
//   - own the hood launch switch (`status`)
//   - expose recomputed hood statistics (price guidance, hour histogram, counts)
//
// All Firestore access goes through the Admin-shaped `getFirebaseAdminDb()` handle
// (server/trust boundary) — clients never write hood documents.

import { getFirebaseAdminDb } from "../config/firebase";
import {
  ADJACENCY_CAP,
  ADJACENCY_MAX_M,
  computeAdjacency,
  type GeoPoint,
  type HoodCentroid,
} from "./geo";

// ---- types (kept in sync with src/types/hood.ts) ----------------------------

export type HoodStatus = "waitlist" | "live" | "paused";
export type HoodSource = "api" | "fallback" | "manual";

export interface PriceBand {
  p25: number;
  p50: number;
  p75: number;
  n: number;
}

export interface Hood {
  pincode: string;
  area: string;
  city: string;
  state: string;
  centroid: GeoPoint;
  adjacent: string[];
  status: HoodStatus;
  waitlistCount: number;
  activeMembers30d: number;
  gigCount: number;
  priceStats: Record<string, PriceBand>;
  hourHistogram: number[];
  resolvedAt: number;
  source: HoodSource;
}

export const PINCODE_RE = /^[1-9][0-9]{5}$/;

export function isValidPincode(pincode: string): boolean {
  return PINCODE_RE.test(pincode);
}

// ---- centroid resolution ----------------------------------------------------
//
// The postal API returns a district/state but no coordinates, so we resolve a
// usable centroid from a curated table keyed by district/city name, falling back
// to a state centroid and finally a national default. This keeps the Field anchor
// stable without requesting any location permission (design §C.2).

const CITY_CENTROIDS: Record<string, GeoPoint> = {
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  "mumbai suburban": { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  "new delhi": { lat: 28.6139, lng: 77.209 },
  "south delhi": { lat: 28.5244, lng: 77.2066 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  kochi: { lat: 9.9312, lng: 76.2673 },
};

const STATE_CENTROIDS: Record<string, GeoPoint> = {
  karnataka: { lat: 12.9716, lng: 77.5946 },
  maharashtra: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  "tamil nadu": { lat: 13.0827, lng: 80.2707 },
  "west bengal": { lat: 22.5726, lng: 88.3639 },
  telangana: { lat: 17.385, lng: 78.4867 },
};

const NATIONAL_DEFAULT: GeoPoint = { lat: 28.6139, lng: 77.209 };

function resolveCentroid(city: string, state: string): GeoPoint {
  const c = CITY_CENTROIDS[city.toLowerCase().trim()];
  if (c) return c;
  const s = STATE_CENTROIDS[state.toLowerCase().trim()];
  if (s) return s;
  return NATIONAL_DEFAULT;
}

// ---- static fallback table (design §C.7) ------------------------------------

interface FallbackEntry {
  area: string;
  city: string;
  state: string;
  centroid: GeoPoint;
}

const FALLBACK_HOODS: Record<string, FallbackEntry> = {
  "560102": { area: "HSR Layout", city: "Bengaluru", state: "Karnataka", centroid: { lat: 12.9121, lng: 77.6446 } },
  "400076": { area: "Powai", city: "Mumbai", state: "Maharashtra", centroid: { lat: 19.1176, lng: 72.906 } },
  "411001": { area: "Pune City", city: "Pune", state: "Maharashtra", centroid: { lat: 18.5196, lng: 73.8553 } },
  "110016": { area: "Hauz Khas", city: "New Delhi", state: "Delhi", centroid: { lat: 28.5494, lng: 77.2001 } },
  "600040": { area: "Anna Nagar", city: "Chennai", state: "Tamil Nadu", centroid: { lat: 13.085, lng: 80.2101 } },
};

// ---- post-office name cleanup (ported from the prototype, design §C.7) ------

interface PostOffice {
  Name?: string;
  District?: string;
  State?: string;
  Block?: string;
  [key: string]: unknown;
}

/** Tidy a post-office name into a display area label. */
export function tidy(name: string): string {
  return (name || "")
    .replace(/\s*\(.*?\)\s*/g, " ") // drop parenthetical suffixes
    .replace(/\s*(S\.?O|B\.?O|H\.?O|G\.?P\.?O)\.?$/i, "") // drop office-type suffixes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick the most usable post-office name from the API list: prefer named offices
 * (skip anything with parentheses or "NA") whose tidied name is longer than three
 * characters; otherwise fall back to the first entry.
 */
export function pickPostOffice(offices: readonly PostOffice[]): PostOffice | null {
  if (!offices || offices.length === 0) return null;
  const usable = offices.find((po) => {
    const raw = po.Name || "";
    if (!raw || /\(|\)|NA/i.test(raw)) return false;
    return tidy(raw).length > 3;
  });
  return usable ?? offices[0];
}

// ---- external resolution ----------------------------------------------------

const POSTAL_API = "https://api.postalpincode.in/pincode";

interface ResolvedPlace {
  area: string;
  city: string;
  state: string;
  centroid: GeoPoint;
  source: HoodSource;
}

async function resolveFromApi(pincode: string): Promise<ResolvedPlace | null> {
  if (typeof fetch !== "function") return null;
  try {
    const res = await fetch(`${POSTAL_API}/${pincode}`);
    if (!res.ok) return null;
    const payload = (await res.json()) as Array<{ Status?: string; PostOffice?: PostOffice[] }>;
    const first = Array.isArray(payload) ? payload[0] : undefined;
    if (!first || first.Status !== "Success" || !first.PostOffice?.length) return null;

    const po = pickPostOffice(first.PostOffice);
    if (!po) return null;

    const city = tidy(po.District || "") || tidy(po.Block || "") || "";
    const state = (po.State || "").trim();
    const area = tidy(po.Name || "") || city || pincode;
    return { area, city: city || area, state, centroid: resolveCentroid(city, state), source: "api" };
  } catch {
    return null;
  }
}

function resolveFromFallback(pincode: string): ResolvedPlace | null {
  const entry = FALLBACK_HOODS[pincode];
  if (!entry) return null;
  return { ...entry, source: "fallback" };
}

// ---- persistence + adjacency ------------------------------------------------

function newHoodDefaults(): Pick<
  Hood,
  "status" | "waitlistCount" | "activeMembers30d" | "gigCount" | "priceStats" | "hourHistogram"
> {
  return {
    status: "waitlist",
    waitlistCount: 0,
    activeMembers30d: 0,
    gigCount: 0,
    priceStats: {},
    hourHistogram: new Array(24).fill(0),
  };
}

async function loadHoodCentroids(): Promise<HoodCentroid[]> {
  const snap = await getFirebaseAdminDb().collection("hoods").get();
  const out: HoodCentroid[] = [];
  snap.docs.forEach((d: any) => {
    const data = d.data() || {};
    if (data.centroid && typeof data.centroid.lat === "number" && typeof data.centroid.lng === "number") {
      out.push({ pincode: d.id, centroid: data.centroid });
    }
  });
  return out;
}

/**
 * Recompute the adjacency list for a hood against every other known hood centroid,
 * and (symmetrically) fold the new hood into each neighbour's list so adjacency
 * stays consistent as hoods come online. Distances <= 3 km, capped at 9.
 */
async function updateAdjacency(pincode: string, centroid: GeoPoint): Promise<string[]> {
  const others = await loadHoodCentroids();
  const target: HoodCentroid = { pincode, centroid };
  const adjacent = computeAdjacency(target, others, ADJACENCY_MAX_M, ADJACENCY_CAP);

  // Keep neighbours' lists symmetric without exceeding the cap.
  const db = getFirebaseAdminDb();
  await Promise.all(
    others
      .filter((h) => adjacent.includes(h.pincode))
      .map(async (h) => {
        const ref = db.collection("hoods").doc(h.pincode);
        const snap = await ref.get();
        if (!snap.exists) return;
        const current: string[] = snap.data()?.adjacent ?? [];
        if (current.includes(pincode)) return;
        const next = computeAdjacency(
          { pincode: h.pincode, centroid: h.centroid },
          [...others.filter((o) => o.pincode !== h.pincode), target],
          ADJACENCY_MAX_M,
          ADJACENCY_CAP,
        );
        await ref.set({ adjacent: next }, { merge: true });
      }),
  );

  return adjacent;
}

export interface ResolveResult {
  found: boolean;
  hood: Hood | null;
  /** Present when the pincode could not be resolved and needs a manual area name. */
  needsManualArea?: boolean;
}

/**
 * Resolve a hood by pincode. Returns the cached hood when present; otherwise
 * resolves via the postal API, then the static fallback table, and finally reports
 * `needsManualArea` so the caller can offer manual entry. Every successful
 * resolution is cached in `hoods/{pincode}` with a freshly computed adjacency list.
 */
export async function resolveHood(pincode: string): Promise<ResolveResult> {
  if (!isValidPincode(pincode)) {
    return { found: false, hood: null };
  }

  const db = getFirebaseAdminDb();
  const ref = db.collection("hoods").doc(pincode);

  // 1. cache hit — never call the external API twice for the same hood.
  const cached = await ref.get();
  if (cached.exists) {
    return { found: true, hood: { ...(cached.data() as Hood), pincode } };
  }

  // 2. external resolution, then static fallback.
  const place = (await resolveFromApi(pincode)) ?? resolveFromFallback(pincode);
  if (!place) {
    return { found: false, hood: null, needsManualArea: true };
  }

  const adjacent = await updateAdjacency(pincode, place.centroid);
  const hood: Hood = {
    pincode,
    area: place.area,
    city: place.city,
    state: place.state,
    centroid: place.centroid,
    adjacent,
    resolvedAt: Date.now(),
    source: place.source,
    ...newHoodDefaults(),
  };
  await ref.set(hood);
  return { found: true, hood };
}

/**
 * Persist a manually entered area name for a pincode that neither the API nor the
 * fallback table resolved. Uses the national-default centroid so the Field still
 * anchors somewhere sensible; source is recorded as `manual` (design §C.7).
 */
export async function createManualHood(pincode: string, area: string): Promise<ResolveResult> {
  if (!isValidPincode(pincode)) return { found: false, hood: null };
  const cleanArea = tidy(area) || `Area ${pincode}`;

  const db = getFirebaseAdminDb();
  const ref = db.collection("hoods").doc(pincode);
  const cached = await ref.get();
  if (cached.exists) {
    return { found: true, hood: { ...(cached.data() as Hood), pincode } };
  }

  const centroid = NATIONAL_DEFAULT;
  const adjacent = await updateAdjacency(pincode, centroid);
  const hood: Hood = {
    pincode,
    area: cleanArea,
    city: cleanArea,
    state: "",
    centroid,
    adjacent,
    resolvedAt: Date.now(),
    source: "manual",
    ...newHoodDefaults(),
  };
  await ref.set(hood);
  return { found: true, hood };
}

// ---- launch status ----------------------------------------------------------

export function isHoodLive(hood: Pick<Hood, "status">): boolean {
  return hood.status === "live";
}

/** Set the pincode-by-pincode launch switch (operator/admin action, design §C.7). */
export async function setHoodStatus(pincode: string, status: HoodStatus): Promise<void> {
  await getFirebaseAdminDb().collection("hoods").doc(pincode).set({ status }, { merge: true });
}

// ---- statistics -------------------------------------------------------------

/** Linear-interpolated percentile over a numeric sample (0 <= p <= 1). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

export function computePriceBand(prices: readonly number[]): PriceBand {
  return {
    p25: Math.round(percentile(prices, 0.25)),
    p50: Math.round(percentile(prices, 0.5)),
    p75: Math.round(percentile(prices, 0.75)),
    n: prices.length,
  };
}

/** Bucket concrete (non-flexible) start hours into a length-24 histogram. */
export function computeHourHistogram(startHours: ReadonlyArray<number | null>): number[] {
  const hist = new Array(24).fill(0);
  for (const h of startHours) {
    if (h === null || h === undefined) continue;
    if (Number.isInteger(h) && h >= 0 && h <= 23) hist[h] += 1;
  }
  return hist;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface HoodStatsGig {
  askPrice: number;
  startHour: number | null;
  posterUid: string;
  createdAt: number;
}

/**
 * Pure statistics aggregation: price guidance band, 24-hour histogram, gig count,
 * and 30-day active-member count. Kept separate from the Firestore read so it can
 * be unit-tested directly (design §K.6).
 */
export function aggregateHoodStats(
  gigs: readonly HoodStatsGig[],
  now: number = Date.now(),
): Pick<Hood, "priceStats" | "hourHistogram" | "gigCount" | "activeMembers30d"> {
  const prices = gigs.map((g) => g.askPrice).filter((p) => typeof p === "number" && p >= 0);
  const recentPosters = new Set(
    gigs.filter((g) => now - g.createdAt <= THIRTY_DAYS_MS).map((g) => g.posterUid),
  );
  return {
    priceStats: { all: computePriceBand(prices) },
    hourHistogram: computeHourHistogram(gigs.map((g) => g.startHour)),
    gigCount: gigs.length,
    activeMembers30d: recentPosters.size,
  };
}

/**
 * Recompute and persist a hood's statistics from its current gigs. Powers price
 * guidance (§E.2), the day-rhythm scrubber (§C.9), and the "reaching N neighbours"
 * broadcast count (§E.2). Server-only writer.
 */
export async function recomputeHoodStats(pincode: string): Promise<Hood | null> {
  const db = getFirebaseAdminDb();
  const ref = db.collection("hoods").doc(pincode);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const gigsSnap = await db.collection("gigs").where("hoodId", "==", pincode).get();
  const gigs: HoodStatsGig[] = gigsSnap.docs.map((d: any) => {
    const data = d.data() || {};
    return {
      askPrice: typeof data.askPrice === "number" ? data.askPrice : 0,
      startHour: typeof data.startHour === "number" ? data.startHour : null,
      posterUid: data.posterUid || "",
      createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    };
  });

  const stats = aggregateHoodStats(gigs);
  await ref.set(stats, { merge: true });
  return { ...(snap.data() as Hood), pincode, ...stats };
}
