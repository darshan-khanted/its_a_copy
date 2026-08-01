// Pure gig-visibility filtering for hood-scoped browse (design §C.7, §D.6, §H.5).
//
// This is the query-time projection of the visibility contract: a hood-scoped
// subscription fetches OPEN gigs, and this filter removes gigs the viewer may not
// yet see — those still inside a rank-03+ head-start window, or gated behind a
// poster-set minimum rank the viewer does not meet.
//
// The authoritative rank ordering and `isSignalVisibleTo` live in the rep module
// (task 7.4). To stay decoupled from that work, the rank-dependent decisions here
// are injected via a `ViewerVisibility` predicate rather than hardcoding rank
// indices. Monotonicity (visibility only ever opens over time, req 18.7) is a
// property of the underlying `visibleFrom` timestamps, preserved by this filter.

import type { Gig } from '@/types';

export interface ViewerVisibility {
  /** True when the viewer is rank LEGEND (03) or above and gets the head start. */
  isLegendPlus: boolean;
  /** Whether the viewer's rank satisfies a poster-set minimum rank floor. */
  meetsMinRank: (minRank: Gig['minRank']) => boolean;
}

/**
 * An unauthenticated / rank-01 public viewer: no head start, and only gigs with no
 * minimum-rank floor are visible. This is the default browse identity before the
 * session's real rank is wired in.
 */
export const PUBLIC_VIEWER: ViewerVisibility = {
  isLegendPlus: false,
  meetsMinRank: (minRank) => minRank === null || minRank === undefined,
};

type VisibilityFields = Pick<Gig, 'minRank' | 'visibleFrom'>;

/**
 * Whether a single gig is visible to a viewer at `now`. Tolerant of legacy/seed
 * documents that predate the `visibleFrom`/`minRank` fields: a missing head-start
 * window is treated as "visible now", and a missing floor as "public".
 */
export function isGigVisible(gig: VisibilityFields, viewer: ViewerVisibility, now: number): boolean {
  const minRank = gig.minRank ?? null;
  if (minRank !== null && !viewer.meetsMinRank(minRank)) return false;

  const vf = gig.visibleFrom;
  if (!vf) return true;
  const openAt = viewer.isLegendPlus ? vf.legend : vf.all;
  return typeof openAt !== 'number' || now >= openAt;
}

/** Filter a fetched gig list to those visible to the viewer at `now`. */
export function filterVisibleGigs<T extends VisibilityFields>(
  gigs: readonly T[],
  viewer: ViewerVisibility = PUBLIC_VIEWER,
  now: number = Date.now(),
): T[] {
  return gigs.filter((g) => isGigVisible(g, viewer, now));
}
