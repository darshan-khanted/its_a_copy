// Pure geo <-> Field-space projection (design §C.2, §H.1; requirements 3.2-3.8).
//
// THE Projection Module is the transform that turns a gig's published *fuzzed*
// geographic coordinate into a position on the Field — a unit-square radar disc
// centred on the hood anchor — and back again. It is deliberately I/O-free
// (requirement 30.11, NFR-5.5): no Firebase, no DOM, no clock, no randomness.
// Every output is a pure function of its inputs, which is what lets the property
// tests P4.1-P4.6 (tasks 3.9-3.14) drive it exhaustively.
//
// Model (design §H.1):
//   - Field space is the unit square [0,1]^2 with origin top-left, the anchor at
//     (0.5, 0.5), and the inscribed disc of radius 0.5 as the drawable area.
//   - Geography is approximated by a *local equirectangular tangent plane* (ENU)
//     around the anchor. Over a 2 km radius the flat-earth error is < 0.1 m — far
//     below the ~120 m fuzz radius — so it is free accuracy and keeps relative
//     distance and relative bearing (the only two things a user can perceive)
//     exact, unlike Web Mercator which distorts bearing-relative distance.
//   - A radius is normalised into [0,1] and clamped to the disc so a point beyond
//     the radius lands exactly on the boundary and is never dropped (req 3.5).
//   - An optional monotone `sqrt` warp spreads the dense near-centre cluster
//     outward. Because `sqrt` is strictly increasing on [0,1], distance ordering
//     is preserved under both warps (req 3.6) and the warp is purely radial, so
//     bearing is preserved exactly (req 3.8).

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Field space: unit square [0,1]^2, origin top-left, anchor at (0.5, 0.5). */
export interface FieldPoint {
  fx: number;
  fy: number;
}

export type FieldWarp = 'linear' | 'sqrt';

export interface FieldTransform {
  anchor: GeoPoint;
  radiusM: number;
  /** Metres per degree of latitude (~111_320, constant across the globe). */
  metresPerDegLat: number;
  /** Metres per degree of longitude at the anchor latitude (shrinks with cos φ). */
  metresPerDegLng: number;
  warp: FieldWarp;
}

// ---- constants --------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Metres per degree of latitude on the WGS84 mean sphere (design §H.1). */
export const METRES_PER_DEG_LAT = 111_320;

/** The Field disc radius in unit-square space: the inscribed circle of [0,1]^2. */
export const FIELD_DISC_RADIUS = 0.5;

/** Field centre — where the anchor always maps (requirement 3.7). */
export const FIELD_CENTRE: FieldPoint = { fx: 0.5, fy: 0.5 };

/**
 * Largest anchor latitude we allow before the `cos φ` longitude scale collapses
 * toward the poles. Irrelevant for India; guarded so a bad anchor cannot produce
 * a degenerate (zero metres-per-degree-lng) transform.
 */
const MAX_ANCHOR_LAT = 89.9;

// ---- transform construction -------------------------------------------------

/**
 * Build the immutable transform for a hood Field. `anchor` is the hood centroid
 * (or the opted-in live location); `radiusM` is the disc radius in metres (2000 m
 * by default). The longitude metres-per-degree is derived from the anchor
 * latitude so east/west distances are correct at that latitude.
 *
 * @throws RangeError when `radiusM <= 0` or the anchor is out of the safe range.
 */
export function createFieldTransform(
  anchor: GeoPoint,
  radiusM: number,
  warp: FieldWarp = 'linear',
): FieldTransform {
  if (!(radiusM > 0) || !Number.isFinite(radiusM)) {
    throw new RangeError(`createFieldTransform: radiusM must be a positive finite number, got ${radiusM}`);
  }
  if (!Number.isFinite(anchor.lat) || Math.abs(anchor.lat) > MAX_ANCHOR_LAT) {
    throw new RangeError(`createFieldTransform: anchor.lat must be within ±${MAX_ANCHOR_LAT}, got ${anchor.lat}`);
  }
  if (!Number.isFinite(anchor.lng) || Math.abs(anchor.lng) > 180) {
    throw new RangeError(`createFieldTransform: anchor.lng must be within ±180, got ${anchor.lng}`);
  }

  return {
    anchor: { lat: anchor.lat, lng: anchor.lng },
    radiusM,
    metresPerDegLat: METRES_PER_DEG_LAT,
    metresPerDegLng: METRES_PER_DEG_LAT * Math.cos(anchor.lat * DEG2RAD),
    warp,
  };
}

// ---- forward projection: geo -> field --------------------------------------

/**
 * Project a geographic point onto the Field (design §H.1). The result is always
 * inside the unit square and its inscribed disc: points beyond `radiusM` clamp to
 * the boundary and are never dropped (req 3.5). The anchor maps exactly to the
 * centre (req 3.7).
 */
export function projectToField(p: GeoPoint, t: FieldTransform): FieldPoint {
  // 1. local tangent-plane offsets in metres (east, north).
  const dEast = (p.lng - t.anchor.lng) * t.metresPerDegLng;
  const dNorth = (p.lat - t.anchor.lat) * t.metresPerDegLat;

  // 2. polar form. theta measured from north, clockwise (0 = north).
  const r = Math.hypot(dEast, dNorth);
  const theta = Math.atan2(dEast, dNorth);

  // 3. normalise radius and clamp to the disc — never drop a signal (req 3.5).
  let rNorm = Math.min(1, r / t.radiusM);

  // 4. optional monotone radial warp; sqrt is strictly increasing on [0,1] so
  //    distance ordering (req 3.6) is preserved.
  if (t.warp === 'sqrt') rNorm = Math.sqrt(rNorm);

  // 5. back to cartesian, anchor at centre. y inverted for screen space.
  return {
    fx: 0.5 + FIELD_DISC_RADIUS * rNorm * Math.sin(theta),
    fy: 0.5 - FIELD_DISC_RADIUS * rNorm * Math.cos(theta),
  };
}

// ---- inverse projection: field -> geo ---------------------------------------

/**
 * Recover the geographic point from a Field position (design §H.1). This is the
 * exact inverse of {@link projectToField} for in-disc points; the `sqrt` warp is
 * undone by squaring, guaranteeing the round-trip bound of req 3.7.
 */
export function unprojectFromField(f: FieldPoint, t: FieldTransform): GeoPoint {
  const ux = (f.fx - 0.5) * 2; // [-1, 1]
  const uy = (0.5 - f.fy) * 2;

  let rNorm = Math.min(1, Math.hypot(ux, uy));
  if (t.warp === 'sqrt') rNorm = rNorm * rNorm; // exact inverse of the forward sqrt

  const theta = Math.atan2(ux, uy);
  const r = rNorm * t.radiusM;

  return {
    lat: t.anchor.lat + (r * Math.cos(theta)) / t.metresPerDegLat,
    lng: t.anchor.lng + (r * Math.sin(theta)) / t.metresPerDegLng,
  };
}

// ---- geodesic helpers -------------------------------------------------------

/** Great-circle distance between two points, in metres (design §H.1). */
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

/**
 * Initial great-circle bearing from `from` to `to`, in degrees in [0, 360),
 * measured clockwise from true north (0 = north, 90 = east). Requirement 3.8.
 */
export function bearingDeg(from: GeoPoint, to: GeoPoint): number {
  const lat1 = from.lat * DEG2RAD;
  const lat2 = to.lat * DEG2RAD;
  const dLng = (to.lng - from.lng) * DEG2RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normaliseDeg(Math.atan2(y, x) * RAD2DEG);
}

// ---- field-space helpers (consumed by property tests P4.1-P4.6) ------------

/**
 * Radial distance of a Field point from the centre, in unit-square units. Ranges
 * over [0, 0.5]; a point on the disc boundary reads exactly {@link FIELD_DISC_RADIUS}.
 */
export function radialDist(f: FieldPoint): number {
  return Math.hypot(f.fx - 0.5, f.fy - 0.5);
}

/**
 * Bearing of a Field point from the centre, in degrees in [0, 360), measured
 * clockwise from up (0 = up/north) to match {@link bearingDeg}. This inverts the
 * forward projection's `theta`, so it equals the geodesic bearing within the
 * tangent-plane tolerance (req 3.8).
 */
export function fieldBearing(f: FieldPoint): number {
  const ux = (f.fx - 0.5) * 2;
  const uy = (0.5 - f.fy) * 2;
  return normaliseDeg(Math.atan2(ux, uy) * RAD2DEG);
}

/**
 * Smallest absolute angular difference between two bearings in degrees, in
 * [0, 180]. Handles wrap-around (359° vs 1° => 2°).
 */
export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(normaliseDeg(a) - normaliseDeg(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/** Normalise a degree value into [0, 360). */
function normaliseDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}
