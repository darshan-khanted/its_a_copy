// Property test P5.2 — "Spatial-hash nearest lookup agrees with brute force" (task 3.17).
//
// Property P5.2: for any set of node positions, any positive grid cell size, any
// query point, and any positive search radius, `queryNearest` (the bucketed
// spatial-hash scan used in the hot pointer path) returns exactly the same index
// as `queryNearestBruteForce` (an exhaustive linear scan over the SAME positions
// with identical tie-breaking). The optimisation must never disagree with the
// reference oracle — same nearest point, same null when nothing is in range, same
// lowest-index tie resolution (design §H.2, §C.6).
//
// This is the correctness contract that lets the Field replace the prototype's
// O(n) forced-layout-per-move scan with a bounded cell search without ever
// changing which signal lights up.
//
// Validates: Requirements 4.11

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildSpatialHashPacked,
  queryNearest,
  queryNearestBruteForce,
} from '@/features/field/lib/spatialHash';

// Field-space pixel coordinates live in a bounded range (a viewport is at most a
// few thousand px), and the cell packing is only collision-free inside
// [-32768, 32767] cells. Keep generated coordinates well within that so we
// exercise the intended input space (smart generator, no run-time filtering)
// rather than the packing overflow edge.
const coordArb: fc.Arbitrary<number> = fc.double({
  min: -2000,
  max: 2000,
  noNaN: true,
  noDefaultInfinity: true,
});

// A flat, packed positions buffer [x0,y0,x1,y1,...]. Include the empty set (0
// points) so the "returns null" branch is covered. Small integer multiplier keeps
// coordinate clusters likely, which makes ties and same-cell collisions common —
// the interesting cases for a hash-vs-brute-force comparison.
const positionsArb: fc.Arbitrary<Float32Array> = fc
  .array(fc.record({ x: coordArb, y: coordArb }), { minLength: 0, maxLength: 60 })
  .map((pts) => {
    const buf = new Float32Array(pts.length * 2);
    for (let i = 0; i < pts.length; i++) {
      buf[2 * i] = pts[i].x;
      buf[2 * i + 1] = pts[i].y;
    }
    return buf;
  });

// Any realistic positive cell size. Ranges from small cells (the search ring
// spans several cells — the interesting bucketed case) up to larger-than-the-scene
// (everything lands in one bucket). Bounded below so the correctness comparison
// stays about geometry rather than degenerating into a multi-million-cell ring
// walk for query radii that never occur in the real Field (cellPx ~= 48).
const cellArb: fc.Arbitrary<number> = fc.double({
  min: 8,
  max: 512,
  noNaN: true,
  noDefaultInfinity: true,
});

const queryArb: fc.Arbitrary<{ x: number; y: number }> = fc.record({
  x: coordArb,
  y: coordArb,
});

// queryNearest / queryNearestBruteForce both require maxPx > 0. Spans from a
// pixel-tight radius (frequently returns null) through and well beyond the
// prototype's DEFAULT_SCAN_RADIUS_PX (88) so both the in-range and out-of-range
// branches are hit, while keeping the search ring bounded relative to cellPx.
const radiusArb: fc.Arbitrary<number> = fc.double({
  min: 1,
  max: 400,
  noNaN: true,
  noDefaultInfinity: true,
});

describe('P5.2 spatial-hash nearest lookup agrees with brute force (req 4.11)', () => {
  it('returns the identical index (or null) as an exhaustive scan for every input', () => {
    fc.assert(
      fc.property(
        positionsArb,
        cellArb,
        queryArb,
        radiusArb,
        (positions, cellPx, q, maxPx) => {
          const hash = buildSpatialHashPacked(positions, cellPx);

          const viaHash = queryNearest(hash, q.x, q.y, maxPx);
          const viaBrute = queryNearestBruteForce(positions, q.x, q.y, maxPx);

          // Exact structural equality: same index, or both null. No tolerance —
          // the two must agree on the discrete answer, not merely on distance.
          expect(viaHash).toBe(viaBrute);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('agrees regardless of cell size for a fixed scene and sweep of queries', () => {
    // Pin the scene and query grid, vary only the cell size, to prove the hash's
    // answer is a pure function of geometry — never of the chosen granularity.
    fc.assert(
      fc.property(positionsArb, cellArb, radiusArb, (positions, cellPx, maxPx) => {
        const hash = buildSpatialHashPacked(positions, cellPx);
        for (let qx = -2200; qx <= 2200; qx += 271) {
          for (let qy = -2200; qy <= 2200; qy += 293) {
            expect(queryNearest(hash, qx, qy, maxPx)).toBe(
              queryNearestBruteForce(positions, qx, qy, maxPx),
            );
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
