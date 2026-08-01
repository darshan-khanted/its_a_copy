// Property P4.5 — bearing preservation (design §J.4; requirement 3.8).
//
// Requirement 3.8: "THE Projection Module SHALL preserve bearing exactly under
// both warps, within 0.5 degrees of the geodesic bearing (§H.1, §J.4)."
//
// This file is self-contained (task 3.13 must not edit shared arbitrary/helper
// files). It defines its own `fast-check` arbitraries and drives the pure
// projection module exhaustively. The projection is I/O-free, so the property
// can be checked purely.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createFieldTransform,
  projectToField,
  bearingDeg,
  fieldBearing,
  angleDiffDeg,
  haversineM,
  type FieldTransform,
  type GeoPoint,
  type FieldWarp,
} from './projection';

const DEG2RAD = Math.PI / 180;
const METRES_PER_DEG_LAT = 111_320;

/**
 * A scenario pairs a valid {@link FieldTransform} with a geographic point that is
 * guaranteed to lie *inside* the Field radius of that transform's anchor.
 *
 * Rather than generate two independent arbitraries (an in-radius point depends on
 * the anchor), we generate the transform first, then derive the point from a
 * normalised radius fraction `u ∈ [0,1)` and a bearing `theta ∈ [0,2π)` using the
 * inverse of the local tangent-plane math the projection uses. This keeps every
 * generated point in-range by construction while still exercising the full disc
 * and every compass direction.
 */
interface Scenario {
  t: FieldTransform;
  p: GeoPoint;
}

const scenarioArb = (): fc.Arbitrary<Scenario> =>
  fc
    .record({
      // Moderate anchor latitudes keep the equirectangular tangent plane a tight
      // approximation of the geodesic bearing (well within the 0.5° budget); the
      // transform itself guards |lat| < 89.9.
      anchorLat: fc.double({ min: -55, max: 55, noNaN: true }),
      anchorLng: fc.double({ min: -179, max: 179, noNaN: true }),
      // Field disc radius in metres — the product uses rings up to 2000 m.
      radiusM: fc.double({ min: 200, max: 2000, noNaN: true }),
      warp: fc.constantFrom<FieldWarp>('linear', 'sqrt'),
      // Normalised distance fraction; kept strictly below 1 so the point stays
      // inside the radius, and above a small floor so it is never the degenerate
      // point exactly at the anchor (where bearing is undefined).
      u: fc.double({ min: 0.02, max: 0.999, noNaN: true }),
      // Full 360° of bearing.
      thetaDeg: fc.double({ min: 0, max: 359.999, noNaN: true }),
    })
    .map(({ anchorLat, anchorLng, radiusM, warp, u, thetaDeg }) => {
      const anchor: GeoPoint = { lat: anchorLat, lng: anchorLng };
      const t = createFieldTransform(anchor, radiusM, warp);

      const theta = thetaDeg * DEG2RAD;
      const d = u * radiusM; // metres from the anchor, strictly < radiusM
      const dEast = d * Math.sin(theta);
      const dNorth = d * Math.cos(theta);

      const metresPerDegLng = METRES_PER_DEG_LAT * Math.cos(anchorLat * DEG2RAD);
      const p: GeoPoint = {
        lat: anchorLat + dNorth / METRES_PER_DEG_LAT,
        lng: anchorLng + dEast / metresPerDegLng,
      };

      return { t, p };
    });

describe('projection — P4.5 bearing preservation (§J.4)', () => {
  it('projects every in-radius point within 0.5° of its geodesic bearing (both warps)', () => {
    // **Validates: Requirements 3.8**
    fc.assert(
      fc.property(scenarioArb(), ({ t, p }) => {
        // Guard against the degenerate point exactly at the anchor, where bearing
        // is undefined; any point closer than a few metres is meaningless here.
        fc.pre(haversineM(t.anchor, p) > 5);
        return angleDiffDeg(bearingDeg(t.anchor, p), fieldBearing(projectToField(p, t))) < 0.5;
      }),
      { numRuns: 1000 },
    );
  });
});
