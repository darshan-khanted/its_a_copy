/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure geometry of the rendered Field surface (design §C.3, §C.6; reqs 3.3, 3.5,
 * 4.8, 5.7).
 *
 * The Field is a square viewport holding the inscribed disc of radius `radiusM`
 * around the hood anchor. Everything a component needs to *draw* that disc —
 * distance-ring radii, node positions in percent, node positions in cached
 * pixels for the proximity scan — is derived here so the component itself reads
 * no layout geometry and computes no trigonometry per render (req 4.8, NFR-1.5).
 *
 * PURE and I/O-free (req 30.11): no DOM, no clock, no randomness.
 */

import {
  FIELD_DISC_RADIUS,
  type FieldPoint,
  type FieldTransform,
  type FieldWarp,
} from '@/features/field/lib/projection';
import { ringLabel } from '@/copy/labels';

/**
 * Widest the Field square ever renders, in px. Mirrors the `.field-disc` max-width in ink.css
 * (design §I.7: 1:1 centred, max 620 px from 768 px up) so the clustering grid can be sized
 * before the element is measured.
 */
export const FIELD_MAX_WIDTH_PX = 620;

/** Distance rings the Field always draws, in metres (req 3.3, design §C.3). */
export const DEFAULT_RING_RADII_M: readonly number[] = [250, 500, 1000, 2000];

/**
 * The Field's radial warp. `linear` keeps a ring at 250 m at exactly one eighth of
 * the 2000 m disc, which is the most literal reading of "distance rings at 250 /
 * 500 / 1000 / 2000 m". Both warps are monotone, so ordering holds either way
 * (req 3.6) — this is only a legibility choice, and rings are warped with the
 * same function as the nodes so the two can never disagree.
 */
export const FIELD_WARP: FieldWarp = 'linear';

export interface FieldRing {
  /** Ring radius in metres. */
  radiusM: number;
  /** Mono ring label, e.g. `250 M`, `2 KM` (req 3.3). */
  label: string;
  /**
   * Ring radius as a percentage of the Field square's width — i.e. the ring's
   * *radius*, so a full-disc ring reads 50%.
   */
  radiusPct: number;
}

/** Apply the transform's radial warp to a normalised radius in [0, 1]. */
function warpNorm(rNorm: number, warp: FieldWarp): number {
  return warp === 'sqrt' ? Math.sqrt(rNorm) : rNorm;
}

/**
 * The distance rings for a transform (req 3.3). Rings beyond the Field radius are
 * dropped rather than clamped on top of the boundary ring, and each radius is
 * warped exactly as `projectToField` warps a node, so a node sitting on the 500 m
 * ring is genuinely 500 m away.
 */
export function fieldRings(
  transform: Pick<FieldTransform, 'radiusM' | 'warp'>,
  radiiM: readonly number[] = DEFAULT_RING_RADII_M,
): FieldRing[] {
  const rings: FieldRing[] = [];
  for (const radiusM of radiiM) {
    if (!Number.isFinite(radiusM) || radiusM <= 0 || radiusM > transform.radiusM) continue;
    const rNorm = warpNorm(radiusM / transform.radiusM, transform.warp);
    rings.push({
      radiusM,
      label: ringLabel(radiusM),
      radiusPct: rNorm * FIELD_DISC_RADIUS * 100,
    });
  }
  return rings;
}

/**
 * Node positions in *pixels*, screen-relative to the Field element's top-left, as
 * the packed `[x0,y0,x1,y1,…]` buffer the proximity scan expects. Computed once
 * per projection/resize; the scan then reads no layout geometry at all (req 4.8).
 */
export function nodePositionsPx(
  nodes: readonly FieldPoint[],
  widthPx: number,
  heightPx: number = widthPx,
): Float32Array {
  const w = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 0;
  const h = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : w;
  const out = new Float32Array(nodes.length * 2);
  for (let i = 0; i < nodes.length; i++) {
    out[2 * i] = nodes[i].fx * w;
    out[2 * i + 1] = nodes[i].fy * h;
  }
  return out;
}

export interface FieldPercentPosition {
  left: string;
  top: string;
}

/** A node's CSS position as percentages of the Field square (layout only). */
export function positionPercent(node: FieldPoint): FieldPercentPosition {
  return { left: `${node.fx * 100}%`, top: `${node.fy * 100}%` };
}

/**
 * Field-space radial distance of a node from the anchor, normalised to [0, 1]
 * where 1 is the disc boundary. Used to stagger node reveal from the centre
 * outwards, which is decoration only and never reorders anything.
 */
export function normalisedRadius(node: FieldPoint): number {
  const dx = node.fx - 0.5;
  const dy = node.fy - 0.5;
  return Math.min(1, Math.hypot(dx, dy) / FIELD_DISC_RADIUS);
}
