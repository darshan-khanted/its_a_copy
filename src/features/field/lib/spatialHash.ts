/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Proximity scan core: a uniform spatial hash and a deterministic nearest-point
 * query (design §C.6, §H.2; reqs 4.7, 4.8, 4.10, 4.11; NFR-1.5).
 *
 * This module is PURE and I/O-free (req 30.11): no DOM reads, no `requestAnimationFrame`,
 * no React. That is deliberate — the nearest-node lookup is the thing the Scan
 * property tests P5.1–P5.5 (tasks 3.16–3.20) drive directly, so it must be a
 * deterministic pure function. All React/DOM glue lives in the `useProximityScan`
 * hook, which imports from here.
 *
 * Why a spatial hash and not the prototype's per-node `getBoundingClientRect()`:
 * the prototype forced synchronous layout for every node on every pointer move —
 * O(n) forced layout per frame and the single thing from the prototype that must
 * not be ported. Here, node positions are cached at projection time (we already
 * computed them), the search visits only a bounded ring of grid cells around the
 * query point, and comparisons use SQUARED distances so no `sqrt` runs in the hot
 * loop.
 */

/** The prototype's proximity radius. Nearest node within this many px is active. */
export const DEFAULT_SCAN_RADIUS_PX = 88;

/** Default grid cell size in field-space pixels (design §C.5 clustering also uses 48). */
export const DEFAULT_CELL_PX = 48;

export interface Point2D {
  x: number;
  y: number;
}

export interface SpatialHash {
  /** Grid cell size in pixels. */
  readonly cellPx: number;
  /** packed(cx, cy) → signal indices (ascending, since built in index order). */
  readonly buckets: Map<number, number[]>;
  /** Flat, screen-relative pixel positions: [x0, y0, x1, y1, ...]. */
  readonly positions: Float32Array;
  /** Number of points (`positions.length / 2`). */
  readonly count: number;
}

// Cell packing. Field-space pixel coordinates are bounded (a viewport is at most a
// few thousand px), so cell indices comfortably fit in [-32768, 32767]. This gives
// a collision-free integer key — never a lossy hash — so `queryNearest` can be
// proven to agree with brute force (property P5.2).
const CELL_OFFSET = 0x8000; // 32768
const CELL_STRIDE = 0x10000; // 65536

function packCell(cx: number, cy: number): number {
  return (cx + CELL_OFFSET) * CELL_STRIDE + (cy + CELL_OFFSET);
}

function cellIndex(v: number, cellPx: number): number {
  return Math.floor(v / cellPx);
}

/**
 * Build a spatial hash from a flat, packed positions buffer `[x0,y0,x1,y1,...]`.
 * The buffer is stored by reference (not copied) so the hot path allocates nothing.
 *
 * Precondition: `positions.length` is even.
 */
export function buildSpatialHashPacked(
  positions: Float32Array,
  cellPx: number = DEFAULT_CELL_PX,
): SpatialHash {
  if (positions.length % 2 !== 0) {
    throw new Error('buildSpatialHashPacked: positions.length must be even');
  }
  if (!(cellPx > 0)) {
    throw new Error('buildSpatialHashPacked: cellPx must be > 0');
  }
  const count = positions.length / 2;
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const x = positions[2 * i];
    const y = positions[2 * i + 1];
    // Skip non-finite positions rather than corrupting a bucket key.
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const key = packCell(cellIndex(x, cellPx), cellIndex(y, cellPx));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }
  return { cellPx, buckets, positions, count };
}

/**
 * Build a spatial hash from an array of `{x, y}` points. Convenience wrapper that
 * packs into a `Float32Array` first.
 */
export function buildSpatialHash(
  pts: ReadonlyArray<Point2D>,
  cellPx: number = DEFAULT_CELL_PX,
): SpatialHash {
  const positions = new Float32Array(pts.length * 2);
  for (let i = 0; i < pts.length; i++) {
    positions[2 * i] = pts[i].x;
    positions[2 * i + 1] = pts[i].y;
  }
  return buildSpatialHashPacked(positions, cellPx);
}

/**
 * Return the index of the nearest point to `(x, y)` within `maxPx`, or `null` if
 * no point lies within that radius.
 *
 * Guarantees (design §H.2, properties P5.1–P5.4):
 * - Deterministic: identical inputs always return the same index.
 * - Ties (exactly equal distance) resolve to the LOWEST index, independent of the
 *   `Map` bucket iteration order.
 * - Never returns a point whose distance from `(x, y)` exceeds `maxPx`.
 * - Agrees with an exhaustive linear scan over the same points.
 *
 * Precondition: `maxPx > 0`.
 */
export function queryNearest(
  h: SpatialHash,
  x: number,
  y: number,
  maxPx: number,
): number | null {
  if (!(maxPx > 0)) {
    throw new Error('queryNearest: maxPx must be > 0');
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const ring = Math.ceil(maxPx / h.cellPx); // cells to search in each direction
  const cx = cellIndex(x, h.cellPx);
  const cy = cellIndex(y, h.cellPx);

  let best = maxPx * maxPx; // squared — no sqrt in the hot loop
  let bestIdx: number | null = null;

  for (let dy = -ring; dy <= ring; dy++) {
    for (let dx = -ring; dx <= ring; dx++) {
      const bucket = h.buckets.get(packCell(cx + dx, cy + dy));
      if (bucket === undefined) continue;

      for (let b = 0; b < bucket.length; b++) {
        const i = bucket[b];
        const ex = h.positions[2 * i] - x;
        const ey = h.positions[2 * i + 1] - y;
        const d2 = ex * ex + ey * ey;
        // `d2 < best` keeps the strictly nearer point; on an exact tie prefer the
        // lower index so the result is independent of cell/bucket scan order.
        if (d2 < best || (d2 === best && bestIdx !== null && i < bestIdx)) {
          best = d2;
          bestIdx = i;
        }
      }
    }
  }

  return bestIdx;
}

/**
 * Reference implementation used by tests and as a correctness oracle: an exhaustive
 * linear scan with identical tie-breaking. `queryNearest` MUST agree with this for
 * every input (property P5.2).
 */
export function queryNearestBruteForce(
  positions: Float32Array,
  x: number,
  y: number,
  maxPx: number,
): number | null {
  if (!(maxPx > 0)) {
    throw new Error('queryNearestBruteForce: maxPx must be > 0');
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const count = positions.length / 2;
  let best = maxPx * maxPx;
  let bestIdx: number | null = null;
  for (let i = 0; i < count; i++) {
    const px = positions[2 * i];
    const py = positions[2 * i + 1];
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const ex = px - x;
    const ey = py - y;
    const d2 = ex * ex + ey * ey;
    if (d2 < best || (d2 === best && bestIdx !== null && i < bestIdx)) {
      best = d2;
      bestIdx = i;
    }
  }
  return bestIdx;
}
