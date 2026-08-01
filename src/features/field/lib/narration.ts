/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Spatial narration for the Field (design §I.3; reqs 4.4, 4.6, 9.2, 20.6).
 *
 * Every node on the radar carries an accessible name that states its position in
 * human words:
 *
 *   "assemble my ikea desk. ₹450. 310 m north-east. posted 12 minutes ago.
 *    2 people claimed."
 *
 * Two invariants make this honest rather than decorative:
 * - Bearing is spoken as a compass octant, never as degrees (§I.3.2).
 * - Distance reuses `distanceWords`, the same privacy-rounded granularity the
 *   visual uses (req 20.6, NFR-4.2), so the spoken and drawn representations can
 *   never disagree and neither is more precise than the fuzz.
 *
 * PURE and I/O-free (req 30.11): no DOM, no clock, no randomness. Titles are
 * user-authored and pass through untouched (req 2.3).
 */

import { COMPASS_OCTANTS, agoWords, claimedWords, fieldVoice, type CompassOctant } from '@/copy/field';
import { distanceWords, rupees } from '@/lib/format';
import type { FieldSignal, GhostFieldSignal, RealFieldCluster, RealFieldSignal } from '@/types';

/**
 * The compass octant a bearing falls in — 0° is north, increasing clockwise.
 * Bearings are wrapped, so 350° reads `north` and −45° reads `north-west`.
 */
export function octantWords(bearing: number): CompassOctant {
  if (!Number.isFinite(bearing)) return COMPASS_OCTANTS[0];
  const wrapped = ((bearing % 360) + 360) % 360;
  return COMPASS_OCTANTS[Math.round(wrapped / 45) % 8];
}

/** `310 m north-east` — rounded distance plus spoken bearing. */
export function positionWords(distanceM: number, bearing: number): string {
  const distance = distanceWords(distanceM);
  const octant = octantWords(bearing);
  return distance ? `${distance} ${octant}` : octant;
}

export interface SignalNarrationInput {
  /** Claim count from the public gig document, when known (design §C.3). */
  claimCount?: number;
}

/**
 * Accessible name for a real signal node (design §I.3.2). Sentence-joined so a
 * screen reader pauses between facts rather than running them together.
 */
export function signalAccessibleName(
  signal: RealFieldSignal,
  input: SignalNarrationInput = {},
): string {
  return [
    signal.title,
    rupees(signal.price),
    positionWords(signal.distanceM, signal.bearingDeg),
    `${fieldVoice.posted} ${agoWords(signal.ageMins)}`,
    claimedWords(input.claimCount ?? 0),
  ]
    .filter((part) => part.trim() !== '')
    .join('. ')
    .concat('.');
}

/**
 * Accessible name for a cluster node (req 5.2, 5.3). States the member count and
 * the summed value, and that activating it opens a list — never that it zooms.
 */
export function clusterAccessibleName(cluster: RealFieldCluster): string {
  const count = Math.max(0, Math.floor(cluster.count));
  const noun = count === 1 ? 'signal' : 'signals';
  return `${count} ${noun} here. ${rupees(cluster.totalValue)} together. ${fieldVoice.clusterHint}`;
}

/**
 * Accessible name for a hollow waitlist ghost (req 9.1, 9.2). It never claims to
 * be work: no price, no title beyond `WAITING`, and the description says so.
 */
export function ghostAccessibleName(_ghost: GhostFieldSignal): string {
  return fieldVoice.ghostSignal;
}

/** Accessible name for any Field node, dispatched on its kind. */
export function nodeAccessibleName(node: FieldSignal, input: SignalNarrationInput = {}): string {
  switch (node.kind) {
    case 'REAL_GIG':
      return signalAccessibleName(node, input);
    case 'REAL_GIG_CLUSTER':
      return clusterAccessibleName(node);
    case 'WAITLIST_GHOST':
      return ghostAccessibleName(node);
    default:
      return '';
  }
}

/**
 * Live-region text for a deliberate keyboard move (design §I.3.3). Only deliberate
 * changes are announced; pointer previews stay `aria-hidden`.
 */
export function moveAnnouncement(name: string): string {
  return `${fieldVoice.nowOn}: ${name}`;
}
