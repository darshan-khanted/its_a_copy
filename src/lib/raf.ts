/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * requestAnimationFrame scheduling helpers for the Field's per-frame work
 * (design §C.6, §H.2; reqs 4.7, 4.9; NFR-1.5).
 *
 * `rafThrottle` guarantees that, regardless of how fast input events fire, the
 * wrapped function runs at most once per animation frame with the most recent
 * arguments. This is what lets the proximity scan do at most one nearest-signal
 * search and at most one active-signal change per frame (req 4.7).
 *
 * `coalescedPointer` collapses a burst of buffered pointer moves into the single
 * latest position via `getCoalescedEvents()` when the browser supports it, so a
 * high-frequency pointer/touch stream still costs one search per frame.
 */

type AnyFn<A extends unknown[]> = (...args: A) => void;

export interface RafThrottled<A extends unknown[]> {
  (...args: A): void;
  /** Cancel a pending frame, if any. */
  cancel(): void;
}

/**
 * Wrap `fn` so it runs at most once per animation frame with the latest arguments.
 *
 * A frame is scheduled on the first call; subsequent calls before the frame fires
 * only update the pending arguments (they do not schedule additional frames). This
 * makes it impossible for an event burst to queue more than one frame of work.
 */
export function rafThrottle<A extends unknown[]>(fn: AnyFn<A>): RafThrottled<A> {
  let frame: number | null = null;
  let pending: A | null = null;

  const raf: (cb: FrameRequestCallback) => number =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

  const caf: (id: number) => void =
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

  const run = () => {
    frame = null;
    const args = pending;
    pending = null;
    if (args) fn(...args);
  };

  const throttled = ((...args: A) => {
    pending = args;
    if (frame !== null) return; // a frame is already outstanding — coalesce
    frame = raf(run);
  }) as RafThrottled<A>;

  throttled.cancel = () => {
    if (frame !== null) {
      caf(frame);
      frame = null;
    }
    pending = null;
  };

  return throttled;
}

export interface PointerSample {
  clientX: number;
  clientY: number;
}

/**
 * Collapse a pointer event's buffered moves to the single latest sample. Uses
 * `getCoalescedEvents()` when available (it batches sub-frame moves), otherwise
 * falls back to the event itself. Never throws for a plain `{clientX, clientY}`.
 */
export function coalescedPointer(e: PointerEvent): PointerSample {
  const maybe = e as PointerEvent & {
    getCoalescedEvents?: () => PointerEvent[];
  };
  if (typeof maybe.getCoalescedEvents === 'function') {
    const events = maybe.getCoalescedEvents();
    if (events && events.length > 0) {
      const last = events[events.length - 1];
      return { clientX: last.clientX, clientY: last.clientY };
    }
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

/**
 * A simple leading-edge-off, trailing-edge debounce built on timers. Used for the
 * spatial live-region announcer, which must fire at most once per interval
 * (design §I.3: one announcement per 1.5 s).
 */
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

export function debounce<A extends unknown[]>(fn: AnyFn<A>, waitMs: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const debounced = ((...args: A) => {
    pending = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = pending;
      pending = null;
      if (a) fn(...a);
    }, waitMs);
  }) as Debounced<A>;

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const a = pending;
    pending = null;
    if (a) fn(...a);
  };

  return debounced;
}
