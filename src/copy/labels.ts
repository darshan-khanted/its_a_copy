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
  precisionOff: 'PRECISION: OFF',
  urgent: 'URGENT',
  qgTeam: 'QG TEAM',

  // Field chrome (design §C.3)
  you: 'YOU',
  close: 'CLOSE',
  openSignal: 'OPEN SIGNAL',
  openBoard: 'OPEN BOARD',

  // Board controls (design §C.8, req 7.2, 7.5, 25.8)
  sortBy: 'SORT',
  search: 'SEARCH',
  clearSearch: 'CLEAR',
  openToAll: 'OPEN TO ALL',
  signals: 'SIGNALS',

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

  // Compose Flow beats (design §E.2, req 10.1)
  composeWhat: 'WHAT',
  composeValue: 'VALUE',
  composeWhen: 'WHERE & WHEN',
  next: 'NEXT',
  back: 'BACK',
  publishFlare: 'SEND THE FLARE',
  today: 'TODAY',
  tomorrow: 'TOMORROW',
  thisWeek: 'THIS WEEK',
  flexible: 'FLEXIBLE',
  addPhoto: 'ADD A PHOTO',
  median: 'MEDIAN',
  makeItUrgent: 'MAKE IT URGENT',
  urgentNote: 'EXPIRES IN 6 HOURS',
} as const;

export type LabelKey = keyof typeof labels;

/**
 * Field node-budget truncation line (req 5.4). Functional uppercase mono.
 */
export function showingOf(shown: number, total: number): string {
  return `SHOWING ${shown} OF ${total} · OPEN BOARD FOR ALL`;
}

/**
 * The Board's tally line: how many signals are listed and what they are worth
 * (design §C.8). `value` is already rupee-formatted by `rupees()`.
 */
export function boardTally(count: number, value: string): string {
  return `${count} SIGNALS · ${value} ON THE BOARD`;
}

/**
 * How much of the board a search is showing (req 7.5). Functional uppercase mono.
 */
export function matchTally(shown: number, total: number): string {
  return `${shown} OF ${total} MATCH`;
}

/**
 * Hood pre-launch progress line (req 9.4). Functional uppercase mono.
 */
export function hoodProgress(current: number, target: number): string {
  return `${current} / ${target} NEIGHBOURS · OPENS AT ${target}`;
}

/**
 * The Field footer's count of real signals inside the disc (design §C.3, req 3.9).
 * Ghost nodes are never counted here — the number comes from the real-supply
 * metrics (req 9.2).
 */
export function signalsInRange(count: number): string {
  return `${count} ${count === 1 ? 'SIGNAL' : 'SIGNALS'} IN RANGE`;
}

/**
 * The Field footer's total real rupee value (design §C.3, req 3.9). `value` is
 * already rupee-formatted by `rupees()`.
 */
export function onTheBoard(value: string): string {
  return `${value} ON THE BOARD`;
}

/**
 * Distance-ring label on the Field (design §C.3, req 3.3): `250 M` … `2 KM`.
 */
export function ringLabel(radiusM: number): string {
  if (radiusM >= 1000) {
    const km = radiusM / 1000;
    const text = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return `${text} KM`;
  }
  return `${Math.round(radiusM)} M`;
}

/**
 * Claim tally on a signal (req 28-adjacent Field chrome, design §C.3): how many
 * neighbours have raised a hand. Functional uppercase mono.
 */
export function claimsTally(count: number): string {
  return `${count} ${count === 1 ? 'CLAIM' : 'CLAIMS'}`;
}

/**
 * The Compose Flow's broadcast-reach line (design §E.2, req 10.7): how many
 * neighbours this flare will reach, from the hood's real 30-day active member
 * count. Functional uppercase mono.
 */
export function reachLine(activeMembers30d: number): string {
  return `REACHING ${activeMembers30d} ${activeMembers30d === 1 ? 'NEIGHBOUR' : 'NEIGHBOURS'}`;
}

/**
 * The Compose Flow's price-guidance range (design §E.2, req 10.4): the hood's
 * real 25th-to-75th-percentile band. `rupees(...)` values are pre-formatted.
 */
export function priceGuidanceLine(p25: string, p75: string): string {
  return `SIMILAR GIGS WENT FOR ${p25}–${p75}`;
}
