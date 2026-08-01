// Property P4.4 — Both warps preserve strict distance ordering.
//
// **Validates: Requirements 3.6**
//
// Design §C.2 / §H.1 / §J.4: the Field must never lie about who is closer. For
// any two geographic points inside the Field radius with distinct true distances
// from the anchor, the point that is geographically closer must project to a
// strictly smaller radial distance on the Field — and this must hold under BOTH
// the 'linear' and the 'sqrt' radial warp, because `sqrt` is strictly increasing
// on [0,1] and the warp is purely radial.
//
// Property statement (design §J.4, P4.4):
//   for a transform t and in-radius points a, b with |dist(a) - dist(b)| > 1 m,
//   (haversine(anchor,a) < haversine(anchor,b)) === (radialDist(project(a)) < radialDist(project(b)))
//
// The generator constructs each point via an independent geodesic destination
// formula (not the projection module under test) and measures true distance with
// `haversineM`, so the assertion is not tautological with the transform's own
// tangent-plane maths.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createFieldTransform,
  projectToField,
  haversineM,
  radialDist,
  type FieldWarp,
  type GeoPoint,
} from './projection';

const EARTH_RADIUS_M = 6_371_000;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const WARPS: readonly FieldWarp[] = ['linear', 'sqrt'];

/**
 * Great-circle destination point given an origin, a distance, and a bearing.
 * Deliberately independent of the projection module so the ordering assertion
 * measures real geodesic distance rather than the transform's own approximation.
 */
function destination(anchor: GeoPoint, distanceM: number, bearingDeg: number): GeoPoint {
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = bearingDeg * DEG2RAD;
  const phi1 = anchor.lat * DEG2RAD;
  const lam1 = anchor.lng * DEG2RAD;

  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(Math.min(1, Math.max(-1, sinPhi2)));
  const lam2 =
    lam1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * sinPhi2,
    );

  return {
    lat: phi2 * RAD2DEG,
    // normalise longitude back into [-180, 180)
    lng: ((lam2 * RAD2DEG + 540) % 360) - 180,
  };
}

// Anchors well away from the poles (the transform's cos-φ longitude scale is only
// meaningful there); India lives comfortably inside this box.
const anchorArb = fc.record({
  lat: fc.double({ min: -60, max: 60, noNaN: true }),
  lng: fc.double({ min: -179, max: 179, noNaN: true }),
});

const radiusArb = fc.double({ min: 100, max: 5000, noNaN: true });

// A point strictly inside the Field radius: a fraction of the radius (kept below
// 1 so it never clamps to the disc boundary) plus a bearing.
const inRadiusArb = fc.record({
  frac: fc.double({ min: 0, max: 0.999, noNaN: true }),
  bearing: fc.double({ min: 0, max: 360, noNaN: true }),
});

function orderingProperty(warp: FieldWarp) {
  return fc.property(anchorArb, radiusArb, inRadiusArb, inRadiusArb, (anchor, radiusM, pa, pb) => {
    const t = createFieldTransform(anchor, radiusM, warp);

    const a = destination(anchor, pa.frac * radiusM, pa.bearing);
    const b = destination(anchor, pb.frac * radiusM, pb.bearing);

    const da = haversineM(anchor, a);
    const db = haversineM(anchor, b);

    // Only assert on distinct in-radius distances (req 3.6): a >1 m gap keeps the
    // pair clear of float noise and of the haversine-vs-tangent-plane discrepancy
    // (< 0.1 m over a 2 km radius), and both points staying within the radius
    // means neither clamps to the boundary.
    fc.pre(Math.abs(da - db) > 1);
    fc.pre(da <= radiusM && db <= radiusM);

    const ra = radialDist(projectToField(a, t));
    const rb = radialDist(projectToField(b, t));

    // The closer point projects strictly nearer the centre; the farther point
    // strictly farther. Strict ordering both ways ⇒ greater distance always
    // yields greater-or-equal (here strictly greater) radial distance.
    return (da < db) === (ra < rb);
  });
}

describe('P4.4 radial ordering — both warps preserve strict distance ordering (req 3.6)', () => {
  for (const warp of WARPS) {
    it(`preserves strict distance ordering under the '${warp}' warp`, () => {
      expect(() => fc.assert(orderingProperty(warp), { numRuns: 1000 })).not.toThrow();
    });
  }

  it('preserves ordering when the warp itself is chosen arbitrarily', () => {
    const prop = fc.property(
      fc.constantFrom<FieldWarp>(...WARPS),
      anchorArb,
      radiusArb,
      inRadiusArb,
      inRadiusArb,
      (warp, anchor, radiusM, pa, pb) => {
        const t = createFieldTransform(anchor, radiusM, warp);
        const a = destination(anchor, pa.frac * radiusM, pa.bearing);
        const b = destination(anchor, pb.frac * radiusM, pb.bearing);
        const da = haversineM(anchor, a);
        const db = haversineM(anchor, b);
        fc.pre(Math.abs(da - db) > 1);
        fc.pre(da <= radiusM && db <= radiusM);
        const ra = radialDist(projectToField(a, t));
        const rb = radialDist(projectToField(b, t));
        return (da < db) === (ra < rb);
      },
    );
    expect(() => fc.assert(prop, { numRuns: 1000 })).not.toThrow();
  });
});
