/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Honest supply derivation for the Field: the cold-start / sparse-board rules
 * (requirements 9.1–9.11, design §H.8, §K.4, §E.9).
 *
 * The single rule this module exists to enforce: **the app never fabricates
 * supply.** The prototype hash-generated fake gigs; that is fine on a landing
 * page and fraud in an app.
 *
 *   - `realOpenGigCount === 0` ⇒ and only then ⇒ hollow deterministic
 *     `WAITLIST_GHOST` nodes are derived from the hood's *real* waitlist count.
 *     Each carries `price: 0`, `title: 'WAITING'`, `claimable: false`,
 *     `detailRoute: null` (req 9.1, 9.2, 9.3).
 *   - `realOpenGigCount >= 1` ⇒ the node layer contains only `REAL_GIG` /
 *     `REAL_GIG_CLUSTER` nodes and zero ghosts. Waitlist demand is then exposed
 *     only as a separately positioned, clearly labelled `WAITLIST` indicator
 *     (req 9.8, 9.10).
 *   - Ghosts are excluded from every real metric: count, total rupee value,
 *     centroid, clusters, claim counts, detail routes and claim actions
 *     (req 9.2) — {@link fieldRealCount} / {@link fieldRealValue} only ever read
 *     real nodes.
 *
 * The module is deliberately pure and I/O-free (req 30.11, NFR-5.5): no
 * Firebase, no DOM, no randomness. `now` is injectable, defaulting to the clock
 * exactly like `@/features/field/lib/visibility`, so property test P9.4 (task
 * 3.25) can drive every function directly.
 *
 * Clustering is *not* implemented here — it belongs to the clustering module
 * (task 3.22). It is injected as a pure `cluster` callback so this module owns
 * the honesty invariant (real count and real value are preserved) without owning
 * the geometry.
 */

import type {
  FieldContent,
  FieldSignal,
  GhostFieldSignal,
  Gig,
  Hood,
  RealFieldSignal,
  WaitlistDemandIndicator,
} from '@/types';
import { seededRandom, seededPick, seededRotation } from '@/lib/seed';
import {
  bearingDeg,
  createFieldTransform,
  haversineM,
  projectToField,
  type FieldTransform,
  type FieldWarp,
  type GeoPoint,
} from '@/features/field/lib/projection';
import { canActInHood, hoodLaunchProgress, type LaunchProgress } from '@/features/hood/lib/stats';
import { labels, hoodProgress } from '@/copy/labels';
import { empty } from '@/copy/empty';
import { rupees } from '@/lib/format';

// ---- constants --------------------------------------------------------------

/** Default Field disc radius in metres (design §C.3; matches `HoodProvider`). */
export const FIELD_DEFAULT_RADIUS_M = 2000;

/**
 * Upper bound of the sparse band. One to four real open gigs is a *sparse
 * board*: exact counts, exact value, and both `POST A FLARE` and
 * `LOOK AT NEARBY HOODS` (design §K.4 move 3, req 9.9).
 */
export const SPARSE_MAX_REAL_GIGS = 4;

/**
 * How many hollow ghosts may be drawn at zero supply. Ghosts are decoration for
 * *real* waitlist demand, not supply, so the count is capped well below the
 * 60-node Field budget: a wall of hollow nodes reads as a busy board, which is
 * the exact dishonesty this module exists to prevent.
 */
export const MAX_GHOST_NODES = 6;

/** Ghost ring bounds in unit-square radius (the Field disc radius is 0.5). */
export const GHOST_RING_INNER = 0.2;
export const GHOST_RING_OUTER = 0.44;

/** The only title a ghost may ever carry (req 9.1, 9.2). */
export const GHOST_TITLE = 'WAITING' as const;

const TAU = Math.PI * 2;

/** Marker tones available to real signals (design §B.1). */
export const SIGNAL_TONES: readonly RealFieldSignal['tone'][] = [
  'cobalt',
  'magenta',
  'lime',
  'cyan',
  'peach',
];

// Guard rails for a malformed hood document: the Field must not crash on bad
// data, and node positions are decoration — the real metrics stay exact either
// way. `createFieldTransform` rejects anchors outside these ranges.
const MAX_SAFE_LAT = 89.9;

// ---- ghost derivation (zero supply only) ------------------------------------

export interface GhostPlacementOptions {
  /** Hard cap on ghost nodes. Defaults to {@link MAX_GHOST_NODES}. */
  max?: number;
  ringInner?: number;
  ringOuter?: number;
}

/**
 * Hollow deterministic `WAITING` ghosts for a hood with **zero** real open gigs
 * (req 9.1, 9.2, 9.7, design §H.8).
 *
 * Count is derived from the hood's real `waitlistCount` and capped at
 * {@link MAX_GHOST_NODES}; a hood with an empty waitlist gets no ghosts, because
 * there is no real demand to represent.
 *
 * Placement is seeded from the hood identifier and the ghost's slot index only —
 * never from the waitlist count — so positions are identical on every device and
 * do not move between renders, nor shuffle when the waitlist grows (req 9.7).
 *
 * @param realOpenGigCount must be exactly `0`. Passing anything else is a
 *   programming error: ghosts may never appear alongside real supply (req 9.8).
 */
export function seededGhostSignals(
  hoodId: string,
  waitlistCount: number,
  realOpenGigCount: 0,
  options: GhostPlacementOptions = {},
): GhostFieldSignal[] {
  if (realOpenGigCount !== 0) {
    throw new Error(
      `seededGhostSignals: ghosts may only be derived at zero real open gigs, got ${realOpenGigCount}`,
    );
  }

  const max = Math.max(0, Math.floor(options.max ?? MAX_GHOST_NODES));
  const inner = options.ringInner ?? GHOST_RING_INNER;
  const outer = options.ringOuter ?? GHOST_RING_OUTER;

  const real = Number.isFinite(waitlistCount) ? Math.floor(waitlistCount) : 0;
  const count = Math.min(Math.max(0, real), max);
  if (count === 0) return [];

  // A stable per-hood ring offset so two hoods do not share the same silhouette,
  // while slots stay fixed as the waitlist grows.
  const slots = Math.max(1, max);
  const baseAngle = seededRandom(`${hoodId}:ghost-ring`)() * TAU;

  const ghosts: GhostFieldSignal[] = [];
  for (let i = 0; i < count; i++) {
    const rnd = seededRandom(`${hoodId}:ghost:${i}`);
    const jitter = (rnd() - 0.5) * (TAU / (slots * 2));
    const radius = inner + rnd() * Math.max(0, outer - inner);
    const angle = baseAngle + (i / slots) * TAU + jitter;

    ghosts.push({
      kind: 'WAITLIST_GHOST',
      id: `ghost:${hoodId}:${i}`,
      fx: clamp01(0.5 + radius * Math.sin(angle)),
      fy: clamp01(0.5 - radius * Math.cos(angle)),
      price: 0,
      title: GHOST_TITLE,
      claimable: false,
      detailRoute: null,
    });
  }
  return ghosts;
}

// ---- real signal derivation --------------------------------------------------

export interface DeriveFieldOptions {
  /** Clock for `ageMins` / head-start evaluation. Injected for pure testing. */
  now?: number;
  /** Prebuilt transform (e.g. live-location anchor mode). Overrides `radiusM`/`warp`. */
  transform?: FieldTransform;
  radiusM?: number;
  warp?: FieldWarp;
  /**
   * Clustering, injected from the clustering module (task 3.22). It must preserve
   * real count and real value; if it does not, the raw signals are used instead —
   * exact metrics outrank cluster geometry (req 9.9).
   */
  cluster?: (signals: readonly RealFieldSignal[]) => FieldSignal[];
  /** Rank-floor lock state, when the caller knows the viewer's rank. */
  isLocked?: (gig: Gig) => boolean;
  /** Ghost placement overrides (zero-supply state only). */
  ghosts?: GhostPlacementOptions;
}

/**
 * Project real open gigs onto the Field. Positions come from each gig's
 * *published fuzzed* coordinate only (req 20.9) — exact coordinates never reach
 * this module.
 */
export function deriveRealSignals(
  realOpenGigs: readonly Gig[],
  hood: Pick<Hood, 'centroid'>,
  options: DeriveFieldOptions = {},
): RealFieldSignal[] {
  const now = options.now ?? Date.now();
  const transform = options.transform ?? fieldTransformForHood(hood, options);
  const anchor = transform.anchor;

  return realOpenGigs.map((gig) => {
    const point = safePoint(gig.geoFuzzed, anchor);
    const { fx, fy } = projectToField(point, transform);
    return {
      kind: 'REAL_GIG',
      id: gig.id,
      fx,
      fy,
      distanceM: haversineM(anchor, point),
      bearingDeg: bearingDeg(anchor, point),
      price: gig.askPrice,
      title: gig.title,
      tone: seededPick(`${gig.id}:tone`, SIGNAL_TONES),
      urgent: Boolean(gig.urgent),
      ageMins: Math.max(0, Math.round((now - (gig.createdAt ?? now)) / 60_000)),
      rot: seededRotation(gig.id),
      locked: options.isLocked ? options.isLocked(gig) : false,
      headStart: isInHeadStart(gig, now),
    };
  });
}

/**
 * THE derivation of the Field node layer (design §H.8).
 *
 * Calls {@link seededGhostSignals} **iff** `realOpenGigs.length === 0`. With one
 * or more real open gigs the node layer holds only real gig / real-gig cluster
 * nodes, and waitlist demand is returned separately as a labelled `WAITLIST`
 * indicator (req 9.8, 9.10).
 */
export function deriveFieldContent(
  realOpenGigs: readonly Gig[],
  hood: Hood,
  options: DeriveFieldOptions = {},
): FieldContent {
  if (realOpenGigs.length === 0) {
    // Zero supply: hollow ghosts derived from real waitlist demand. The waitlist
    // is already represented by those ghosts and the launch meter, so it is not
    // duplicated as an indicator here.
    return {
      nodes: seededGhostSignals(hood.pincode, hood.waitlistCount ?? 0, 0, options.ghosts),
      waitlistIndicator: null,
    };
  }

  const signals = deriveRealSignals(realOpenGigs, hood, options);
  const nodes = applyClustering(signals, options.cluster);

  return { nodes, waitlistIndicator: waitlistIndicatorFor(hood) };
}

/**
 * Apply injected clustering, rejecting any result that would misreport real
 * supply: nodes must be real-only, and both the real count and the summed real
 * value must survive the transform exactly (req 9.8, 9.9).
 */
function applyClustering(
  signals: RealFieldSignal[],
  cluster: DeriveFieldOptions['cluster'],
): FieldSignal[] {
  if (!cluster) return signals;

  const clustered = cluster(signals);
  const realOnly = clustered.every((n) => n.kind === 'REAL_GIG' || n.kind === 'REAL_GIG_CLUSTER');
  const countKept = countOf(clustered) === signals.length;
  const valueKept = valueOf(clustered) === valueOf(signals);

  return realOnly && countKept && valueKept ? clustered : signals;
}

/**
 * Separately positioned `WAITLIST` demand indicator for a hood that has real
 * supply (req 9.10). Never a node: it is returned outside the node layer, and
 * only when there is real waitlist demand to report.
 */
export function waitlistIndicatorFor(
  hood: Pick<Hood, 'waitlistCount' | 'launchThreshold'>,
): WaitlistDemandIndicator | null {
  const count = Math.max(0, Math.floor(hood.waitlistCount ?? 0));
  if (count === 0) return null;
  const progress = hoodLaunchProgress(hood);
  return progress.reached
    ? { label: labels.waitlist, count }
    : { label: labels.waitlist, count, progressTarget: progress.target };
}

// ---- real metrics: ghosts contribute to nothing ------------------------------

/** Type guard for a hollow ghost node. */
export function isGhostSignal(node: FieldSignal): node is GhostFieldSignal {
  return node.kind === 'WAITLIST_GHOST';
}

/** Exact real open-gig count on the Field. Ghosts count for zero (req 9.2, 9.9). */
export function fieldRealCount(content: Pick<FieldContent, 'nodes'>): number {
  return countOf(content.nodes);
}

/** Exact total real rupee value on the Field. Ghosts add zero (req 9.2, 9.9). */
export function fieldRealValue(content: Pick<FieldContent, 'nodes'>): number {
  return valueOf(content.nodes);
}

/**
 * The centroid of *real* supply only, in Field space, or `null` when there is no
 * real supply. Ghosts never move the centroid (req 9.2).
 */
export function fieldRealCentroid(
  content: Pick<FieldContent, 'nodes'>,
): { fx: number; fy: number } | null {
  const real = content.nodes.filter((n) => !isGhostSignal(n));
  if (real.length === 0) return null;
  const weight = (n: Exclude<FieldSignal, GhostFieldSignal>) =>
    n.kind === 'REAL_GIG_CLUSTER' ? Math.max(1, n.count) : 1;
  let total = 0;
  let sx = 0;
  let sy = 0;
  for (const n of real as Exclude<FieldSignal, GhostFieldSignal>[]) {
    const w = weight(n);
    total += w;
    sx += n.fx * w;
    sy += n.fy * w;
  }
  return { fx: sx / total, fy: sy / total };
}

/**
 * Honesty assertion for the node layer (req 9.3, 9.8): true when ghosts appear
 * alongside real supply, or when any ghost pretends to be a gig (non-zero price,
 * a title other than `WAITING`, claimable, or carrying a detail route).
 */
export function hasFabricatedSupply(nodes: readonly FieldSignal[]): boolean {
  const ghosts = nodes.filter(isGhostSignal);
  if (ghosts.length === 0) return false;
  if (ghosts.length !== nodes.length) return true;
  return ghosts.some(
    (g) => g.price !== 0 || g.title !== GHOST_TITLE || g.claimable !== false || g.detailRoute !== null,
  );
}

// ---- supply state + presentation --------------------------------------------

export type SupplyState = 'ZERO_SUPPLY' | 'SPARSE' | 'HEALTHY';

/** Band a real open-gig count into the cold-start states (design §K.4). */
export function supplyState(realOpenGigCount: number): SupplyState {
  if (realOpenGigCount <= 0) return 'ZERO_SUPPLY';
  return realOpenGigCount <= SPARSE_MAX_REAL_GIGS ? 'SPARSE' : 'HEALTHY';
}

export type SupplyActionId =
  | 'BE_FIRST'
  | 'POST_A_FLARE'
  | 'LOOK_AT_NEARBY_HOODS'
  | 'PULL_FRIENDS_IN';

export interface SupplyAction {
  id: SupplyActionId;
  label: string;
  emphasis: 'primary' | 'secondary';
  /** Flare actions are withheld until the hood is live (req 8.10). */
  disabled: boolean;
}

export interface LaunchMeter extends LaunchProgress {
  /** `N / M NEIGHBOURS · OPENS AT M` (req 9.4). */
  line: string;
}

export interface SupplyPresentation {
  state: SupplyState;
  /** Exact real open-gig count — ghosts excluded (req 9.2, 9.9). */
  realCount: number;
  /** Exact summed real rupee value — ghosts excluded (req 9.2, 9.9). */
  realValue: number;
  /** `4 SIGNALS · ₹1,200 ON THE FIELD`, or null when there is no real supply. */
  summaryLine: string | null;
  /** Hollow ghost nodes: non-empty only in the zero-supply state. */
  ghosts: GhostFieldSignal[];
  /** Separate labelled waitlist indicator; never a node (req 9.10). */
  waitlistIndicator: WaitlistDemandIndicator | null;
  /** Launch meter, present only while the hood is below its threshold (req 9.4). */
  launchMeter: LaunchMeter | null;
  actions: SupplyAction[];
  /** Adjacency list `LOOK AT NEARBY HOODS` widens to, labelled further away (req 9.5). */
  nearbyHoodIds: readonly string[];
  /** `FURTHER AWAY` label for nearby results (req 9.5). */
  nearbyLabel: string;
  /** First-flare bonus line, stated only where the viewer qualifies (req 9.11). */
  firstFlareBonusLine: string | null;
  /** In-voice empty/sparse copy, or null on a healthy board. */
  copy: { title: string; body: string } | null;
  /** Ids of gigs posted by the operating team — marked `QG TEAM`, not as users (req 9.6). */
  teamGigIds: readonly string[];
  /** Whether flaring is currently permitted in this hood. */
  canFlare: boolean;
}

export interface SupplyPresentationOptions extends DeriveFieldOptions {
  /**
   * Whether the viewer actually qualifies for the first-flare rep bonus — i.e.
   * has never flared in this hood. Omit for anonymous viewers: the bonus is
   * stated only where it is genuinely earned (req 9.11, design §K.4 move 5).
   */
  firstFlareEligible?: boolean;
  /** Uids of operating-team poster accounts (req 9.6). */
  teamPosterUids?: readonly string[];
}

/**
 * `FIRST FLARE = DOUBLE REP` eligibility: the viewer qualifies while they have
 * not yet flared in this hood. An absent viewer (anonymous browse) does not
 * qualify — the bonus is never promised to someone we cannot verify.
 */
export function isFirstFlareBonusEligible(
  viewer: { hasFlaredInHood: boolean } | null | undefined,
): boolean {
  return Boolean(viewer) && !viewer!.hasFlaredInHood;
}

/** Whether a gig was posted by the operating team (req 9.6, design §K.4 move 7). */
export function isTeamGig(gig: Gig, teamPosterUids: readonly string[] = []): boolean {
  if (teamPosterUids.length === 0) return false;
  return teamPosterUids.includes(gig.posterUid);
}

/** `N SIGNALS · ₹V ON THE FIELD` — exact real numbers only (req 9.9). */
export function supplySummaryLine(count: number, value: number): string {
  return `${count} ${count === 1 ? 'SIGNAL' : 'SIGNALS'} · ${rupees(value)} ON THE FIELD`;
}

/**
 * The complete honest cold-start / sparse-board view model (req 9.1–9.11).
 * Pure: the surface renders this, it does not recompute it.
 */
export function deriveSupplyPresentation(
  realOpenGigs: readonly Gig[],
  hood: Hood,
  options: SupplyPresentationOptions = {},
): SupplyPresentation {
  const content = deriveFieldContent(realOpenGigs, hood, options);
  const realCount = fieldRealCount(content);
  const realValue = fieldRealValue(content);
  const state = supplyState(realCount);

  const progress = hoodLaunchProgress(hood);
  const canFlare = canActInHood(hood);
  const nearbyHoodIds = hood.adjacent ?? [];
  const eligible = options.firstFlareEligible ?? false;

  return {
    state,
    realCount,
    realValue,
    summaryLine: realCount > 0 ? supplySummaryLine(realCount, realValue) : null,
    ghosts: content.nodes.filter(isGhostSignal),
    waitlistIndicator: content.waitlistIndicator,
    launchMeter: progress.reached
      ? null
      : { ...progress, line: hoodProgress(progress.current, progress.target) },
    actions: supplyActions(state, { canFlare, hasNearby: nearbyHoodIds.length > 0, progress }),
    nearbyHoodIds,
    nearbyLabel: labels.furtherAway,
    // Stated in the zero and sparse states only, and only when truly eligible.
    firstFlareBonusLine: eligible && state !== 'HEALTHY' ? labels.firstFlareBonus : null,
    copy:
      state === 'ZERO_SUPPLY'
        ? { ...empty.ghostTown }
        : state === 'SPARSE'
          ? { ...empty.sparseBoard }
          : null,
    teamGigIds: realOpenGigs
      .filter((g) => isTeamGig(g, options.teamPosterUids))
      .map((g) => g.id),
    canFlare,
  };
}

function supplyActions(
  state: SupplyState,
  ctx: { canFlare: boolean; hasNearby: boolean; progress: LaunchProgress },
): SupplyAction[] {
  if (state === 'HEALTHY') return [];

  const actions: SupplyAction[] = [];

  // Reward the first mover (req 9.5 / 9.9): `BE FIRST` at zero, `POST A FLARE`
  // once the board has started.
  actions.push(
    state === 'ZERO_SUPPLY'
      ? { id: 'BE_FIRST', label: labels.beFirst, emphasis: 'primary', disabled: !ctx.canFlare }
      : { id: 'POST_A_FLARE', label: labels.postAFlare, emphasis: 'primary', disabled: !ctx.canFlare },
  );

  // Adjacent spillover (req 9.5, 9.9).
  if (ctx.hasNearby) {
    actions.push({
      id: 'LOOK_AT_NEARBY_HOODS',
      label: labels.lookAtNearbyHoods,
      emphasis: 'secondary',
      disabled: false,
    });
  }

  // Progress, not emptiness: recruit share action below the launch threshold (req 9.4).
  if (state === 'ZERO_SUPPLY' && !ctx.progress.reached) {
    actions.push({
      id: 'PULL_FRIENDS_IN',
      label: labels.pullFriendsIn,
      emphasis: 'secondary',
      disabled: false,
    });
  }

  return actions;
}

// ---- internals ---------------------------------------------------------------

function countOf(nodes: readonly FieldSignal[]): number {
  return nodes.reduce((sum, n) => {
    if (n.kind === 'REAL_GIG') return sum + 1;
    if (n.kind === 'REAL_GIG_CLUSTER') return sum + n.count;
    return sum; // ghosts contribute nothing (req 9.2)
  }, 0);
}

function valueOf(nodes: readonly FieldSignal[]): number {
  return nodes.reduce((sum, n) => {
    if (n.kind === 'REAL_GIG') return sum + n.price;
    if (n.kind === 'REAL_GIG_CLUSTER') return sum + n.totalValue;
    return sum;
  }, 0);
}

/**
 * Transform for the hood's Field. The anchor is defensively clamped: a
 * malformed hood document must degrade node placement, never crash the Field.
 */
function fieldTransformForHood(
  hood: Pick<Hood, 'centroid'>,
  options: DeriveFieldOptions,
): FieldTransform {
  const radiusM =
    Number.isFinite(options.radiusM) && (options.radiusM as number) > 0
      ? (options.radiusM as number)
      : FIELD_DEFAULT_RADIUS_M;
  const anchor: GeoPoint = {
    lat: clampFinite(hood.centroid?.lat, MAX_SAFE_LAT),
    lng: clampFinite(hood.centroid?.lng, 180),
  };
  return createFieldTransform(anchor, radiusM, options.warp ?? 'linear');
}

/** A gig's published position, falling back to the anchor when absent. */
function safePoint(p: Gig['geoFuzzed'] | undefined, anchor: GeoPoint): GeoPoint {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return anchor;
  return { lat: clampFinite(p.lat, MAX_SAFE_LAT), lng: clampFinite(p.lng, 180) };
}

/** True while the gig is still inside the LEGEND+ head-start window (req 18.8). */
function isInHeadStart(gig: Pick<Gig, 'visibleFrom'>, now: number): boolean {
  const openAt = gig.visibleFrom?.all;
  return typeof openAt === 'number' && now < openAt;
}

function clampFinite(value: number | undefined, bound: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(-bound, Math.min(bound, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
