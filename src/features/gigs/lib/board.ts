/**
 * Pure Board logic: full-text search and the four sort orders (design §C.8, §K.2).
 *
 * The Board is the list mode of a hood. It is deliberately category-free — requirement 7.5
 * and §K.2 replace the old `category` dropdown with freeform tags plus full-text search, so
 * everything here searches text the poster actually wrote. No taxonomy is derived, exposed
 * or inferred.
 *
 * Pure and I/O-free (req 30.11): no Firebase, no DOM, no clock reads except the injected
 * `now`. Sorting is total and deterministic — every comparator falls through to `createdAt`
 * and then to the gig id, so the same input list always produces the same output order.
 */
import type { Gig } from '@/types';
import { haversineM, type GeoPoint } from '@/features/field/lib/projection';
import { rankIndex } from '@/features/rep/lib/unlocks';
import type { BoardSort } from '@/hooks/useUrlState';

/** A Board row: the gig plus the derived distance used for display and for the distance sort. */
export interface BoardRowData {
  gig: Gig;
  /** Metres from the hood anchor to the gig's PUBLIC fuzzed point, or null when unknown. */
  distanceM: number | null;
}

export interface BoardContext {
  /** The hood anchor (centroid, or the opted-in live point). Null → distance is unavailable. */
  anchor: GeoPoint | null;
  now: number;
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

/** Lowercase and collapse whitespace/diacritics-free enough for substring matching. */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();
}

/**
 * Split a raw query into search tokens. Multiple words are an AND: `ikea allen` matches only
 * gigs mentioning both, which is the behaviour a scanner expects from a 2 km board.
 */
export function queryTokens(query: string): string[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  return Array.from(new Set(tokens));
}

/**
 * Everything the Board searches over: the poster's own words (title, body, freeform tags),
 * the public area label, and the poster's public name/handle. Exact/private location text is
 * never part of this (req 20.x): only the published fuzzed `areaLabel` is searchable.
 */
export function searchableText(gig: Gig): string {
  return normalize(
    [
      gig.title,
      gig.body,
      ...(gig.tags ?? []),
      gig.areaLabel ?? '',
      gig.posterSnapshot?.displayName ?? '',
      gig.posterSnapshot?.handle ?? '',
    ].join(' '),
  );
}

/** True when every token of the query appears in the gig's searchable text. */
export function matchesQuery(gig: Gig, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = searchableText(gig);
  return tokens.every((t) => haystack.includes(t));
}

/** Full-text search over a hood's signals (req 7.5). An empty query returns the input list. */
export function searchGigs(gigs: readonly Gig[], query: string): Gig[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return gigs.slice();
  return gigs.filter((g) => matchesQuery(g, tokens));
}

// ---------------------------------------------------------------------------
// distance
// ---------------------------------------------------------------------------

/**
 * Distance from the anchor to the gig's PUBLISHED FUZZED point. The Board, like the Field,
 * never reads the private exact location subdocument (req 3.2, 20.x), so this number is only
 * ever as precise as the fuzz — which is why it is rendered through `distanceWords()`.
 */
export function distanceToAnchorM(gig: Gig, anchor: GeoPoint | null): number | null {
  const p = gig.geoFuzzed;
  if (!anchor || !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  return haversineM(anchor, p);
}

/**
 * The rank floor a doer must clear to claim this gig, as a sortable index.
 * `0` = open to everyone (no `minRank`), `1..5` = the gated ranks in ascending order.
 */
export function requiredRankIndex(gig: Gig): number {
  return gig.minRank ? rankIndex(gig.minRank) + 1 : 0;
}

// ---------------------------------------------------------------------------
// sorting
// ---------------------------------------------------------------------------

/** Deterministic final tie-break: newest first, then by id so the order is total. */
function tieBreak(a: BoardRowData, b: BoardRowData): number {
  const byRecency = (b.gig.createdAt ?? 0) - (a.gig.createdAt ?? 0);
  if (byRecency !== 0) return byRecency;
  return a.gig.id < b.gig.id ? -1 : a.gig.id > b.gig.id ? 1 : 0;
}

/** Rows with no usable distance sink to the bottom of a distance sort rather than vanishing. */
function distanceRank(row: BoardRowData): number {
  return row.distanceM ?? Number.POSITIVE_INFINITY;
}

const COMPARATORS: Record<BoardSort, (a: BoardRowData, b: BoardRowData) => number> = {
  // Newest flare first — the default, and what a returning user wants.
  recency: tieBreak,
  // Best-paid first.
  price: (a, b) => (b.gig.askPrice ?? 0) - (a.gig.askPrice ?? 0) || tieBreak(a, b),
  // Nearest first — the product's whole promise, expressed as a list.
  distance: (a, b) => distanceRank(a) - distanceRank(b) || tieBreak(a, b),
  // Lowest rank floor first, so work anyone can claim leads and gated work follows (§D.6).
  rank: (a, b) => requiredRankIndex(a.gig) - requiredRankIndex(b.gig) || tieBreak(a, b),
};

/** Sort Board rows by one of the four supported orders (req 7.2). Never mutates the input. */
export function sortRows(rows: readonly BoardRowData[], sort: BoardSort): BoardRowData[] {
  return rows.slice().sort(COMPARATORS[sort]);
}

// ---------------------------------------------------------------------------
// composition
// ---------------------------------------------------------------------------

/**
 * Build the Board's rows from a hood-scoped gig list: search, derive distance, then sort.
 * The filter/sort inputs come from the URL (`?q=` / `?sort=`, requirement 25.1) so the
 * resulting view is shareable and back-button correct.
 */
export function buildBoardRows(
  gigs: readonly Gig[],
  filters: { sort: BoardSort; query: string },
  ctx: BoardContext,
): BoardRowData[] {
  const matched = searchGigs(gigs, filters.query);
  const rows = matched.map<BoardRowData>((gig) => ({
    gig,
    distanceM: distanceToAnchorM(gig, ctx.anchor),
  }));
  return sortRows(rows, filters.sort);
}

/** Total rupee value of a row set — the Board's honest "on the board" number (req 9.x). */
export function totalValue(rows: readonly BoardRowData[]): number {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.gig.askPrice) ? r.gig.askPrice : 0), 0);
}
