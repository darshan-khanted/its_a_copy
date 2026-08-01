// Property test P4.1 — "Projection round-trip stays within tolerance" (design §J.4).
//
// Validates: Requirements 3.7
//
// Requirement 3.7 states that for every point within the Field radius the
// projection module must satisfy
//     haversine(p, unproject(project(p))) <= max(1 m, radius * 1e-6)
// under both the linear and the square-root radial warp. This suite drives that
// invariant with fast-check over arbitrary anchors, radii, warps, and in-radius
// geographic points generated around each anchor.
//
// This file implements ONLY the P4.1 round-trip property. The anchor-maps-to-
// centre half of req 3.7 is exercised by P4.3 (task 3.11); out-of-range clamping
// is P4.6 (task 3.14). Per the plan's parallelism rule, this test owns its own
// file and consumes only the public projection API.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFieldTransform,
  haversineM,
  projectToField,
  unprojectFromField,
  type FieldWarp,
  type GeoPoint,
} from '@/features/field/lib/projection';

// Anchors are constrained away from the poles so the `cos φ` longitude scale
// stays well-conditioned; radii span the realistic Field range (tens of metres
// to well past the 2 km default). Both warps are covered.
const anchorArb: fc.Arbitrary<GeoPoint> = fc.record({
  lat: fc.double({ min: -80, max: 80, noNaN: true, noDefaultInfinity: true }),
  lng: fc.double({ min: -179, max: 179, noNaN: true, noDefaultInfinity: true }),
});

const radiusArb: fc.Arbitrary<number> = fc.double({
  min: 50,
  max: 20_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const warpArb: fc.Arbitrary<FieldWarp> = fc.constantFrom('linear', 'sqrt');

// A point is generated *inside* the disc by choosing a distance fraction in
// [0, 1] of the radius and a bearing, then walking that offset out from the
// anchor on the same local tangent plane the transform uses. This keeps every
// sample within the radius (so the forward projection never clamps) while still
// covering the full disc, all bearings, and the exact centre (fraction 0).
const inRadiusArb = fc.record({
  anchor: anchorArb,
  radiusM: radiusArb,
  warp: warpArb,
  distFrac: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  bearingRad: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
});

describe('P4.1 projection round-trip stays within tolerance (req 3.7)', () => {
  it('recovers every in-radius point within max(1 m, radius * 1e-6) under both warps', () => {
    fc.assert(
      fc.property(inRadiusArb, ({ anchor, radiusM, warp, distFrac, bearingRad }) => {
        const t = createFieldTransform(anchor, radiusM, warp);

        // Build an in-radius geographic point on the transform's tangent plane.
        const d = distFrac * radiusM;
        const dNorth = d * Math.cos(bearingRad);
        const dEast = d * Math.sin(bearingRad);
        const p: GeoPoint = {
          lat: anchor.lat + dNorth / t.metresPerDegLat,
          lng: anchor.lng + dEast / t.metresPerDegLng,
        };

        const back = unprojectFromField(projectToField(p, t), t);
        const errorM = haversineM(p, back);
        const toleranceM = Math.max(1, radiusM * 1e-6);

        expect(Number.isFinite(errorM)).toBe(true);
        expect(errorM).toBeLessThanOrEqual(toleranceM);
      }),
      { numRuns: 500 },
    );
  });
});
