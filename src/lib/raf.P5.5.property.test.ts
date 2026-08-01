/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Property test P5.5 — "Any event burst causes at most one active change per
 * animation frame" (task 3.20).
 *
 * Property P5.5 is the throttling invariant behind the Scan Module: no matter how
 * fast pointer/scroll/touch events fire, the per-frame work (the nearest-signal
 * search that produces at most one active-signal change) must run AT MOST ONCE per
 * animation frame, and — when it does run — it must run with the MOST RECENT input
 * (design §H.2, §J.5; req 4.7). `rafThrottle` is the primitive that enforces this,
 * so exercising it under arbitrary event bursts is the faithful, I/O-free way to
 * prove the requirement.
 *
 * Strategy: the `property` vitest project runs in a bare `node` environment with no
 * DOM and no real animation-frame clock, so we install a fully deterministic
 * `requestAnimationFrame`/`cancelAnimationFrame` stub on `globalThis` that simply
 * queues callbacks. We then drive an ARBITRARY interleaving of two commands —
 * `call` (invoke the throttled function with a value) and `frame` (flush exactly one
 * animation frame) — and check, against an independent oracle, three things:
 *   1. the wrapped function fires at most once per flushed frame (never more,
 *      regardless of how many calls the burst contained);
 *   2. at no instant is more than one frame scheduled for an outstanding burst;
 *   3. each fire carries the most recent argument seen since the previous fire.
 * Per the tasks.md wave-parallelism note this property lives in its own `P5.5`
 * file and only imports the shared `rafThrottle` from `./raf`.
 *
 * Validates: Requirements 4.7
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { rafThrottle } from './raf';

type RafGlobal = typeof globalThis & {
  requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame?: (id: number) => void;
};

describe('P5.5 any event burst causes at most one active change per animation frame (req 4.7)', () => {
  const g = globalThis as RafGlobal;

  // A deterministic fake animation-frame clock. `queue` holds the callbacks that
  // are scheduled for the *next* frame; a cancelled slot becomes null. Flushing a
  // frame runs exactly the callbacks outstanding at that instant — callbacks that
  // (re)schedule during the flush land in a fresh queue and belong to a later
  // frame, mirroring how a real browser never re-enters the same rAF tick.
  let queue: Array<FrameRequestCallback | null>;
  let savedRaf: RafGlobal['requestAnimationFrame'];
  let savedCaf: RafGlobal['cancelAnimationFrame'];

  const scheduledCount = (): number =>
    queue.reduce((n, cb) => n + (cb ? 1 : 0), 0);

  const flushOneFrame = (): void => {
    const current = queue;
    queue = []; // callbacks scheduled during the flush go to the next frame
    for (const cb of current) {
      if (cb) cb(0);
    }
  };

  beforeEach(() => {
    savedRaf = g.requestAnimationFrame;
    savedCaf = g.cancelAnimationFrame;
    queue = [];
    // 1-based ids so `cancelAnimationFrame(id)` maps to `queue[id - 1]`.
    g.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      queue.push(cb);
      return queue.length;
    };
    g.cancelAnimationFrame = (id: number): void => {
      if (id >= 1 && id <= queue.length) queue[id - 1] = null;
    };
  });

  afterEach(() => {
    g.requestAnimationFrame = savedRaf;
    g.cancelAnimationFrame = savedCaf;
  });

  // A command stream: either push a value through the throttle, or advance one
  // animation frame. Arbitrary interleavings model arbitrary event bursts landing
  // between (and across) frame boundaries at any rate.
  const command = fc.oneof(
    fc.record({ kind: fc.constant('call' as const), value: fc.integer() }),
    fc.record({ kind: fc.constant('frame' as const) }),
  );

  it('fires at most once per frame, with the latest argument, for any burst pattern', () => {
    fc.assert(
      fc.property(fc.array(command, { maxLength: 200 }), (commands) => {
        // Reset the fake clock for this run (the closures above read `queue` live,
        // so reassigning it here is observed by the stubbed rAF/cAF).
        queue = [];

        const received: number[] = [];
        const throttled = rafThrottle((v: number) => {
          received.push(v);
        });

        // Independent oracle mirroring rafThrottle's contract without reusing its
        // machinery: track whether a call is pending since the last fire and the
        // most recent argument, then predict exactly what each frame must produce.
        let pending = false;
        let latest = 0;
        const expected: number[] = [];

        for (const cmd of commands) {
          if (cmd.kind === 'call') {
            throttled(cmd.value);
            pending = true;
            latest = cmd.value;
            // Invariant (2): a burst never queues more than one frame of work,
            // no matter how many calls it contains.
            expect(scheduledCount()).toBeLessThanOrEqual(1);
          } else {
            const willFire = pending;
            const willValue = latest;
            flushOneFrame();
            if (willFire) {
              expected.push(willValue);
              pending = false;
            }
            // A flush drains the queue; nothing new is scheduled until the next
            // call, so no frame remains outstanding after flushing.
            expect(scheduledCount()).toBe(0);
            // Invariant (1) + (3), checked incrementally: after every frame the
            // full fire history matches the oracle exactly (count and arguments).
            expect(received).toEqual(expected);
          }
        }

        // Trailing calls that were never followed by a frame must NOT have fired:
        // an event burst with no frame boundary produces zero active changes.
        expect(received).toEqual(expected);
      }),
      { numRuns: 1000 },
    );
  });

  // Concrete, human-readable anchors for the property above.
  it('collapses a dense burst within a single frame into one fire with the last value', () => {
    const received: number[] = [];
    const throttled = rafThrottle((v: number) => received.push(v));
    for (let i = 1; i <= 50; i++) throttled(i);
    expect(scheduledCount()).toBe(1); // one frame for the whole burst
    flushOneFrame();
    expect(received).toEqual([50]); // exactly one fire, with the most recent arg
  });

  it('fires once per frame across successive bursts', () => {
    const received: number[] = [];
    const throttled = rafThrottle((v: number) => received.push(v));
    throttled(1);
    throttled(2);
    flushOneFrame(); // -> 2
    throttled(3);
    flushOneFrame(); // -> 3
    flushOneFrame(); // no pending work: no extra fire
    expect(received).toEqual([2, 3]);
  });

  it('does not fire when a burst is never followed by a frame', () => {
    const received: number[] = [];
    const throttled = rafThrottle((v: number) => received.push(v));
    throttled(7);
    throttled(8);
    expect(received).toEqual([]); // no frame flushed => no active change yet
    expect(scheduledCount()).toBe(1);
  });
});
