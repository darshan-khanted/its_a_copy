// Property test P5.3 — "Scan never returns a point outside the search radius"
// (design §J, properties P5.1–P5.5).
//
// Validates: Requirements 4.11
//
// Requirement 4.11 requires the proximity scan's nearest-node lookup to be a
// safe, bounded query: it may only ever return a signal that actually lies
// within the caller's search radius, and it must return `null` precisely when
// no signal is within that radius. A lookup that returned a point outside the
// radius would light up a "nearest" node the pointer is nowhere near.
//
// This suite drives that invariant with fast-check over arbitrary point sets,
// cell sizes, query points, and radii, asserting the two directions of the
// contract:
//   (1) Soundness — when `queryNearest` returns an index `i`, the euclidean
//       distance from the query point to that stored point is <= maxPx (never
//       outside the radius).
//   (2) Completeness of the null case — when `queryNearest` returns `null`,
//       no finite stored point lies strictly within the radius.
//
// This file implements ONLY the P5.3 radius-safety property. Determinism is
// P5.1 (task 3.16), agreement with brute force is P5.2 (task 3.17), and tie
// resolution is P5.4 (task 3.19); each owns its own file per the plan's
// parallelism rule. Distances are computed from `hash.positions` (the Float32
// buffer the query itself reads) so the assertion compares against exactly the
// coordinates the implementation used — avoiding spurious float32 rounding gaps.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildSpatialHash,
  queryNearest,
  type Point2D,
} from '@/features/field/lib/spatialHash';

// Coordinates are kept in a bounded range so cell indices stay well inside the
// collision-free packing window; `cellPx` and `maxPx` are constrained so the
// search ring (`ceil(maxPx / cellPx)`) stays small enough to run many cases fast
// while still spanning single-cell to multi-cell searches.
const finite = (min: number, max: number): fc.Arbitrary<number> =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

const pointArb: fc.Arbitrary<Point2D> = fc.record({
  x: finite(-2000, 2000),
  y: finite(-2000, 2000),
});

const caseArb = fc.record({
  points: fc.array(pointArb, { maxLength: 40 }),
  cellPx: finite(16, 128),
  qx: finite(-2000, 2000),
  qy: finite(-2000, 2000),
  maxPx: finite(1, 250),
});

// Smallest squared distance from (qx, qy) to any finite stored point, mirroring
// how the implementation reads `hash.positions`. Non-finite entries are skipped,
// matching `queryNearest`/`buildSpatialHash` behaviour.
function minSquaredDistance(
  positions: Float32Array,
  qx: number,
  qy: number,
): number {
  let best = Infinity;
  for (let i = 0; i < positions.length / 2; i++) {
    const px = positions[2 * i];
    const py = positions[2 * i + 1];
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const ex = px - qx;
    const ey = py - qy;
    const d2 = ex * ex + ey * ey;
    if (d2 < best) best = d2;
  }
  return best;
}

describe('P5.3 scan never returns a point outside the search radius (req 4.11)', () => {
  it('returns an index only for a point within maxPx, and null only when none is within radius', () => {
    fc.assert(
      fc.property(caseArb, ({ points, cellPx, qx, qy, maxPx }) => {
        const hash = buildSpatialHash(points, cellPx);
        const idx = queryNearest(hash, qx, qy, maxPx);
        const maxSq = maxPx * maxPx;

        if (idx !== null) {
          // Soundness: a returned index must be in range and its actual
          // distance from the query point must not exceed the radius.
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(hash.count);

          const ex = hash.positions[2 * idx] - qx;
          const ey = hash.positions[2 * idx + 1] - qy;
          const d2 = ex * ex + ey * ey;
          expect(d2).toBeLessThanOrEqual(maxSq);
        } else {
          // Completeness of the null case: no finite stored point may lie
          // strictly inside the radius (the query keeps points with d2 < maxSq).
          expect(minSquaredDistance(hash.positions, qx, qy)).toBeGreaterThanOrEqual(
            maxSq,
          );
        }
      }),
      { numRuns: 500 },
    );
  });
});
