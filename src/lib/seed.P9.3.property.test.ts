/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Property test P9.3 — deterministic tilt (design §J.9).
 *
 * A card's rotation must be stable across renders/devices for the same key and
 * must never exceed the configured maximum absolute rotation. Because
 * `seededRotation` is pure and I/O-free, repeated calls model "same key across
 * different devices": identical input ⇒ identical output on any machine.
 *
 * Per the tasks.md wave-parallelism note, this property lives in its own
 * `P9.3` file and only consumes the shared helpers from `./seed`.
 *
 * Validates: Requirements 1.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { seededRotation, MAX_TILT_DEG } from './seed';

describe('P9.3 deterministic tilt remains stable and bounded', () => {
  it('same key + limit ⇒ identical rotation, and |rotation| <= max', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        (key, max) => {
          const r1 = seededRotation(key, max);
          const r2 = seededRotation(key, max);
          // Determinism: repeated calls (i.e. different renders/devices) match exactly.
          expect(r1).toBe(r2);
          // Bounds: absolute rotation never exceeds the configured maximum.
          expect(Math.abs(r1)).toBeLessThanOrEqual(max);
        },
      ),
    );
  });

  it('is deterministic across many independent calls for the same key', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.integer({ min: 2, max: 8 }),
        (key, max, calls) => {
          const first = seededRotation(key, max);
          for (let i = 0; i < calls; i++) {
            expect(seededRotation(key, max)).toBe(first);
          }
        },
      ),
    );
  });

  it('uses MAX_TILT_DEG bounds when no explicit limit is supplied', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (key) => {
        const r = seededRotation(key);
        expect(seededRotation(key)).toBe(r);
        expect(Math.abs(r)).toBeLessThanOrEqual(MAX_TILT_DEG);
      }),
    );
  });
});
