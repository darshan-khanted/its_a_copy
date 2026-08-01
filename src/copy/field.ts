/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Field's expressive copy: spatial narration fragments, region descriptions,
 * and the honest location-privacy lines (design §C.3, §C.4, §I.3; reqs 3.4, 4.4,
 * 4.6, 20.9).
 *
 * A radar is a spatial visualisation, and the Field's screen-reader
 * representation is not a degraded fallback — it narrates position in words
 * (§I.3.2). Bearing is spoken as a compass octant, never as degrees; distance
 * reuses the privacy-rounded granularity of `distanceWords` so the spoken and
 * visual representations can never disagree.
 *
 * These are expressive strings (lowercase, in voice) so they live here and not in
 * `labels`, which is UPPERCASE MONO functional text. Composition into a full
 * accessible name happens in `@/features/field/lib/narration`.
 */

/**
 * Compass octants, in clockwise order from north. Index = `round(bearing / 45) % 8`.
 * Spoken instead of degrees (design §I.3.2).
 */
export const COMPASS_OCTANTS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

export type CompassOctant = (typeof COMPASS_OCTANTS)[number];

export const fieldVoice = {
  /** Accessible name of the `role="application"` Field region (§I.3.4). */
  regionLabel: 'live proximity field',
  /** Instruction announced on focus so arrow-key capture is never a trap (§I.3.4). */
  regionHint: 'arrow keys move between signals, enter opens one, escape leaves the field',
  /** The anchor marker at the centre of the disc. */
  youHere: 'you are here, the centre of your hood',
  /** Why no location permission is needed (req 3.4, design §C.2). */
  anchoredOnHood: 'anchored on your hood centre. no location permission needed.',
  /** Live-location anchor mode, opted in (req 3.4). */
  anchoredOnYou: 'anchored on your live location. true distances from where you are standing.',
  /** Permission refused or unavailable — the hood centre keeps working. */
  precisionUnavailable: 'we could not read your location, so the field stays on your hood centre.',
  /** Ghost node description (req 9.1, 9.2) — demand waiting, never a gig. */
  ghostSignal: 'a neighbour waiting on the waitlist. not a gig.',
  /** Prefix for a deliberate traversal announcement (§I.3.3). */
  nowOn: 'now on',
  /** Posted-time prefix in a spoken signal name. */
  posted: 'posted',
  /** Cluster node description (req 5.2, 5.3). */
  clusterHint: 'several signals in the same block. opens as a list.',
  /** Why a fuzzed node is all the Field will ever show (req 20.9, design §C.1). */
  approximateSpot: 'positions are approximate on purpose. the exact spot is shared only once you both agree.',
  /** The drawer that slides up for the previewed signal. */
  drawerLabel: 'signal detail',
} as const;

export type FieldVoiceKey = keyof typeof fieldVoice;

/** `2 people claimed` / `1 person claimed` / `nobody has claimed yet`. */
export function claimedWords(claimCount: number): string {
  const n = Number.isFinite(claimCount) ? Math.max(0, Math.floor(claimCount)) : 0;
  if (n === 0) return 'nobody has claimed yet';
  return n === 1 ? '1 person claimed' : `${n} people claimed`;
}

/** `12 minutes ago` / `just now` / `3 hours ago` — spoken form, no abbreviations. */
export function agoWords(ageMins: number): string {
  const mins = Number.isFinite(ageMins) ? Math.max(0, Math.round(ageMins)) : 0;
  if (mins < 1) return 'just now';
  if (mins < 60) return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
