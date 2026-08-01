// Property test P5.1 — "Identical nearest-signal inputs always return the same
// index" (design §H.2, §J; Scan determinism).
//
// Validates: Requirements 4.10
//
// Requirement 4.10 requires the proximity Scan's nearest-node lookup to be a
// deterministic pure function: for a fixed set of signal positions, cell size,
// query point, and search radius, `queryNearest` must return the identical index
// (or the identical `null`) on every invocation, independent of `Map` bucket
// iteration order or any hidden state. This suite drives that invariant with
// fast-check over arbitrary point sets, cell sizes, and query points.
//
// This file implements ONLY the P5.1 determinism property. Agreement with an
// exhaustive scan is P5.2 (task 3.17), search-radius safety is P5.3 (task 3.18),
// and stable tie-breaking is P5.4 (task 3.19). Per the plan's parallelism rule,
// this test owns its own file and consumes only the public spatialHash API.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildSpatialHash,
  queryNearest,
  DEFAULT_SCAN_RADIUS_PX,
  type Point2D,
} from '@/features/field/lib/spatialHash';

// Field-space pixel coordinates are bounded (a viewport is at most a few thousand
// px), so points, cell sizes, and query coordinates are sampled from realistic,
// finite ranges. Duplicate coordinates and ties are deliberately allowed — they
// are the interesting determinism cases the tie-break rule must handle stably.
const coordArb: fc.Arbitrary<number> = fc.double({
  min: -2000,
  max: 2000,
  noNaN: true,
  noDefaultInfinity: true,
});

const pointArb: fc.Arbitrary<Point2D> = fc.record({ x: coordArb, y: coordArb });

// Include the empty set (no points → null) and larger clustered sets.
const pointsArb: fc.Arbitrary<Point2D[]> = fc.array(pointArb, { minLength: 0, maxLength: 60 });

const cellArb: fc.Arbitrary<number> = fc.double({
  min: 1,
  max: 256,
  noNaN: true,
  noDefaultInfinity: true,
});

const radiusArb: fc.Arbitrary<number> = fc.double({
  min: 1,
  max: 4 * DEFAULT_SCAN_RADIUS_PX,
  noNaN: true,
  noDefaultInfinity: true,
});

const caseArb = fc.record({
  points: pointsArb,
  cellPx: cellArb,
  qx: coordArb,
  qy: coordArb,
  maxPx: radiusArb,
});

describe('P5.1 Scan nearest lookup is deterministic (req 4.10)', () => {
  it('returns the identical index across repeated calls on one hash', () => {
    fc.assert(
      fc.property(caseArb, ({ points, cellPx, qx, qy, maxPx }) => {
        const h = buildSpatialHash(points, cellPx);
        const first = queryNearest(h, qx, qy, maxPx);
        // The result must be stable across many repeated invocations — bucket
        // Map iteration order and squared-distance comparisons must not leak any
        // run-to-run nondeterminism.
        for (let i = 0; i < 25; i++) {
          expect(queryNearest(h, qx, qy, maxPx)).toBe(first);
        }
      }),
      { numRuns: 400 },
    );
  });

  it('returns the identical index when the hash is rebuilt from the same inputs', () => {
    fc.assert(
      fc.property(caseArb, ({ points, cellPx, qx, qy, maxPx }) => {
        // Determinism is a property of the inputs, not of a particular hash
        // instance: two independently built hashes over identical point sets and
        // cell sizes must yield the same nearest index for the same query.
        const a = queryNearest(buildSpatialHash(points, cellPx), qx, qy, maxPx);
        const b = queryNearest(buildSpatialHash(points, cellPx), qx, qy, maxPx);
        expect(b).toBe(a);
      }),
      { numRuns: 400 },
    );
  });
});
