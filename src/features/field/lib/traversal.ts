/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Geographic keyboard traversal of Field signals (design §C.4, §I.3; req 4.4).
 *
 * Keyboard users do NOT walk the Field in DOM order — they walk it by geography,
 * exactly as a sighted user reads the radar:
 *   →  next signal CLOCKWISE by bearing (around the anchor)
 *   ↑  next signal CLOSER to the anchor
 *   ↓  next signal FURTHER from the anchor
 *
 * This module is PURE and I/O-free (req 30.11): it operates on cached field-space
 * points and returns the destination index (or `null` when there is nowhere to go).
 * The React glue — capturing arrow keys, announcing the move, opening on Enter —
 * lives in `useFieldKeyboard`.
 *
 * Field space (design §H.1): unit square, anchor at (0.5, 0.5), y grows downward
 * (screen space). Bearing is measured 0 = north, increasing clockwise, matching
 * the projection module's `bearingDeg`.
 */

export interface FieldNodeGeometry {
  /** Field-space x in [0, 1]. */
  fx: number;
  /** Field-space y in [0, 1]. */
  fy: number;
}

/** Field-space centre (the hood anchor) in unit coordinates. */
const CENTER = 0.5;

/** Squared radial distance from the anchor. Cheaper than `radialDistance` for comparisons. */
function radial2(n: FieldNodeGeometry): number {
  const dx = n.fx - CENTER;
  const dy = n.fy - CENTER;
  return dx * dx + dy * dy;
}

/**
 * Bearing of a node from the anchor, in degrees, 0 = north (up), increasing
 * clockwise, in [0, 360). Screen y is inverted, so "north" is negative dy.
 */
export function nodeBearingDeg(n: FieldNodeGeometry): number {
  const dx = n.fx - CENTER;
  const dy = n.fy - CENTER;
  // atan2(east, north): east = dx, north = -dy (up is negative screen-y).
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * The next signal CLOCKWISE from `current` by bearing (→).
 *
 * Chooses the node with the smallest positive clockwise angular delta from the
 * current node's bearing. Wraps around past 360°. Nodes sharing the current
 * node's exact bearing (delta 0) are considered a full turn away so traversal
 * always advances. Ties in delta break to the lowest index (determinism).
 */
export function nextClockwise(
  nodes: readonly FieldNodeGeometry[],
  current: number,
): number | null {
  if (current < 0 || current >= nodes.length) return null;
  const from = nodeBearingDeg(nodes[current]);
  let bestIdx: number | null = null;
  let bestDelta = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (i === current) continue;
    let delta = (nodeBearingDeg(nodes[i]) - from + 360) % 360;
    // A node at the identical bearing is a full turn away, not a no-op.
    if (delta === 0) delta = 360;
    if (delta < bestDelta || (delta === bestDelta && (bestIdx === null || i < bestIdx))) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * The next signal COUNTER-CLOCKWISE from `current` by bearing (←).
 *
 * The mirror of `nextClockwise`: smallest positive counter-clockwise angular
 * delta, wrapping past 0°, with identical-bearing nodes a full turn away and ties
 * breaking to the lowest index. Not required by the spec (which names →/↑/↓ only)
 * but provided so ← is a natural reverse of →.
 */
export function nextCounterClockwise(
  nodes: readonly FieldNodeGeometry[],
  current: number,
): number | null {
  if (current < 0 || current >= nodes.length) return null;
  const from = nodeBearingDeg(nodes[current]);
  let bestIdx: number | null = null;
  let bestDelta = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (i === current) continue;
    let delta = (from - nodeBearingDeg(nodes[i]) + 360) % 360;
    if (delta === 0) delta = 360;
    if (delta < bestDelta || (delta === bestDelta && (bestIdx === null || i < bestIdx))) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * The next signal CLOSER to the anchor than `current` (↑).
 *
 * Picks the immediate inward neighbour: the node with the greatest radial
 * distance among those strictly closer than the current node. Ties break to the
 * lowest index. Returns `null` when nothing is closer.
 */
export function nextCloser(
  nodes: readonly FieldNodeGeometry[],
  current: number,
): number | null {
  if (current < 0 || current >= nodes.length) return null;
  const cur = radial2(nodes[current]);
  let bestIdx: number | null = null;
  let bestR = -Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (i === current) continue;
    const r = radial2(nodes[i]);
    if (r < cur) {
      if (r > bestR || (r === bestR && (bestIdx === null || i < bestIdx))) {
        bestR = r;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

/**
 * The next signal FURTHER from the anchor than `current` (↓).
 *
 * Picks the immediate outward neighbour: the node with the smallest radial
 * distance among those strictly further than the current node. Ties break to the
 * lowest index. Returns `null` when nothing is further.
 */
export function nextFurther(
  nodes: readonly FieldNodeGeometry[],
  current: number,
): number | null {
  if (current < 0 || current >= nodes.length) return null;
  const cur = radial2(nodes[current]);
  let bestIdx: number | null = null;
  let bestR = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (i === current) continue;
    const r = radial2(nodes[i]);
    if (r > cur) {
      if (r < bestR || (r === bestR && (bestIdx === null || i < bestIdx))) {
        bestR = r;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

/**
 * The node closest to the anchor overall. Used as the entry point when the Field
 * region gains focus with no active signal (keyboard traversal must start
 * somewhere deterministic). Ties break to the lowest index.
 */
export function nearestToAnchor(nodes: readonly FieldNodeGeometry[]): number | null {
  let bestIdx: number | null = null;
  let bestR = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const r = radial2(nodes[i]);
    if (r < bestR) {
      bestR = r;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export type FieldDirection = 'clockwise' | 'counter-clockwise' | 'closer' | 'further';

/**
 * Dispatch a directional traversal step. Returns the destination index or `null`
 * when there is no signal in that direction.
 */
export function traverse(
  nodes: readonly FieldNodeGeometry[],
  current: number,
  direction: FieldDirection,
): number | null {
  switch (direction) {
    case 'clockwise':
      return nextClockwise(nodes, current);
    case 'counter-clockwise':
      return nextCounterClockwise(nodes, current);
    case 'closer':
      return nextCloser(nodes, current);
    case 'further':
      return nextFurther(nodes, current);
    default:
      return null;
  }
}
