// Unit tests for the pure geo <-> Field projection (design §H.1; req 3.2-3.8).
// Concrete examples and edge cases; the exhaustive invariants live in the
// property suites P4.1-P4.6 (tasks 3.9-3.14).

import { describe, expect, it } from 'vitest';
import {
  FIELD_DISC_RADIUS,
  METRES_PER_DEG_LAT,
  angleDiffDeg,
  bearingDeg,
  createFieldTransform,
  fieldBearing,
  haversineM,
  projectToField,
  radialDist,
  unprojectFromField,
  type GeoPoint,
} from '@/features/field/lib/projection';

// A representative Indian hood anchor (Koramangala, Bengaluru).
const ANCHOR: GeoPoint = { lat: 12.9352, lng: 77.6245 };
const RADIUS_M = 2000;

describe('createFieldTransform', () => {
  it('derives longitude scale from the anchor latitude', () => {
    const t = createFieldTransform(ANCHOR, RADIUS_M);
    expect(t.metresPerDegLat).toBe(METRES_PER_DEG_LAT);
    expect(t.metresPerDegLng).toBeCloseTo(METRES_PER_DEG_LAT * Math.cos((ANCHOR.lat * Math.PI) / 180), 6);
    expect(t.warp).toBe('linear');
  });

  it('rejects a non-positive radius', () => {
    expect(() => createFieldTransform(ANCHOR, 0)).toThrow(RangeError);
    expect(() => createFieldTransform(ANCHOR, -100)).toThrow(RangeError);
  });

  it('rejects an anchor near the poles', () => {
    expect(() => createFieldTransform({ lat: 90, lng: 0 }, RADIUS_M)).toThrow(RangeError);
  });
});

describe('projectToField', () => {
  it('maps the anchor exactly to the centre (req 3.7)', () => {
    const t = createFieldTransform(ANCHOR, RADIUS_M);
    const f = projectToField(ANCHOR, t);
    expect(f.fx).toBeCloseTo(0.5, 12);
    expect(f.fy).toBeCloseTo(0.5, 12);
  });

  it('places due-north above centre and due-east right of centre', () => {
    const t = createFieldTransform(ANCHOR, RADIUS_M);
    const north: GeoPoint = { lat: ANCHOR.lat + 0.005, lng: ANCHOR.lng };
    const east: GeoPoint = { lat: ANCHOR.lat, lng: ANCHOR.lng + 0.005 };

    const fn = projectToField(north, t);
    expect(fn.fy).toBeLessThan(0.5); // smaller fy == higher on screen
    expect(fn.fx).toBeCloseTo(0.5, 6);

    const fe = projectToField(east, t);
    expect(fe.fx).toBeGreaterThan(0.5);
    expect(fe.fy).toBeCloseTo(0.5, 6);
  });

  it('clamps a point beyond the radius to the disc boundary without dropping it (req 3.5)', () => {
    const t = createFieldTransform(ANCHOR, RADIUS_M);
    // ~5 km north, well outside the 2 km disc.
    const far: GeoPoint = { lat: ANCHOR.lat + 0.045, lng: ANCHOR.lng };
    const f = projectToField(far, t);
    expect(radialDist(f)).toBeCloseTo(FIELD_DISC_RADIUS, 9);
    expect(f.fx).toBeGreaterThanOrEqual(0);
    expect(f.fx).toBeLessThanOrEqual(1);
    expect(f.fy).toBeGreaterThanOrEqual(0);
    expect(f.fy).toBeLessThanOrEqual(1);
  });

  it('preserves distance ordering under both warps (req 3.6)', () => {
    const near: GeoPoint = { lat: ANCHOR.lat + 0.002, lng: ANCHOR.lng };
    const far: GeoPoint = { lat: ANCHOR.lat + 0.008, lng: ANCHOR.lng };
    for (const warp of ['linear', 'sqrt'] as const) {
      const t = createFieldTransform(ANCHOR, RADIUS_M, warp);
      expect(radialDist(projectToField(near, t))).toBeLessThan(radialDist(projectToField(far, t)));
    }
  });

  it('sqrt warp pushes an in-disc point strictly further out than linear', () => {
    const p: GeoPoint = { lat: ANCHOR.lat + 0.004, lng: ANCHOR.lng };
    const linear = radialDist(projectToField(p, createFieldTransform(ANCHOR, RADIUS_M, 'linear')));
    const sqrt = radialDist(projectToField(p, createFieldTransform(ANCHOR, RADIUS_M, 'sqrt')));
    expect(sqrt).toBeGreaterThan(linear);
  });
});

describe('unprojectFromField round trip (req 3.7)', () => {
  for (const warp of ['linear', 'sqrt'] as const) {
    it(`recovers an in-radius point within tolerance (${warp} warp)`, () => {
      const t = createFieldTransform(ANCHOR, RADIUS_M, warp);
      const p: GeoPoint = { lat: ANCHOR.lat + 0.006, lng: ANCHOR.lng - 0.004 };
      const back = unprojectFromField(projectToField(p, t), t);
      expect(haversineM(p, back)).toBeLessThanOrEqual(Math.max(1, RADIUS_M * 1e-6));
    });
  }

  it('round-trips the anchor exactly back to the anchor', () => {
    const t = createFieldTransform(ANCHOR, RADIUS_M);
    const back = unprojectFromField(projectToField(ANCHOR, t), t);
    expect(haversineM(ANCHOR, back)).toBeLessThanOrEqual(1);
  });
});

describe('bearing preservation (req 3.8)', () => {
  it('field bearing matches geodesic bearing within 0.5 degrees for cardinal points', () => {
    const t = createFieldTransform(ANCHOR, RADIUS_M);
    const samples: GeoPoint[] = [
      { lat: ANCHOR.lat + 0.006, lng: ANCHOR.lng }, // N
      { lat: ANCHOR.lat, lng: ANCHOR.lng + 0.006 }, // E
      { lat: ANCHOR.lat - 0.006, lng: ANCHOR.lng }, // S
      { lat: ANCHOR.lat, lng: ANCHOR.lng - 0.006 }, // W
      { lat: ANCHOR.lat + 0.004, lng: ANCHOR.lng + 0.004 }, // NE
    ];
    for (const p of samples) {
      const diff = angleDiffDeg(bearingDeg(ANCHOR, p), fieldBearing(projectToField(p, t)));
      expect(diff).toBeLessThan(0.5);
    }
  });
});

describe('bearingDeg', () => {
  it('reports 0 for north, 90 for east, 180 for south, 270 for west', () => {
    expect(bearingDeg(ANCHOR, { lat: ANCHOR.lat + 0.01, lng: ANCHOR.lng })).toBeCloseTo(0, 1);
    expect(bearingDeg(ANCHOR, { lat: ANCHOR.lat, lng: ANCHOR.lng + 0.01 })).toBeCloseTo(90, 1);
    expect(bearingDeg(ANCHOR, { lat: ANCHOR.lat - 0.01, lng: ANCHOR.lng })).toBeCloseTo(180, 1);
    expect(bearingDeg(ANCHOR, { lat: ANCHOR.lat, lng: ANCHOR.lng - 0.01 })).toBeCloseTo(270, 1);
  });
});

describe('haversineM', () => {
  it('is zero for identical points and symmetric', () => {
    expect(haversineM(ANCHOR, ANCHOR)).toBe(0);
    const b: GeoPoint = { lat: ANCHOR.lat + 0.01, lng: ANCHOR.lng + 0.01 };
    expect(haversineM(ANCHOR, b)).toBeCloseTo(haversineM(b, ANCHOR), 9);
  });

  it('measures roughly 111 m per 0.001 degree of latitude', () => {
    const d = haversineM(ANCHOR, { lat: ANCHOR.lat + 0.001, lng: ANCHOR.lng });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
});

describe('angleDiffDeg', () => {
  it('handles wrap-around and clamps to [0, 180]', () => {
    expect(angleDiffDeg(359, 1)).toBeCloseTo(2, 9);
    expect(angleDiffDeg(10, 350)).toBeCloseTo(20, 9);
    expect(angleDiffDeg(0, 180)).toBeCloseTo(180, 9);
    expect(angleDiffDeg(-10, 10)).toBeCloseTo(20, 9);
  });
});
