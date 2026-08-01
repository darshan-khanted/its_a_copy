import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RING_RADII_M,
  FIELD_WARP,
  fieldRings,
  nodePositionsPx,
  normalisedRadius,
  positionPercent,
} from './surface';
import { createFieldTransform, projectToField } from './projection';

const ANCHOR = { lat: 12.9121, lng: 77.6446 };
const transform = createFieldTransform(ANCHOR, 2000, FIELD_WARP);

describe('distance rings (req 3.3)', () => {
  it('draws 250 / 500 / 1000 / 2000 m with mono labels', () => {
    const rings = fieldRings(transform);
    expect(rings.map((r) => r.radiusM)).toEqual([...DEFAULT_RING_RADII_M]);
    expect(rings.map((r) => r.label)).toEqual(['250 M', '500 M', '1 KM', '2 KM']);
  });

  it('places the outermost ring exactly on the disc boundary', () => {
    const rings = fieldRings(transform);
    expect(rings[rings.length - 1].radiusPct).toBeCloseTo(50, 10);
  });

  it('warps a ring exactly as a node at that distance is warped', () => {
    // A point 500 m due north of the anchor must land on the 500 m ring.
    const north500 = { lat: ANCHOR.lat + 500 / 111_320, lng: ANCHOR.lng };
    const projected = projectToField(north500, transform);
    const ring = fieldRings(transform).find((r) => r.radiusM === 500)!;
    expect(normalisedRadius(projected) * 50).toBeCloseTo(ring.radiusPct, 2);
  });

  it('drops rings beyond the Field radius rather than stacking them on the boundary', () => {
    const small = createFieldTransform(ANCHOR, 600, FIELD_WARP);
    expect(fieldRings(small).map((r) => r.radiusM)).toEqual([250, 500]);
  });

  it('orders rings strictly outward', () => {
    const rings = fieldRings(transform);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i].radiusPct).toBeGreaterThan(rings[i - 1].radiusPct);
    }
  });
});

describe('cached node positions (req 4.8)', () => {
  it('packs positions as [x0,y0,x1,y1,...] scaled to the measured size', () => {
    const px = nodePositionsPx([{ fx: 0.5, fy: 0.5 }, { fx: 0.25, fy: 1 }], 400);
    expect(Array.from(px)).toEqual([200, 200, 100, 400]);
  });

  it('scales x and y independently when the element is not square', () => {
    const px = nodePositionsPx([{ fx: 0.5, fy: 0.5 }], 400, 200);
    expect(Array.from(px)).toEqual([200, 100]);
  });

  it('degrades to zeros before the element has been measured', () => {
    const px = nodePositionsPx([{ fx: 0.5, fy: 0.5 }], 0);
    expect(Array.from(px)).toEqual([0, 0]);
  });
});

describe('percent positioning and radius', () => {
  it('maps the anchor to the centre of the square', () => {
    expect(positionPercent({ fx: 0.5, fy: 0.5 })).toEqual({ left: '50%', top: '50%' });
  });

  it('reads 0 at the anchor and 1 on the disc boundary', () => {
    expect(normalisedRadius({ fx: 0.5, fy: 0.5 })).toBe(0);
    expect(normalisedRadius({ fx: 1, fy: 0.5 })).toBeCloseTo(1, 10);
  });

  it('never exceeds 1, even for a corner point outside the disc', () => {
    expect(normalisedRadius({ fx: 0, fy: 0 })).toBe(1);
  });
});
