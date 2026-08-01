// Property test P4.2 — "Every projected point remains inside the unit disc" (task 3.10).
//
// Property P4.2: for every valid Field transform and *any* geographic point —
// including points far beyond the disc radius — the forward projection lands a
// finite position inside the unit square [0,1]^2 and its inscribed disc of
// radius FIELD_DISC_RADIUS (0.5). Points beyond the radius clamp onto the disc
// boundary; they are never dropped and never fly outside the drawable area
// (design §H.1). This is what lets the Field render an off-board signal on the
// rim instead of silently losing it.
//
// Validates: Requirements 3.5

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  FIELD_DISC_RADIUS,
  createFieldTransform,
  projectToField,
  radialDist,
  type FieldWarp,
  type GeoPoint,
} from '@/features/field/lib/projection';

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

// projectToField does not validate its target point, so exercise the whole
// globe. Against a small radius most of these lie far beyond the disc and must
// clamp to the boundary — exactly the case req 3.5 protects.
const targetArb: fc.Arbitrary<GeoPoint> = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
});

const warpArb: fc.Arbitrary<FieldWarp> = fc.constantFrom('linear', 'sqrt');

// radialDist = 0.5 * rNorm * hypot(sin θ, cos θ); rNorm is clamped to [0,1] and
// hypot(sin, cos) is 1 up to IEEE-754 rounding, so the only slack is float error.
// A tolerance far below one screen pixel on any realistic Field keeps the bound honest.
const TOL = 1e-9;

describe('P4.2 every projected point stays inside the unit disc (req 3.5)', () => {
  it('projects any geo point into [0,1]^2 and within the inscribed disc', () => {
    fc.assert(
      fc.property(anchorArb, radiusArb, warpArb, targetArb, (anchor, radiusM, warp, target) => {
        const t = createFieldTransform(anchor, radiusM, warp);
        const f = projectToField(target, t);

        // Never dropped: the output is always a finite, usable position.
        expect(Number.isFinite(f.fx)).toBe(true);
        expect(Number.isFinite(f.fy)).toBe(true);

        // Inside the unit square.
        expect(f.fx).toBeGreaterThanOrEqual(-TOL);
        expect(f.fx).toBeLessThanOrEqual(1 + TOL);
        expect(f.fy).toBeGreaterThanOrEqual(-TOL);
        expect(f.fy).toBeLessThanOrEqual(1 + TOL);

        // Inside the inscribed disc — the actual drawable area.
        expect(radialDist(f)).toBeLessThanOrEqual(FIELD_DISC_RADIUS + TOL);
      }),
      { numRuns: 1000 },
    );
  });

  it('clamps a point beyond the radius exactly onto the boundary and never drops it', () => {
    // Build a target guaranteed to sit beyond the disc: displace the anchor by
    // `excess × radius` metres along an arbitrary bearing using the transform's
    // own metres-per-degree scales, so the tangent-plane radius exceeds radiusM.
    const excessArb = fc.double({ min: 1.001, max: 10_000, noNaN: true, noDefaultInfinity: true });
    const bearingArb = fc.double({ min: 0, max: 2 * Math.PI, noNaN: true });

    fc.assert(
      fc.property(anchorArb, radiusArb, warpArb, excessArb, bearingArb, (anchor, radiusM, warp, excess, bearing) => {
        const t = createFieldTransform(anchor, radiusM, warp);

        const distanceM = radiusM * excess;
        const dNorth = distanceM * Math.cos(bearing);
        const dEast = distanceM * Math.sin(bearing);
        const target: GeoPoint = {
          lat: anchor.lat + dNorth / t.metresPerDegLat,
          lng: anchor.lng + dEast / t.metresPerDegLng,
        };

        const f = projectToField(target, t);

        // Not dropped: still a finite position.
        expect(Number.isFinite(f.fx)).toBe(true);
        expect(Number.isFinite(f.fy)).toBe(true);

        // Clamped precisely to the disc boundary (rNorm saturates at 1 under both warps).
        expect(radialDist(f)).toBeGreaterThanOrEqual(FIELD_DISC_RADIUS - TOL);
        expect(radialDist(f)).toBeLessThanOrEqual(FIELD_DISC_RADIUS + TOL);
      }),
      { numRuns: 1000 },
    );
  });
});
