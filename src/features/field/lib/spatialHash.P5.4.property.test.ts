// Property test P5.4 — "Equidistant ties resolve to the lowest index" (task 3.19).
//
// Property P5.4: when two or more signals sit at *exactly* the same distance from
// the query point, `queryNearest` must return the LOWEST array index among them —
// and it must do so independently of the order in which the spatial hash happens
// to iterate its `Map` buckets (design §H.2; req 4.10). This is the invariant that
// makes the proximity scan deterministic: the "active" node under the spotlight
// can never flicker between two equidistant candidates just because a different
// cell size or insertion order rearranged the internal buckets.
//
// Strategy: coordinates are drawn as small INTEGERS. Integers up to 2^24 are
// represented exactly in the Float32Array backing store, and the query point is an
// integer too, so every squared distance `ex*ex + ey*ey` is an exact integer — which
// means the equidistant ties we build are *genuine* IEEE-754 ties, not near-ties
// that rounding could split. We deliberately place tied points across different grid
// cells (via sign/axis symmetry, whose members share one squared magnitude) and vary
// `cellPx` so the bucket iteration order differs run to run. An independent in-test
// oracle computes the expected lowest index, and we assert `queryNearest` agrees.
//
// Validates: Requirements 4.10

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildSpatialHash,
  buildSpatialHashPacked,
  queryNearest,
  type Point2D,
} from '@/features/field/lib/spatialHash';

// Independent oracle: the lowest index whose squared distance to (qx, qy) is the
// strict minimum among all points that lie strictly inside `maxPx`. This mirrors
// `queryNearest`'s contract (strictly-less distance wins; exact ties fall to the
// lowest index) without reusing its cell-walking machinery, so agreement is real
// evidence rather than a tautology. All arithmetic is exact-integer.
function expectedLowestIndex(
  pts: ReadonlyArray<Point2D>,
  qx: number,
  qy: number,
  maxPx: number,
): number | null {
  const maxD2 = maxPx * maxPx;
  let best = maxD2;
  let bestIdx: number | null = null;
  for (let i = 0; i < pts.length; i++) {
    const ex = pts[i].x - qx;
    const ey = pts[i].y - qy;
    const d2 = ex * ex + ey * ey;
    // Strictly nearer replaces; an exact tie only replaces a *higher* index.
    if (d2 < best || (d2 === best && bestIdx !== null && i < bestIdx)) {
      best = d2;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// The eight sign/axis reflections of (a, b) all share squared magnitude a^2 + b^2,
// so every distinct member sits at the SAME distance from the origin — an exact tie
// group. When |a| != |b| and both are non-zero these spread across four quadrants
// (and, once scaled past cellPx, across different grid cells).
function tieOffsets(a: number, b: number): Array<[number, number]> {
  const raw: Array<[number, number]> = [
    [a, b],
    [-a, b],
    [a, -b],
    [-a, -b],
    [b, a],
    [-b, a],
    [b, -a],
    [-b, -a],
  ];
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const [dx, dy] of raw) {
    const k = `${dx},${dy}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([dx, dy]);
    }
  }
  return out;
}

const coordArb = fc.integer({ min: -5000, max: 5000 });

// Scenario generator. Builds a tie group (guaranteed to be the nearest points),
// optional exact duplicates (same-cell ties), and strictly-farther distractors,
// then hands back a shuffle key vector so the property body can reorder the points
// and prove the answer tracks the lowest index rather than insertion position.
const scenarioArb = fc
  .record({
    qx: coordArb,
    qy: coordArb,
    // a in [0,200], b in [1,200] => (a,b) is never the zero vector, so the tie
    // group always sits at a positive distance and can be the strict minimum.
    a: fc.integer({ min: 0, max: 200 }),
    b: fc.integer({ min: 1, max: 200 }),
    nDup: fc.integer({ min: 0, max: 3 }),
    distractors: fc.array(
      fc.record({
        extra: fc.integer({ min: 0, max: 500 }),
        perp: fc.integer({ min: -200, max: 200 }),
        axis: fc.constantFrom<'x' | 'y'>('x', 'y'),
      }),
      { maxLength: 6 },
    ),
    // Varying the cell size reshuffles which bucket each point lands in and the
    // order buckets are visited — the exact thing tie-breaking must be immune to.
    cellPx: fc.constantFrom(1, 8, 16, 48, 100, 200),
  })
  .chain((cfg) => {
    const q = { x: cfg.qx, y: cfg.qy };
    const offs = tieOffsets(cfg.a, cfg.b);
    const pts: Point2D[] = offs.map(([dx, dy]) => ({ x: q.x + dx, y: q.y + dy }));

    // Exact duplicates of the first few tie points -> ties inside a single bucket.
    for (let i = 0; i < cfg.nDup; i++) {
      pts.push({ ...pts[i % pts.length] });
    }

    // Distractors are strictly farther: displacement along one axis is at least
    // (a + b + 1) > sqrt(a^2 + b^2), so their squared distance always exceeds the
    // tie radius regardless of the perpendicular offset. They must never win.
    const base = cfg.a + cfg.b + 1;
    for (const d of cfg.distractors) {
      const along = base + d.extra;
      if (d.axis === 'x') pts.push({ x: q.x + along, y: q.y + d.perp });
      else pts.push({ x: q.x + d.perp, y: q.y + along });
    }

    // maxPx > tie radius (a + b >= sqrt(a^2 + b^2)) so every tie point is in range.
    const maxPx = cfg.a + cfg.b + 50;

    return fc.record({
      q: fc.constant(q),
      maxPx: fc.constant(maxPx),
      cellPx: fc.constant(cfg.cellPx),
      points: fc.constant(pts),
      // One key per point; sorting by key yields a uniform random permutation,
      // independent of how the points were constructed.
      keys: fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), {
        minLength: pts.length,
        maxLength: pts.length,
      }),
    });
  });

describe('P5.4 equidistant ties resolve to the lowest index (req 4.10)', () => {
  it('returns the lowest index among tied nearest points, independent of bucket order', () => {
    fc.assert(
      fc.property(scenarioArb, ({ q, maxPx, cellPx, points, keys }) => {
        // Shuffle so the lowest-index tied point can land in any position and in
        // any grid cell — the tie-break must not depend on insertion order.
        const order = points
          .map((p, i) => ({ p, k: keys[i] }))
          .sort((l, r) => l.k - r.k)
          .map((e) => e.p);

        const expected = expectedLowestIndex(order, q.x, q.y, maxPx);

        const h = buildSpatialHash(order, cellPx);
        expect(queryNearest(h, q.x, q.y, maxPx)).toBe(expected);
      }),
      { numRuns: 1000 },
    );
  });

  it('agrees whether built from points or from a packed buffer', () => {
    // The packed and object builders must produce identical tie-breaking.
    fc.assert(
      fc.property(scenarioArb, ({ q, maxPx, cellPx, points, keys }) => {
        const order = points
          .map((p, i) => ({ p, k: keys[i] }))
          .sort((l, r) => l.k - r.k)
          .map((e) => e.p);

        const expected = expectedLowestIndex(order, q.x, q.y, maxPx);

        const packed = new Float32Array(order.length * 2);
        for (let i = 0; i < order.length; i++) {
          packed[2 * i] = order[i].x;
          packed[2 * i + 1] = order[i].y;
        }
        const h = buildSpatialHashPacked(packed, cellPx);
        expect(queryNearest(h, q.x, q.y, maxPx)).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });

  // Concrete, human-readable anchors for the property above.
  it('prefers the lowest index even when its cell is visited last', () => {
    // (60,0) -> cell (1,0); (-60,0) -> cell (-2,0). The scan walks cells from the
    // most-negative dx first, so index 1 is *encountered* before index 0, yet the
    // equal distance (60) must still resolve to index 0.
    const h = buildSpatialHash(
      [
        { x: 60, y: 0 }, // index 0, distance 60
        { x: -60, y: 0 }, // index 1, distance 60 (its cell iterates first)
      ],
      48,
    );
    expect(queryNearest(h, 0, 0, 88)).toBe(0);
  });

  it('breaks a four-way symmetric tie toward index 0', () => {
    const h = buildSpatialHash(
      [
        { x: 50, y: 0 }, // index 0
        { x: -50, y: 0 }, // index 1
        { x: 0, y: 50 }, // index 2
        { x: 0, y: -50 }, // index 3
      ],
      48,
    );
    expect(queryNearest(h, 0, 0, 88)).toBe(0);
  });

  it('breaks an exact-duplicate (same-cell) tie toward the lowest index', () => {
    const h = buildSpatialHash(
      [
        { x: 100, y: 0 }, // index 0, far
        { x: 10, y: 10 }, // index 1, tied
        { x: 10, y: 10 }, // index 2, identical position -> tie with index 1
        { x: 10, y: 10 }, // index 3, identical position -> tie with index 1
      ],
      48,
    );
    expect(queryNearest(h, 0, 0, 88)).toBe(1);
  });
});
