// Server-side geo primitives for the Hood service (design §C.7, §G.4).
//
// Pure, I/O-free functions used to compute hood adjacency, index gigs by geohash,
// and measure neighbourhood distances. Keeping them pure makes them directly
// testable and safe to reuse from the resolution service and the gig-create path.
//
// NOTE: Deterministic coordinate fuzzing (design §H.3, `FUZZ_MIN_M`/`FUZZ_MAX_M`,
// `fuzzCoordinate`) is intentionally NOT implemented here — it lands with the
// location-privacy work in task 9.1. This module provides only the distance,
// geohash, and adjacency helpers that the Hood service (task 3.6) needs today.

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const DEG2RAD = Math.PI / 180;

/** Great-circle distance between two points, in metres. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLng = (b.lng - a.lng) * DEG2RAD;
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---- geohash (base32, standard Gustavo Niemeyer encoding) -------------------

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a point to a geohash of the given precision. Precision 7 (~153 m cell) is
 * the secondary radius index written to every gig (`geohash7`, design §C.7/§G.4).
 */
export function geohashEncode(p: GeoPoint, precision = 7): string {
  if (precision < 1) throw new Error('geohash precision must be >= 1');

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true; // even bits select longitude, odd bits latitude

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (p.lng >= mid) {
        ch = (ch << 1) + 1;
        lngMin = mid;
      } else {
        ch = ch << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (p.lat >= mid) {
        ch = (ch << 1) + 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      hash += GEOHASH_BASE32.charAt(ch);
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

// ---- hood adjacency ---------------------------------------------------------

export interface HoodCentroid {
  pincode: string;
  centroid: GeoPoint;
}

/** Max centroid distance for two hoods to be considered adjacent (design §C.7). */
export const ADJACENCY_MAX_M = 3_000;

/**
 * Cap on the adjacency list. Bounded at 9 so that a `where('hoodId','in',[home, …])`
 * browse query never exceeds Firestore's `in` limit of 10 (design §C.7).
 */
export const ADJACENCY_CAP = 9;

/**
 * Pure adjacency computation: given a target hood centroid and the centroids of
 * other known hoods, return the pincodes within `ADJACENCY_MAX_M`, nearest first,
 * capped at `ADJACENCY_CAP`. The target's own pincode is always excluded, and ties
 * break deterministically by pincode so the result is stable across runs.
 */
export function computeAdjacency(
  target: HoodCentroid,
  others: readonly HoodCentroid[],
  maxM: number = ADJACENCY_MAX_M,
  cap: number = ADJACENCY_CAP,
): string[] {
  return others
    .filter((h) => h.pincode !== target.pincode)
    .map((h) => ({ pincode: h.pincode, d: haversineM(target.centroid, h.centroid) }))
    .filter((h) => h.d <= maxM)
    .sort((a, b) => (a.d === b.d ? a.pincode.localeCompare(b.pincode) : a.d - b.d))
    .slice(0, cap)
    .map((h) => h.pincode);
}
