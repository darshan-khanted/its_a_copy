import { describe, expect, it } from 'vitest';
import {
  nodeBearingDeg,
  nextClockwise,
  nextCounterClockwise,
  nextCloser,
  nextFurther,
  nearestToAnchor,
  traverse,
  type FieldNodeGeometry,
} from './traversal';

// Helpers placing a node at a bearing/radius around the anchor (0.5, 0.5).
function at(bearingDeg: number, radius = 0.3): FieldNodeGeometry {
  const rad = (bearingDeg * Math.PI) / 180;
  return { fx: 0.5 + radius * Math.sin(rad), fy: 0.5 - radius * Math.cos(rad) };
}

describe('nodeBearingDeg', () => {
  it('measures 0 = north, clockwise', () => {
    expect(nodeBearingDeg({ fx: 0.5, fy: 0.1 })).toBeCloseTo(0, 5); // due north (up)
    expect(nodeBearingDeg({ fx: 0.9, fy: 0.5 })).toBeCloseTo(90, 5); // due east
    expect(nodeBearingDeg({ fx: 0.5, fy: 0.9 })).toBeCloseTo(180, 5); // due south
    expect(nodeBearingDeg({ fx: 0.1, fy: 0.5 })).toBeCloseTo(270, 5); // due west
  });
});

describe('nextClockwise / nextCounterClockwise', () => {
  const nodes = [at(0), at(90), at(180), at(270)]; // N, E, S, W

  it('steps to the next node clockwise', () => {
    expect(nextClockwise(nodes, 0)).toBe(1); // N -> E
    expect(nextClockwise(nodes, 1)).toBe(2); // E -> S
    expect(nextClockwise(nodes, 3)).toBe(0); // W -> N (wrap)
  });

  it('steps to the next node counter-clockwise', () => {
    expect(nextCounterClockwise(nodes, 0)).toBe(3); // N -> W
    expect(nextCounterClockwise(nodes, 2)).toBe(1); // S -> E
  });

  it('breaks bearing ties to the lowest index', () => {
    const dup = [at(90), at(90), at(180)]; // two nodes at identical bearing
    // From index 2 (S), clockwise wraps to the E pair; the lower index wins.
    expect(nextClockwise(dup, 2)).toBe(0);
  });

  it('returns null for an out-of-range current index', () => {
    expect(nextClockwise(nodes, 99)).toBeNull();
    expect(nextClockwise([], 0)).toBeNull();
  });
});

describe('nextCloser / nextFurther', () => {
  const nodes = [
    { fx: 0.5, fy: 0.4 }, // r = 0.1
    { fx: 0.5, fy: 0.2 }, // r = 0.3
    { fx: 0.5, fy: 0.0 }, // r = 0.5
  ];

  it('moves to the immediate inward neighbour', () => {
    expect(nextCloser(nodes, 2)).toBe(1);
    expect(nextCloser(nodes, 1)).toBe(0);
    expect(nextCloser(nodes, 0)).toBeNull(); // nothing closer
  });

  it('moves to the immediate outward neighbour', () => {
    expect(nextFurther(nodes, 0)).toBe(1);
    expect(nextFurther(nodes, 1)).toBe(2);
    expect(nextFurther(nodes, 2)).toBeNull(); // nothing further
  });

  it('breaks radial ties to the lowest index', () => {
    const ties = [
      { fx: 0.5, fy: 0.1 }, // r = 0.4
      { fx: 0.9, fy: 0.5 }, // r = 0.4
      { fx: 0.5, fy: 0.5 }, // r = 0 (anchor)
    ];
    // From the anchor, the immediate outward step lands on the lowest-index tie.
    expect(nextFurther(ties, 2)).toBe(0);
  });
});

describe('nearestToAnchor / traverse', () => {
  it('finds the node closest to the anchor', () => {
    const nodes = [at(0, 0.5), at(90, 0.1), at(180, 0.3)];
    expect(nearestToAnchor(nodes)).toBe(1);
    expect(nearestToAnchor([])).toBeNull();
  });

  it('dispatches by direction', () => {
    const nodes = [at(0), at(90), at(180), at(270)];
    expect(traverse(nodes, 0, 'clockwise')).toBe(nextClockwise(nodes, 0));
    expect(traverse(nodes, 0, 'counter-clockwise')).toBe(nextCounterClockwise(nodes, 0));
  });
});
