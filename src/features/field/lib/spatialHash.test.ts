import { describe, expect, it } from 'vitest';
import {
  buildSpatialHash,
  buildSpatialHashPacked,
  queryNearest,
  queryNearestBruteForce,
} from './spatialHash';

describe('buildSpatialHash', () => {
  it('rejects an odd-length positions buffer', () => {
    expect(() => buildSpatialHashPacked(new Float32Array([1, 2, 3]))).toThrow();
  });

  it('rejects a non-positive cell size', () => {
    expect(() => buildSpatialHash([{ x: 0, y: 0 }], 0)).toThrow();
  });

  it('records the point count', () => {
    const h = buildSpatialHash([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(h.count).toBe(2);
  });
});

describe('queryNearest', () => {
  it('returns null when there are no points', () => {
    const h = buildSpatialHash([]);
    expect(queryNearest(h, 5, 5, 88)).toBeNull();
  });

  it('returns the nearest point within the radius', () => {
    const h = buildSpatialHash([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 12, y: 0 },
    ]);
    expect(queryNearest(h, 10, 0, 88)).toBe(2); // (12,0) is closest to (10,0)
  });

  it('never returns a point outside the search radius (P5.3 shape)', () => {
    const h = buildSpatialHash([{ x: 500, y: 500 }]);
    expect(queryNearest(h, 0, 0, 88)).toBeNull();
  });

  it('resolves exact ties to the lowest index (P5.4 shape)', () => {
    // Two points equidistant from the query point.
    const h = buildSpatialHash([
      { x: 10, y: 0 }, // index 0, distance 10
      { x: -10, y: 0 }, // index 1, distance 10
    ]);
    expect(queryNearest(h, 0, 0, 88)).toBe(0);
  });

  it('is deterministic across repeated calls (P5.1 shape)', () => {
    const h = buildSpatialHash([
      { x: 3, y: 4 },
      { x: 3, y: 4 },
      { x: 40, y: 9 },
    ]);
    const first = queryNearest(h, 0, 0, 88);
    for (let i = 0; i < 50; i++) {
      expect(queryNearest(h, 0, 0, 88)).toBe(first);
    }
  });

  it('requires a positive radius', () => {
    const h = buildSpatialHash([{ x: 0, y: 0 }]);
    expect(() => queryNearest(h, 0, 0, 0)).toThrow();
  });

  it('handles negative coordinates (cells left/above the origin)', () => {
    const h = buildSpatialHash([
      { x: -120, y: -80 },
      { x: -130, y: -85 },
    ]);
    expect(queryNearest(h, -122, -81, 88)).toBe(0);
  });

  it('agrees with brute force over a scattered set (P5.2 shape)', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 47, y: 47 },
      { x: 48, y: 0 },
      { x: 96, y: 96 },
      { x: 200, y: 10 },
      { x: 5, y: 90 },
      { x: 90, y: 5 },
    ];
    const h = buildSpatialHash(pts);
    const positions = new Float32Array(pts.flatMap((p) => [p.x, p.y]));
    for (let qx = -20; qx <= 220; qx += 13) {
      for (let qy = -20; qy <= 120; qy += 11) {
        expect(queryNearest(h, qx, qy, 88)).toBe(
          queryNearestBruteForce(positions, qx, qy, 88),
        );
      }
    }
  });

  it('skips non-finite positions rather than corrupting a bucket', () => {
    const positions = new Float32Array([NaN, NaN, 10, 0]);
    const h = buildSpatialHashPacked(positions);
    expect(queryNearest(h, 9, 0, 88)).toBe(1);
  });
});
