// Property test P4.3 — "The anchor maps exactly to Field centre" (task 3.11).
//
// Property P4.3: for every valid Field transform (any in-range anchor, any
// positive radius, either radial warp), projecting the transform's own anchor
// lands exactly on the Field centre (0.5, 0.5) within a tight float tolerance.
// This is the fixed point that anchors the whole geo <-> Field projection
// (design §H.1) and underpins the round-trip guarantee.
//
// Validates: Requirements 3.7

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  FIELD_CENTRE,
  createFieldTransform,
  projectToField,
  radialDist,
  type FieldWarp,
  type GeoPoint,
} from '@/features/field/lib/projection';

// The transform rejects |lat| > 89.9 and |lng| > 180, so constrain the
// generators to the module's valid input space (smart generators, no filtering).
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

// Anchor -> centre is an exact algebraic identity (r = 0 => rNorm = 0), so the
// only error is IEEE-754 rounding in the tangent-plane arithmetic. A tolerance
// well below one screen pixel on any realistic Field keeps "exactly" honest.
const TOL = 1e-9;

describe('P4.3 the anchor maps exactly to the Field centre (req 3.7)', () => {
  it('projects any valid transform anchor onto (0.5, 0.5)', () => {
    fc.assert(
      fc.property(anchorArb, radiusArb, warpArb, (anchor, radiusM, warp) => {
        const t = createFieldTransform(anchor, radiusM, warp);
        const f = projectToField(anchor, t);

        expect(Math.abs(f.fx - FIELD_CENTRE.fx)).toBeLessThanOrEqual(TOL);
        expect(Math.abs(f.fy - FIELD_CENTRE.fy)).toBeLessThanOrEqual(TOL);
        // The centre has zero radial offset — the anchor is the disc's fixed point.
        expect(radialDist(f)).toBeLessThanOrEqual(TOL);
      }),
      { numRuns: 1000 },
    );
  });
});
