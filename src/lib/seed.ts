/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic seeded generation (design §H.8).
 *
 * Pure, I/O-free primitives so they are directly testable (req 30.11).
 *
 * Used for: per-card `--rot` tilt (must never change between renders or the UI
 * visibly jitters — req 1.4), avatar palette selection (req 1.9), ghost-signal
 * placement in empty hoods (req 9.7), and reproducible test fixtures.
 *
 * The prototype's `hash()` — `((sum << 5) - sum + charCode) | 0` — is a fine
 * string hash but a poor PRNG (visible sequential correlation). This upgrades to
 * `xmur3` + `mulberry32`: same determinism, far better distribution.
 *
 * Postconditions:
 * - Identical `key` ⇒ identical sequence, on every device, forever.
 * - `seededRotation(key, max)` ∈ `[−max, max]`.
 * - `seededPick` never returns `undefined` for a non-empty array.
 */

/**
 * xmur3 string hash → 32-bit seed generator.
 * Returns a stateful function producing successive 32-bit unsigned seeds.
 */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * mulberry32 PRNG. Given a 32-bit seed, returns a function yielding uniform
 * floats in the half-open interval [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic uniform [0,1) generator keyed by an arbitrary string.
 * Calling the returned function repeatedly yields a stable, reproducible sequence.
 */
export function seededRandom(key: string): () => number {
  const seedGen = xmur3(key);
  return mulberry32(seedGen());
}

/**
 * Deterministically pick one element of a non-empty array from a string key.
 * Never returns `undefined` for a non-empty array.
 */
export function seededPick<T>(key: string, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('seededPick: cannot pick from an empty array');
  }
  const rnd = seededRandom(key)();
  const index = Math.floor(rnd * items.length) % items.length;
  return items[index];
}

/**
 * Maximum absolute card tilt in degrees (design §B.2 / §K.2). The benchmark's
 * own cards sit within this range; larger tilts create a ragged, hard-to-read
 * left edge in lists.
 */
export const MAX_TILT_DEG = 2.2;

/**
 * Deterministic rotation in degrees derived from a seed. The result is stable
 * across renders and devices for the same key, and always lies within
 * `[−maxDeg, maxDeg]` (req 1.4, design §H.8).
 */
export function seededRotation(key: string, maxDeg: number = MAX_TILT_DEG): number {
  const bound = Math.abs(maxDeg);
  // Map uniform [0,1) → [−bound, bound].
  const r = seededRandom(key)();
  return r * 2 * bound - bound;
}
