/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Functional text: labels, statuses, metadata, and navigation (design §B.5, req 2.3).
 *
 * All functional copy is UPPERCASE MONO with 0.14em tracking applied via the
 * `.mono-label` utility in the design system — the tracking is a CSS concern,
 * the CASING is a copy concern and lives here. No emoji ever appears in a mono
 * label (req 2.5). Voice-linted by `@/lib/voice`.
 */
export const labels = {
  // Navigation (design §F.4)
  field: 'FIELD',
  board: 'BOARD',
  inbox: 'INBOX',
  me: 'ME',
  flare: 'FLARE',
  switchToList: 'SWITCH TO LIST',
  fieldBoardToggle: 'FIELD ⇄ BOARD',
  lookAtNearbyHoods: 'LOOK AT NEARBY HOODS',
  postAFlare: 'POST A FLARE',
  beFirst: 'BE FIRST',
  pullFriendsIn: 'PULL 3 FRIENDS IN',
  shareThisHood: 'SHARE THIS HOOD',
  switchHood: 'SWITCH HOOD',
  furtherAway: 'FURTHER AWAY',
  notLive: 'NOT LIVE YET',

  // Statuses (paired with text per req 27.4)
  open: 'OPEN',
  matched: 'MATCHED',
  live: 'LIVE',
  settled: 'SETTLED',
  disputed: 'DISPUTED',
  underReview: 'UNDER REVIEW',
  waiting: 'WAITING',
  waitlist: 'WAITLIST',
  precisionOn: 'PRECISION: ON',
  urgent: 'URGENT',
  qgTeam: 'QG TEAM',

  // Metadata
  rep: 'REP',
  rank: 'RANK',
  claims: 'CLAIMS',
  distance: 'DISTANCE',
  price: 'PRICE',
  recency: 'RECENCY',
  requiredRank: 'REQUIRED RANK',
  platformTake: 'PLATFORM TAKE',
  youPay: 'YOU PAY',
  theyReceive: 'THEY RECEIVE',

  // Progression / gates
  firstFlareBonus: 'FIRST FLARE = DOUBLE REP',
  headStart: 'EARLY',
  unlocksAtRank: 'UNLOCKS AT RANK',

  // Rating chips (req 24.2, 24.3)
  newSignal: 'NEW',
  early: 'EARLY',

  // Rhythm / history
  notEnoughHistory: 'NOT ENOUGH HISTORY YET · CHECK BACK',

  // Hood claim (design §C.7)
  notFoundArea: 'NOT FOUND — YOU CAN STILL TYPE YOUR AREA',
} as const;

export type LabelKey = keyof typeof labels;

/**
 * Field node-budget truncation line (req 5.4). Functional uppercase mono.
 */
export function showingOf(shown: number, total: number): string {
  return `SHOWING ${shown} OF ${total} · OPEN BOARD FOR ALL`;
}

/**
 * Hood pre-launch progress line (req 9.4). Functional uppercase mono.
 */
export function hoodProgress(current: number, target: number): string {
  return `${current} / ${target} NEIGHBOURS · OPENS AT ${target}`;
}
