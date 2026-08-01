/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for Field clustering, the node budget, overflow ranking, and
 * ring-preserving collision control (design §C.5; reqs 5.1–5.5).
 */

import { describe, expect, it } from 'vitest';

import {
  CLUSTER_CELL_PX,
  DEFAULT_BOARD_ROUTE,
  MAX_REPULSION_ITERATIONS,
  MIN_SEPARATION_PX,
  NODE_BUDGET,
  bucketByCell,
  boardRouteFor,
  clusterField,
  clusterLabel,
  compactRupees,
  isClusterNode,
  rankSignals,
  relaxCollisions,
  sheetFor,
} from './clustering';
import { radialDist } from './projection';
import type { RealFieldSignal } from '@/types';

// ---- fixtures ---------------------------------------------------------------

const FIELD_PX = 480; // 10 cells of 48 px across

function signal(id: string, over: Partial<RealFieldSignal> = {}): RealFieldSignal {
  return {
    kind: 'REAL_GIG',
    id,
    fx: 0.5,
    fy: 0.5,
    distanceM: 500,
    bearingDeg: 0,
    price: 500,
    title: `gig ${id}`,
    tone: 'lime',
    urgent: false,
    ageMins: 30,
    rot: 0,
    locked: false,
    headStart: false,
    ...over,
  };
}

/** Golden-angle spiral inside the disc: distinct, deterministic, well spread. */
function spiral(count: number, priceOf: (i: number) => number = () => 500): RealFieldSignal[] {
  const out: RealFieldSignal[] = [];
  for (let i = 0; i < count; i++) {
    const theta = i * 2.399963229728653;
    const r = 0.5 * Math.sqrt((i + 1) / count);
    out.push(
      signal(`g${String(i).padStart(3, '0')}`, {
        fx: 0.5 + r * Math.cos(theta),
        fy: 0.5 + r * Math.sin(theta),
        price: priceOf(i),
        distanceM: Math.round(r * 4000),
        ageMins: i,
      }),
    );
  }
  return out;
}

function fieldRadius(p: { fx: number; fy: number }): number {
  return radialDist({ fx: p.fx, fy: p.fy });
}

// ---- req 5.2: 48 px cell clustering ----------------------------------------

describe('clustering — 48 px field-space cells (req 5.2)', () => {
  it('uses the 48 px cell size shared with the proximity scan hash', () => {
    expect(CLUSTER_CELL_PX).toBe(48);
  });

  it('collapses a cell holding two or more signals into one cluster node', () => {
    // x = 249.6 and 254.4 at 480 px → both in cell 5; y = 240 → cell 5.
    const signals = [
      signal('a', { fx: 0.52, fy: 0.5, price: 900 }),
      signal('b', { fx: 0.53, fy: 0.5, price: 1000 }),
    ];
    const field = clusterField(signals, { fieldSizePx: FIELD_PX });

    expect(field.nodes).toHaveLength(1);
    const node = field.nodes[0];
    expect(isClusterNode(node)).toBe(true);
    if (!isClusterNode(node)) throw new Error('expected a cluster node');
    expect(node.count).toBe(2);
    expect(node.totalValue).toBe(1900);
    expect(node.gigIds.sort()).toEqual(['a', 'b']);
  });

  it('keeps signals in different cells as separate single nodes', () => {
    const signals = [
      signal('a', { fx: 0.2, fy: 0.5 }), // cell (2, 5)
      signal('b', { fx: 0.5, fy: 0.5 }), // cell (5, 5)
    ];
    const field = clusterField(signals, { fieldSizePx: FIELD_PX });

    expect(field.nodes).toHaveLength(2);
    expect(field.nodes.every((n) => !isClusterNode(n))).toBe(true);
    expect(field.sheets).toHaveLength(0);
    expect(field.truncated).toBe(false);
    expect(field.truncationLine).toBeNull();
  });

  it('buckets cells in ascending (cx, cy) order', () => {
    const cells = bucketByCell(
      [
        signal('far', { fx: 0.9, fy: 0.5 }),
        signal('near', { fx: 0.1, fy: 0.5 }),
        signal('mid', { fx: 0.5, fy: 0.5 }),
      ],
      CLUSTER_CELL_PX,
      FIELD_PX,
    );
    expect(cells.map((c) => c.cx)).toEqual([1, 5, 9]);
  });

  it('labels a cluster disc with the count and the summed value', () => {
    expect(clusterLabel(4, 1900)).toBe('4 · ₹1.9k');
    expect(compactRupees(950)).toBe('₹950');
    expect(compactRupees(2000)).toBe('₹2k');
    expect(compactRupees(240000)).toBe('₹2.4L');
  });
});

// ---- req 5.3: cluster sheets ------------------------------------------------

describe('cluster sheets (req 5.3)', () => {
  it('gives a cluster node a sheet of Board rows, highest priority first', () => {
    const signals = [
      signal('cheap', { fx: 0.52, fy: 0.5, price: 100, ageMins: 600 }),
      signal('rich', { fx: 0.53, fy: 0.5, price: 5000, ageMins: 1, urgent: true }),
    ];
    const field = clusterField(signals, { fieldSizePx: FIELD_PX });
    const clusterId = field.nodes[0].id;

    const sheet = sheetFor(field, clusterId);
    expect(sheet).not.toBeNull();
    expect(sheet!.count).toBe(2);
    expect(sheet!.label).toBe(clusterLabel(2, 5100));
    expect(sheet!.rows.map((r) => r.signalId)).toEqual(['rich', 'cheap']);
    // Rows carry exactly what a Board row renders.
    expect(sheet!.rows[0]).toMatchObject({
      signalId: 'rich',
      title: 'gig rich',
      price: 5000,
      urgent: true,
    });
  });

  it('has no sheet for a single-signal node', () => {
    const field = clusterField([signal('solo')], { fieldSizePx: FIELD_PX });
    expect(sheetFor(field, 'solo')).toBeNull();
  });
});

// ---- req 5.1 / 5.4: node budget, ranking, reachability ---------------------

describe('node budget and overflow (reqs 5.1, 5.4)', () => {
  it('renders at most 60 nodes for a very busy hood', () => {
    const field = clusterField(spiral(240), { fieldSizePx: 4800 });
    expect(field.nodes.length).toBeLessThanOrEqual(NODE_BUDGET);
    expect(field.nodes).toHaveLength(NODE_BUDGET);
    expect(field.truncated).toBe(true);
  });

  it('states the truncation as SHOWING 60 OF N · OPEN BOARD FOR ALL', () => {
    const field = clusterField(spiral(143), { fieldSizePx: 4800 });
    expect(field.truncationLine).toBe('SHOWING 60 OF 143 · OPEN BOARD FOR ALL');
  });

  it('keeps every excluded signal reachable through a cluster sheet or the Board', () => {
    const signals = spiral(143);
    const field = clusterField(signals, { fieldSizePx: 4800, boardRoute: boardRouteFor('560001') });

    // Total coverage: no signal is silently dropped.
    expect(field.reachability.size).toBe(signals.length);
    for (const s of signals) {
      const where = field.reachability.get(s.id);
      expect(where).toBeDefined();
      if (where!.via === 'BOARD') {
        expect(where!.boardRoute).toBe('/hood/560001/board');
        expect(field.overflow.signalIds).toContain(s.id);
      } else {
        expect(field.nodes.some((n) => n.id === where!.nodeId)).toBe(true);
      }
    }
    expect(field.overflow.count).toBe(field.overflow.signalIds.length);
    expect(field.renderedSignals + field.overflow.count).toBe(signals.length);
    expect(field.overflow.count).toBeGreaterThan(0);
  });

  it('defaults the overflow route to the Board', () => {
    const field = clusterField(spiral(80), { fieldSizePx: 4800 });
    expect(field.overflow.boardRoute).toBe(DEFAULT_BOARD_ROUTE);
  });

  it('ranks by recency, price, proximity, and urgency', () => {
    const ranked = rankSignals([
      signal('stale-far-cheap', { price: 100, distanceM: 4000, ageMins: 5000 }),
      signal('fresh-near-rich', { price: 5000, distanceM: 10, ageMins: 0, urgent: true }),
    ]);
    expect(ranked.map((r) => r.signal.id)).toEqual(['fresh-near-rich', 'stale-far-cheap']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('ranks deterministically and independently of input order', () => {
    const signals = spiral(143, (i) => (i % 7) * 250); // deliberate score ties
    const reversed = [...signals].reverse();

    const a = clusterField(signals, { fieldSizePx: 4800 });
    const b = clusterField(signals, { fieldSizePx: 4800 });
    const c = clusterField(reversed, { fieldSizePx: 4800 });

    expect(b.nodes).toEqual(a.nodes);
    expect(b.overflow.signalIds).toEqual(a.overflow.signalIds);
    expect(c.nodes).toEqual(a.nodes);
    expect(c.overflow.signalIds).toEqual(a.overflow.signalIds);
    expect(c.truncationLine).toBe(a.truncationLine);
  });

  it('handles an empty hood without inventing nodes or a truncation line', () => {
    const field = clusterField([], { fieldSizePx: FIELD_PX });
    expect(field.nodes).toEqual([]);
    expect(field.sheets).toEqual([]);
    expect(field.overflow.count).toBe(0);
    expect(field.truncated).toBe(false);
    expect(field.truncationLine).toBeNull();
  });
});

// ---- req 5.5: ring-preserving repulsion ------------------------------------

describe('collision control (req 5.5)', () => {
  const centre = { x: 240, y: 240 };

  it('preserves every node radius exactly, so no node crosses a distance ring', () => {
    const pts = [
      { x: 250, y: 240 },
      { x: 252, y: 243 },
      { x: 255, y: 238 },
      { x: 300, y: 300 },
    ];
    const out = relaxCollisions(pts, { centre });
    for (let i = 0; i < pts.length; i++) {
      const before = Math.hypot(pts[i].x - centre.x, pts[i].y - centre.y);
      const after = Math.hypot(out[i].x - centre.x, out[i].y - centre.y);
      expect(after).toBeCloseTo(before, 9);
    }
  });

  it('increases the separation of overlapping nodes', () => {
    const pts = [
      { x: 250, y: 240 },
      { x: 253, y: 240 },
    ];
    const before = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const out = relaxCollisions(pts, { centre });
    const after = Math.hypot(out[1].x - out[0].x, out[1].y - out[0].y);
    expect(after).toBeGreaterThan(before);
  });

  it('separates coincident nodes deterministically', () => {
    const pts = [
      { x: 300, y: 240 },
      { x: 300, y: 240 },
    ];
    const a = relaxCollisions(pts, { centre });
    const b = relaxCollisions(pts, { centre });
    expect(a).toEqual(b);
    expect(Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y)).toBeGreaterThan(0);
  });

  it('never runs more than three iterations, however many are requested', () => {
    const pts = [
      { x: 244, y: 240 },
      { x: 246, y: 241 },
      { x: 248, y: 239 },
      { x: 250, y: 242 },
    ];
    const three = relaxCollisions(pts, { centre, iterations: MAX_REPULSION_ITERATIONS });
    expect(relaxCollisions(pts, { centre, iterations: 99 })).toEqual(three);
    expect(relaxCollisions(pts, { centre })).toEqual(three);
    // Zero iterations must be a no-op on radius and angle alike.
    expect(relaxCollisions(pts, { centre, iterations: 0 })).toEqual(
      pts.map((p) => ({ x: p.x, y: p.y })),
    );
  });

  it('leaves well-separated nodes untouched', () => {
    const pts = [
      { x: 300, y: 240 },
      { x: 240, y: 300 },
    ];
    expect(relaxCollisions(pts, { centre, minSeparationPx: MIN_SEPARATION_PX })).toEqual(pts);
  });

  it('reduces overlaps in a crowded field while preserving every radius', () => {
    // Clustering cannot help pairs that straddle a cell border: they land in
    // different cells yet render 0.2 px apart. That is exactly what repulsion is for.
    const signals: RealFieldSignal[] = [];
    for (const m of [1, 3, 7, 9]) {
      const border = m * CLUSTER_CELL_PX; // 48, 144, 336, 432 px
      signals.push(signal(`l${m}`, { fx: (border - 0.1) / FIELD_PX, fy: 0.5 }));
      signals.push(signal(`r${m}`, { fx: (border + 0.1) / FIELD_PX, fy: 0.5 }));
    }
    const before = clusterField(signals, { fieldSizePx: FIELD_PX, repulsionIterations: 0 });
    const after = clusterField(signals, { fieldSizePx: FIELD_PX });

    const minSeparation = (nodes: readonly { fx: number; fy: number }[]) => {
      let min = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = (nodes[j].fx - nodes[i].fx) * FIELD_PX;
          const dy = (nodes[j].fy - nodes[i].fy) * FIELD_PX;
          min = Math.min(min, Math.hypot(dx, dy));
        }
      }
      return min;
    };

    expect(minSeparation(before.nodes)).toBeLessThan(1);
    // Three bounded iterations converge to the 22 px target from below.
    expect(minSeparation(after.nodes)).toBeGreaterThan(minSeparation(before.nodes));
    expect(minSeparation(after.nodes)).toBeGreaterThan(MIN_SEPARATION_PX * 0.95);
    // Radii — and therefore ring membership — survive the relaxation exactly.
    expect(after.nodes).toHaveLength(before.nodes.length);
    for (let i = 0; i < after.nodes.length; i++) {
      expect(after.nodes[i].id).toBe(before.nodes[i].id);
      expect(fieldRadius(after.nodes[i])).toBeCloseTo(fieldRadius(before.nodes[i]), 9);
      expect(fieldRadius(after.nodes[i])).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('preserves a single node radius through the whole clusterField pipeline', () => {
    const signals = [
      signal('a', { fx: 0.62, fy: 0.5 }), // cell (6, 5)
      signal('b', { fx: 0.3, fy: 0.52 }), // cell (3, 5)
      signal('c', { fx: 0.5, fy: 0.9 }), // cell (5, 9)
    ];
    const field = clusterField(signals, { fieldSizePx: FIELD_PX });
    expect(field.nodes).toHaveLength(3);
    for (const node of field.nodes) {
      const source = signals.find((s) => s.id === node.id);
      expect(source).toBeDefined();
      expect(fieldRadius(node)).toBeCloseTo(fieldRadius(source!), 9);
    }
  });
});
