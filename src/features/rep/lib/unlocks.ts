// Rank-derived capability unlocks. Skeleton mapping — the authoritative thresholds,
// cumulative inheritance and gates are implemented in task 7.1 (design §H.5).
import type { RankId, Unlocks } from '@/types';

export const RANK_ORDER: RankId[] = [
  'TAPPED_IN',
  'HUSTLER',
  'LEGEND',
  'MAX_CHARISMA',
  'MYTH',
];

export function rankIndex(rank: RankId): number {
  const i = RANK_ORDER.indexOf(rank);
  return i < 0 ? 0 : i;
}

/** Cumulative: higher ranks retain every lower-rank capability (design §H.5, req 17.8). */
export function unlocksForRank(rank: RankId): Unlocks {
  const idx = rankIndex(rank);
  return {
    maxActiveClaims: idx >= 1 ? 3 : 1,
    headStartMins: idx >= 2 ? 10 : 0,
    canBoost: idx >= 2,
    canVouch: idx >= 3,
    canCouncil: idx >= 4,
    canAttachPhoto: idx >= 1,
    customMarkerColor: idx >= 2,
  };
}
