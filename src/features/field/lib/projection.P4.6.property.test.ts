// Property test P4.6 — "Beyond-radius points clamp to the boundary and never
// disappear" (task 3.14).
//
// Property P4.6: for every valid Field transform, a geographic point that lies
// *strictly beyond* the disc radius must still project to a finite Field
// position (it is never dropped) and that position must land exactly on the disc
// boundary — radialDist ≈ FIELD_DISC_RADIUS (design §H.1, step 3: the normalised
// radius saturates at 1 under both warps). This is the guarantee that an
// off-board signal shows on the rim of the radar instead of silently vanishing.
//
// This file is self-contained (same-wave sibling tasks must not edit shared test
// files). It defines its own `fast-check` arbitraries and drives the pure,
// I/O-free projection module directly. Whereas P4.2 (task 3.10) covers the
// general "inside the unit disc" bound for *any* point, THIS file focuses solely
// on the beyond-radius clamping case.
//
// Validates: Requirements 3.5

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  FIELD_DISC_RADIUS,
  createFieldTransform,
  projectToField,
  radialDist,
  type FieldWarp,
  type GeoPoint,
} from './projection';

// createFieldTransform rejects |lat| > 89.9 and |lng| > 180, so keep the anchor
// inside the module's valid input space (smart generators, no run-time filtering).
const anchorArb: fc.Arbitrary<GeoPoint> = fc.record({
  lat: fc.double({ min: -89.9, max: 89.9, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
});

// Any positive, finite disc radius in metres — from a tiny courtyard to a city.
const radiusArb: fc.Arbitrary<number> = fc.double({
  min: 1,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const warpArb: fc.Arbitrary<FieldWarp> = fc.constantFrom('linear', 'sqrt');

// Strictly-greater-than-1 multiple of the radius, so the derived point is always
// beyond the disc edge. The lower bound stays just above 1 to probe the boundary
// from the outside; the upper bound reaches far past the horizon.
const excessArb: fc.Arbitrary<number> = fc.double({
  min: 1.0001,
  max: 1_000_000,
  noNaN: true,
  noDefaultInfinity: true,
});

// Full 360° of bearing, measured as a plane angle for the tangent-plane offset.
const bearingArb: fc.Arbitrary<number> = fc.double({ min: 0, max: 2 * Math.PI, noNaN: true });

// rNorm saturates to exactly 1 and radialDist = 0.5 * 1 * hypot(sin θ, cos θ);
// hypot(sin, cos) is 1 up to IEEE-754 rounding, so the only slack is float error.
// A tolerance far below one screen pixel on any realistic Field keeps the bound honest.
const TOL = 1e-9;

describe('P4.6 beyond-radius points clamp to the boundary and never disappear (req 3.5)', () => {
  it('clamps every out-of-range point exactly onto the disc boundary as a finite position', () => {
    // **Validates: Requirements 3.5**
    fc.assert(
      fc.property(
        anchorArb,
        radiusArb,
        warpArb,
        excessArb,
        bearingArb,
        (anchor, radiusM, warp, excess, bearing) => {
          const t = createFieldTransform(anchor, radiusM, warp);

          // Displace the anchor by `excess × radius` metres along an arbitrary
          // bearing, using the transform's own metres-per-degree scales so the
          // tangent-plane radius the projection computes strictly exceeds radiusM.
          const distanceM = radiusM * excess;
          const dNorth = distanceM * Math.cos(bearing);
          const dEast = distanceM * Math.sin(bearing);
          const target: GeoPoint = {
            lat: anchor.lat + dNorth / t.metresPerDegLat,
            lng: anchor.lng + dEast / t.metresPerDegLng,
          };

          const f = projectToField(target, t);

          // Never dropped: the output is always a finite, usable position.
          expect(Number.isFinite(f.fx)).toBe(true);
          expect(Number.isFinite(f.fy)).toBe(true);

          // Never escapes the unit square either.
          expect(f.fx).toBeGreaterThanOrEqual(-TOL);
          expect(f.fx).toBeLessThanOrEqual(1 + TOL);
          expect(f.fy).toBeGreaterThanOrEqual(-TOL);
          expect(f.fy).toBeLessThanOrEqual(1 + TOL);

          // Clamped precisely to the disc boundary (rNorm saturates at 1 under both warps).
          expect(radialDist(f)).toBeGreaterThanOrEqual(FIELD_DISC_RADIUS - TOL);
          expect(radialDist(f)).toBeLessThanOrEqual(FIELD_DISC_RADIUS + TOL);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('places a point exactly at the radius on the boundary (the clamp threshold)', () => {
    // **Validates: Requirements 3.5**
    // A point at distance == radiusM is the boundary case: rNorm = 1 before any
    // warp, so both 'linear' and 'sqrt' leave it on the rim. This pins the edge
    // between "inside" and "clamped".
    fc.assert(
      fc.property(anchorArb, radiusArb, warpArb, bearingArb, (anchor, radiusM, warp, bearing) => {
        const t = createFieldTransform(anchor, radiusM, warp);

        const dNorth = radiusM * Math.cos(bearing);
        const dEast = radiusM * Math.sin(bearing);
        const target: GeoPoint = {
          lat: anchor.lat + dNorth / t.metresPerDegLat,
          lng: anchor.lng + dEast / t.metresPerDegLng,
        };

        const f = projectToField(target, t);

        expect(Number.isFinite(f.fx)).toBe(true);
        expect(Number.isFinite(f.fy)).toBe(true);
        expect(radialDist(f)).toBeGreaterThanOrEqual(FIELD_DISC_RADIUS - TOL);
        expect(radialDist(f)).toBeLessThanOrEqual(FIELD_DISC_RADIUS + TOL);
      }),
      { numRuns: 1000 },
    );
  });
});
