/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Field density: clustering, overflow ranking, the 60-node budget, and
 * ring-preserving collision control (design §C.5; reqs 5.1–5.5).
 *
 * The prototype has 8 nodes. A live hood at peak could have 200+. Three
 * mechanisms keep the radar readable without ever lying about supply:
 *
 * 1. **Clustering** (req 5.2). Uniform grid buckets in *field space* (not geo
 *    space) at `cellPx = 48`. Any cell holding two or more signals collapses to
 *    a single cluster node carrying the member count and the summed rupee value
 *    (`4 · ₹1.9k`). Activating it does not zoom — the Field has no zoom, by
 *    design — it opens a **cluster sheet** listing those signals as Board rows
 *    (req 5.3). The bucketing reuses the already-tested spatial hash so cell
 *    assignment has exactly one implementation.
 *
 * 2. **Node budget** (reqs 5.1, 5.4). At most {@link NODE_BUDGET} nodes render.
 *    When clustering alone does not get under the budget, nodes are ranked by
 *    `score = w_recency·recency + w_price·priceNorm + w_prox·(1 − distNorm) +
 *    w_urgent·urgent` and the losers are dropped from the node layer — but never
 *    silently. Every input signal is accounted for in
 *    {@link ClusteredField.reachability}: it is either a node, inside a cluster
 *    sheet, or in {@link ClusteredField.overflow} which routes to the Board. The
 *    truncation is stated plainly: `SHOWING 60 OF 214 · OPEN BOARD FOR ALL`.
 *
 * 3. **Collision control** (req 5.5). At most three repulsion iterations nudge
 *    nodes toward a 22 px minimum separation. The nudge is purely **angular** —
 *    overlapping nodes rotate apart along their own arcs — so each node's radial
 *    distance from the anchor is preserved exactly. A node therefore can never
 *    cross a distance ring, whatever the ring radii happen to be, and the
 *    projection's distance-ordering monotonicity (§J.4) survives collision
 *    control by construction rather than by tuning.
 *
 * This module is PURE and I/O-free (req 30.11, NFR-5.5): no DOM, no clock, no
 * `Math.random`, no Firebase. Recency comes from each signal's own `ageMins`,
 * ordering ties break through the seeded PRNG keyed by signal id, so identical
 * input always yields byte-identical output on every device.
 */

import { FIELD_DISC_RADIUS } from '@/features/field/lib/projection';
import { DEFAULT_CELL_PX, buildSpatialHash, type Point2D } from '@/features/field/lib/spatialHash';
import { showingOf } from '@/copy/labels';
import { seededRandom } from '@/lib/seed';
import type { RealFieldCluster, RealFieldSignal } from '@/types';

// ---- constants (design §C.5) ------------------------------------------------

/** Maximum signal DOM nodes rendered on the Field at any time (req 5.1). */
export const NODE_BUDGET = 60;

/** Field-space grid cell for clustering, in px (req 5.2). Same 48 px as the scan hash. */
export const CLUSTER_CELL_PX = DEFAULT_CELL_PX;

/** A cell with at least this many signals collapses into a cluster node (req 5.2). */
export const MIN_CLUSTER_SIZE = 2;

/** Minimum separation enforced by collision control, in px (req 5.5). */
export const MIN_SEPARATION_PX = 22;

/** Hard cap on repulsion iterations (req 5.5). Never exceeded, even if asked. */
export const MAX_REPULSION_ITERATIONS = 3;

/**
 * Fallback rendered size of the Field disc's bounding square, in px. Clustering
 * is defined in field-space *pixels*, so the caller should pass the real measured
 * size; this default keeps the module usable (and testable) standalone.
 */
export const DEFAULT_FIELD_SIZE_PX = 360;

/** Age at which a signal's recency term reaches 0. */
export const DEFAULT_RECENCY_WINDOW_MINS = 24 * 60;

/** Where excluded signals remain reachable when no hood pincode is supplied. */
export const DEFAULT_BOARD_ROUTE = '/board';

/** Below this radius (px) a node sits on the anchor and has no arc to travel. */
const RADIAL_EPSILON_PX = 1e-6;

/**
 * Largest rotation one repulsion pass may apply to a node, in radians. Near the
 * anchor a 11 px arc is a huge angle; without this cap a crowded centre would
 * fling nodes around the disc.
 */
const MAX_ROTATION_RAD = Math.PI / 4;

const TAU = Math.PI * 2;

// ---- ranking ----------------------------------------------------------------

/** Weights of the overflow priority score (design §C.5). */
export interface RankWeights {
  recency: number;
  price: number;
  proximity: number;
  urgency: number;
}

/** Default weights. Sum to 1, so a score lies in [0, 1]. */
export const DEFAULT_RANK_WEIGHTS: RankWeights = Object.freeze({
  recency: 0.3,
  price: 0.25,
  proximity: 0.3,
  urgency: 0.15,
});

/** Set-relative normalisers, derived once per ranking pass. */
export interface RankNormalisers {
  maxPrice: number;
  maxDistanceM: number;
  recencyWindowMins: number;
}

/** A signal with its computed priority score and deterministic tie-break key. */
export interface RankedSignal {
  signal: RealFieldSignal;
  /** Position in the caller's input array. */
  index: number;
  score: number;
  /** Stable per-id jitter used only to break exact score ties. */
  tie: number;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Derive the normalisers for a signal set. Price and distance are normalised
 * against the set maximum so the score is meaningful for any hood, dense or
 * sparse; an all-zero dimension contributes 0 rather than `NaN`.
 */
export function deriveNormalisers(
  signals: readonly RealFieldSignal[],
  recencyWindowMins: number = DEFAULT_RECENCY_WINDOW_MINS,
): RankNormalisers {
  let maxPrice = 0;
  let maxDistanceM = 0;
  for (const s of signals) {
    if (Number.isFinite(s.price) && s.price > maxPrice) maxPrice = s.price;
    if (Number.isFinite(s.distanceM) && s.distanceM > maxDistanceM) maxDistanceM = s.distanceM;
  }
  return {
    maxPrice,
    maxDistanceM,
    recencyWindowMins: recencyWindowMins > 0 ? recencyWindowMins : DEFAULT_RECENCY_WINDOW_MINS,
  };
}

/**
 * Priority score of one signal (design §C.5). Higher wins the budget. Every term
 * is clamped to [0, 1] so no single dimension can dominate through bad data.
 */
export function signalScore(
  s: RealFieldSignal,
  n: RankNormalisers,
  w: RankWeights = DEFAULT_RANK_WEIGHTS,
): number {
  const recency = clamp01(1 - Math.max(0, s.ageMins ?? 0) / n.recencyWindowMins);
  const priceNorm = n.maxPrice > 0 ? clamp01((s.price ?? 0) / n.maxPrice) : 0;
  const distNorm = n.maxDistanceM > 0 ? clamp01((s.distanceM ?? 0) / n.maxDistanceM) : 0;
  const urgent = s.urgent ? 1 : 0;
  return w.recency * recency + w.price * priceNorm + w.proximity * (1 - distNorm) + w.urgency * urgent;
}

/**
 * Deterministic tie-break key for a signal id. Uses the seeded PRNG (§H.8) rather
 * than plain id ordering so equal-score signals are not biased toward ids that
 * happen to sort first, while remaining perfectly reproducible: identical id ⇒
 * identical key, on every device, forever.
 */
export function tieBreakKey(id: string): number {
  return seededRandom(`field-rank:${id}`)();
}

/**
 * Rank signals by priority, highest first. The order is a total order and is
 * fully deterministic: score descending, then the seeded tie key ascending, then
 * id (code-unit order), then input index. No `Math.random`, no locale collation.
 */
export function rankSignals(
  signals: readonly RealFieldSignal[],
  weights: RankWeights = DEFAULT_RANK_WEIGHTS,
  recencyWindowMins: number = DEFAULT_RECENCY_WINDOW_MINS,
): RankedSignal[] {
  const n = deriveNormalisers(signals, recencyWindowMins);
  const ranked: RankedSignal[] = signals.map((signal, index) => ({
    signal,
    index,
    score: signalScore(signal, n, weights),
    tie: tieBreakKey(signal.id),
  }));
  ranked.sort(compareRanked);
  return ranked;
}

function compareRanked(a: RankedSignal, b: RankedSignal): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.tie !== b.tie) return a.tie - b.tie;
  if (a.signal.id !== b.signal.id) return a.signal.id < b.signal.id ? -1 : 1;
  return a.index - b.index;
}

// ---- cluster labels ---------------------------------------------------------

function trimTenth(v: number): string {
  const s = v.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/**
 * Compact rupee value for a cluster disc, where space is measured in pixels:
 * `₹950`, `₹1.9k`, `₹2.4L`. Full precision lives in the cluster sheet and on the
 * Board; this is the glanceable form the design specifies (§C.5).
 */
export function compactRupees(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  if (safe < 1_000) return `₹${safe}`;
  if (safe < 100_000) return `₹${trimTenth(safe / 1_000)}k`;
  return `₹${trimTenth(safe / 100_000)}L`;
}

/** Cluster disc label: member count and summed value, e.g. `4 · ₹1.9k` (req 5.2). */
export function clusterLabel(count: number, totalValue: number): string {
  return `${count} · ${compactRupees(totalValue)}`;
}

// ---- cell bucketing ---------------------------------------------------------

/** A 48 px field-space cell and the input indices that fall in it. */
export interface FieldCell {
  cx: number;
  cy: number;
  /** Input indices, ascending. */
  members: number[];
}

/** Deterministic cluster node id for a cell. Stable across renders and devices. */
export function clusterIdFor(cx: number, cy: number): string {
  return `cluster:${cx}:${cy}`;
}

/**
 * Bucket signals into `cellPx` field-space cells, in ascending `(cx, cy)` order.
 *
 * Cell assignment is delegated to {@link buildSpatialHash} so the Field has one
 * implementation of "which cell is this point in", shared with the proximity
 * scan. Cell coordinates are recovered from the hash's own (float32) positions so
 * they can never disagree with the bucket a signal landed in.
 */
export function bucketByCell(
  signals: readonly RealFieldSignal[],
  cellPx: number = CLUSTER_CELL_PX,
  fieldSizePx: number = DEFAULT_FIELD_SIZE_PX,
): FieldCell[] {
  const pts: Point2D[] = signals.map((s) => ({ x: s.fx * fieldSizePx, y: s.fy * fieldSizePx }));
  const hash = buildSpatialHash(pts, cellPx);
  const cells: FieldCell[] = [];
  for (const members of hash.buckets.values()) {
    const first = members[0];
    cells.push({
      cx: Math.floor(hash.positions[2 * first] / cellPx),
      cy: Math.floor(hash.positions[2 * first + 1] / cellPx),
      members: [...members],
    });
  }
  cells.sort((a, b) => (a.cx !== b.cx ? a.cx - b.cx : a.cy - b.cy));
  return cells;
}

// ---- collision control ------------------------------------------------------

export interface RepulsionOptions {
  minSeparationPx?: number;
  /** Requested iterations. Clamped to [0, {@link MAX_REPULSION_ITERATIONS}]. */
  iterations?: number;
  /** The anchor, in the same px space as the points. Defaults to the origin. */
  centre?: Point2D;
  /** Disc radius in px used as a safety clamp. Defaults to unbounded. */
  discRadiusPx?: number;
}

/** Wrap an angle into (−π, π]. */
function wrapToPi(a: number): number {
  const t = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return t;
}

/**
 * Nudge overlapping nodes apart, ring-preservingly (req 5.5).
 *
 * At most {@link MAX_REPULSION_ITERATIONS} passes. The nodes are held in polar
 * form about the anchor and **only the angle is ever solved for** — each node's
 * radius is carried through untouched. Every pair closer than `minSeparationPx`
 * is rotated apart along its own arc by half the deficit, in opposite directions:
 * the node that already sits counter-clockwise of the other keeps going
 * counter-clockwise. Because the chord between two fixed radii is strictly
 * increasing in their angular gap over [0, π], rotating apart always increases
 * the real separation, including for the two cases a force-projection scheme
 * cannot handle at all: nodes sharing a bearing, and exactly coincident nodes
 * (broken by input order, deterministically, with no randomness).
 *
 * Radius invariance is what buys the guarantees:
 * - no node can cross a distance ring, wherever those rings are drawn (req 5.5);
 * - the projection's distance-ordering monotonicity (§J.4) is untouched;
 * - a node inside the disc stays inside the disc.
 *
 * Per-pass rotation is capped at {@link MAX_ROTATION_RAD} so a node very close to
 * the anchor — where a small arc is a large angle — cannot be flung around the
 * disc. Nodes sitting exactly on the anchor have no arc to travel and stay put;
 * that is the one case where an overlap can survive, and it is unavoidable while
 * radius is preserved.
 *
 * Cost is O(iterations · n²), bounded and cheap because `n` is capped by the node
 * budget (60 ⇒ 1,770 pairs per pass).
 */
export function relaxCollisions(pts: readonly Point2D[], opts: RepulsionOptions = {}): Point2D[] {
  const minSep = opts.minSeparationPx ?? MIN_SEPARATION_PX;
  const requested = opts.iterations ?? MAX_REPULSION_ITERATIONS;
  const iterations = Math.max(0, Math.min(MAX_REPULSION_ITERATIONS, Math.floor(requested)));
  const cx = opts.centre?.x ?? 0;
  const cy = opts.centre?.y ?? 0;
  const n = pts.length;

  // Polar state about the anchor: radius is immutable, angle is what we solve for.
  const radius = new Float64Array(n);
  const theta = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dx = pts[i].x - cx;
    const dy = pts[i].y - cy;
    let r = Math.hypot(dx, dy);
    if (opts.discRadiusPx !== undefined && r > opts.discRadiusPx) r = opts.discRadiusPx;
    radius[i] = r;
    theta[i] = Math.atan2(dy, dx);
  }

  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const rot = new Float64Array(n);
  let moved = false;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      x[i] = cx + radius[i] * Math.cos(theta[i]);
      y[i] = cy + radius[i] * Math.sin(theta[i]);
      rot[i] = 0;
    }

    let overlapping = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const d = Math.hypot(dx, dy);
        if (d >= minSep) continue;
        overlapping = true;
        // Split the deficit: each node travels half of it along its own arc.
        const half = (minSep - d) / 2;
        // Keep the node that is already counter-clockwise going counter-clockwise.
        // An exact angular tie falls back to input order, so the result is stable.
        const sign = wrapToPi(theta[j] - theta[i]) < 0 ? -1 : 1;
        if (radius[i] > RADIAL_EPSILON_PX) rot[i] -= (sign * half) / radius[i];
        if (radius[j] > RADIAL_EPSILON_PX) rot[j] += (sign * half) / radius[j];
      }
    }
    if (!overlapping) break;

    for (let i = 0; i < n; i++) {
      if (rot[i] === 0) continue;
      const capped = Math.max(-MAX_ROTATION_RAD, Math.min(MAX_ROTATION_RAD, rot[i]));
      theta[i] += capped;
      moved = true;
    }
  }

  // Nothing overlapped: hand back the input unchanged rather than a float round-trip.
  if (!moved) return pts.map((p) => ({ x: p.x, y: p.y }));

  const out: Point2D[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = { x: cx + radius[i] * Math.cos(theta[i]), y: cy + radius[i] * Math.sin(theta[i]) };
  }
  return out;
}

// ---- the clustered field ----------------------------------------------------

/** A rendered Field node: a real signal, or a cluster standing for several. */
export type FieldClusterNode = RealFieldSignal | RealFieldCluster;

/** One row of a cluster sheet — the Board's row shape, sourced from the signal. */
export interface ClusterSheetRow {
  signalId: string;
  title: string;
  price: number;
  distanceM: number;
  urgent: boolean;
  ageMins: number;
  /** Priority score, so the sheet order is inspectable and testable. */
  score: number;
}

/**
 * The sheet a cluster node opens (req 5.3). It lists the contained signals as
 * Board rows, ranked highest priority first. Opening it never zooms the Field.
 */
export interface ClusterSheet {
  clusterId: string;
  count: number;
  totalValue: number;
  /** Disc label, e.g. `4 · ₹1.9k`. */
  label: string;
  rows: ClusterSheetRow[];
}

/** Signals the node layer could not fit. Never dropped — routed to the Board. */
export interface FieldOverflow {
  count: number;
  /** Highest priority first. */
  signalIds: string[];
  boardRoute: string;
}

/** How a given input signal remains reachable (req 5.4). */
export type SignalReachability =
  | { via: 'NODE'; nodeId: string }
  | { via: 'CLUSTER'; nodeId: string }
  | { via: 'BOARD'; boardRoute: string };

export interface ClusteredField {
  /** At most `nodeBudget` nodes, positions already relaxed. Highest priority first. */
  nodes: FieldClusterNode[];
  /** Cluster sheets, keyed by cluster node id, in node order. */
  sheets: ClusterSheet[];
  overflow: FieldOverflow;
  /** Signals in the input set. */
  totalSignals: number;
  /** Signals represented by a rendered node (directly or through a cluster). */
  renderedSignals: number;
  truncated: boolean;
  /** `SHOWING 60 OF 214 · OPEN BOARD FOR ALL`, or `null` when nothing is cut. */
  truncationLine: string | null;
  /** Every input signal id → how to reach it. Total coverage is an invariant. */
  reachability: Map<string, SignalReachability>;
}

export interface ClusterFieldOptions {
  /** Measured size of the Field disc's bounding square, in px. */
  fieldSizePx?: number;
  cellPx?: number;
  nodeBudget?: number;
  weights?: RankWeights;
  recencyWindowMins?: number;
  minSeparationPx?: number;
  /** Clamped to [0, {@link MAX_REPULSION_ITERATIONS}]. */
  repulsionIterations?: number;
  /** Route excluded signals fall back to. Prefer {@link boardRouteFor}. */
  boardRoute?: string;
}

/** The hood Board route (`/hood/:pin/board`), where every signal is reachable. */
export function boardRouteFor(pincode: string): string {
  return `/hood/${pincode}/board`;
}

/** Whether a node stands for several signals (and therefore opens a sheet). */
export function isClusterNode(node: FieldClusterNode): node is RealFieldCluster {
  return node.kind === 'REAL_GIG_CLUSTER';
}

interface CandidateNode {
  node: FieldClusterNode;
  /** Input indices this node stands for. */
  members: number[];
  score: number;
  tie: number;
  id: string;
}

function sheetRow(r: RankedSignal): ClusterSheetRow {
  return {
    signalId: r.signal.id,
    title: r.signal.title,
    price: r.signal.price,
    distanceM: r.signal.distanceM,
    urgent: r.signal.urgent,
    ageMins: r.signal.ageMins,
    score: r.score,
  };
}

/**
 * Derive the Field's node layer from projected real signals (reqs 5.1–5.5).
 *
 * Pipeline: bucket into 48 px cells → collapse multi-signal cells into cluster
 * nodes → rank → keep at most `nodeBudget` → relax collisions ring-preservingly.
 *
 * Ghost signals are NOT accepted here by construction: the input type is
 * `RealFieldSignal`, so waitlist ghosts can never enter a cluster, a count, or a
 * rupee total (req 9.9, design §L.1).
 */
export function clusterField(
  signals: readonly RealFieldSignal[],
  options: ClusterFieldOptions = {},
): ClusteredField {
  const fieldSizePx = options.fieldSizePx ?? DEFAULT_FIELD_SIZE_PX;
  const cellPx = options.cellPx ?? CLUSTER_CELL_PX;
  const nodeBudget = Math.max(0, Math.floor(options.nodeBudget ?? NODE_BUDGET));
  const weights = options.weights ?? DEFAULT_RANK_WEIGHTS;
  const recencyWindowMins = options.recencyWindowMins ?? DEFAULT_RECENCY_WINDOW_MINS;
  const boardRoute = options.boardRoute ?? DEFAULT_BOARD_ROUTE;

  // Rank once; every later ordering decision reads from this single total order.
  const ranked = rankSignals(signals, weights, recencyWindowMins);
  const byIndex: RankedSignal[] = new Array(signals.length);
  const rankOf = new Map<number, number>();
  for (let position = 0; position < ranked.length; position++) {
    const r = ranked[position];
    byIndex[r.index] = r;
    rankOf.set(r.index, position);
  }

  // 1. Cluster 48 px cells (req 5.2).
  const cells = bucketByCell(signals, cellPx, fieldSizePx);
  const candidates: CandidateNode[] = [];

  for (const cell of cells) {
    // Members in priority order, so cluster sheets and gigIds are ranked.
    const members = [...cell.members].sort(
      (a, b) => (rankOf.get(a) ?? a) - (rankOf.get(b) ?? b),
    );

    if (members.length < MIN_CLUSTER_SIZE) {
      const only = byIndex[members[0]];
      candidates.push({
        node: only.signal,
        members,
        score: only.score,
        tie: only.tie,
        id: only.signal.id,
      });
      continue;
    }

    let fxSum = 0;
    let fySum = 0;
    let totalValue = 0;
    let best = -Infinity;
    let bestTie = Infinity;
    for (const m of members) {
      const s = signals[m];
      fxSum += s.fx;
      fySum += s.fy;
      totalValue += Number.isFinite(s.price) ? s.price : 0;
      const r = byIndex[m];
      if (r.score > best || (r.score === best && r.tie < bestTie)) {
        best = r.score;
        bestTie = r.tie;
      }
    }
    const cluster: RealFieldCluster = {
      kind: 'REAL_GIG_CLUSTER',
      id: clusterIdFor(cell.cx, cell.cy),
      gigIds: members.map((m) => signals[m].id),
      count: members.length,
      totalValue,
      fx: fxSum / members.length,
      fy: fySum / members.length,
    };
    // A cluster inherits its strongest member's priority, so a cluster holding
    // the hottest signal in the hood never loses the budget to a weaker single.
    candidates.push({ node: cluster, members, score: best, tie: bestTie, id: cluster.id });
  }

  // 2. Node budget (reqs 5.1, 5.4). Deterministic ordering, highest priority first.
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.tie !== b.tie) return a.tie - b.tie;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const kept = candidates.slice(0, nodeBudget);
  const dropped = candidates.slice(nodeBudget);

  // 3. Collision control (req 5.5), in px space about the anchor.
  const centre: Point2D = { x: 0.5 * fieldSizePx, y: 0.5 * fieldSizePx };
  const relaxed = relaxCollisions(
    kept.map((c) => ({ x: c.node.fx * fieldSizePx, y: c.node.fy * fieldSizePx })),
    {
      minSeparationPx: options.minSeparationPx ?? MIN_SEPARATION_PX,
      iterations: options.repulsionIterations ?? MAX_REPULSION_ITERATIONS,
      centre,
      discRadiusPx: FIELD_DISC_RADIUS * fieldSizePx,
    },
  );

  const nodes: FieldClusterNode[] = kept.map((c, i) => ({
    ...c.node,
    fx: relaxed[i].x / fieldSizePx,
    fy: relaxed[i].y / fieldSizePx,
  }));

  // 4. Reachability: every input signal is accounted for (req 5.4).
  const reachability = new Map<string, SignalReachability>();
  const sheets: ClusterSheet[] = [];
  let renderedSignals = 0;

  for (let i = 0; i < kept.length; i++) {
    const c = kept[i];
    const node = nodes[i];
    renderedSignals += c.members.length;
    if (isClusterNode(node)) {
      const rows = c.members.map((m) => sheetRow(byIndex[m]));
      sheets.push({
        clusterId: node.id,
        count: node.count,
        totalValue: node.totalValue,
        label: clusterLabel(node.count, node.totalValue),
        rows,
      });
      for (const m of c.members) {
        reachability.set(signals[m].id, { via: 'CLUSTER', nodeId: node.id });
      }
    } else {
      reachability.set(node.id, { via: 'NODE', nodeId: node.id });
    }
  }

  const overflowIndices = dropped.flatMap((c) => c.members);
  overflowIndices.sort((a, b) => (rankOf.get(a) ?? a) - (rankOf.get(b) ?? b));
  for (const m of overflowIndices) {
    reachability.set(signals[m].id, { via: 'BOARD', boardRoute });
  }

  const truncated = overflowIndices.length > 0;

  return {
    nodes,
    sheets,
    overflow: {
      count: overflowIndices.length,
      signalIds: overflowIndices.map((m) => signals[m].id),
      boardRoute,
    },
    totalSignals: signals.length,
    renderedSignals,
    truncated,
    // The line reports rendered NODES against total signals, exactly as §C.5
    // specifies: `SHOWING 60 OF 214 · OPEN BOARD FOR ALL`.
    truncationLine: truncated ? showingOf(nodes.length, signals.length) : null,
    reachability,
  };
}

/** The sheet a cluster node opens, or `null` for a single-signal node (req 5.3). */
export function sheetFor(field: ClusteredField, nodeId: string): ClusterSheet | null {
  return field.sheets.find((s) => s.clusterId === nodeId) ?? null;
}
