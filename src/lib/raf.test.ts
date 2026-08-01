import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coalescedPointer, debounce, rafThrottle } from './raf';

describe('rafThrottle', () => {
  let queue: FrameRequestCallback[];

  beforeEach(() => {
    queue = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb);
      return queue.length; // 1-based id
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      queue[id - 1] = () => {};
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flush = () => {
    const pending = queue;
    queue = [];
    pending.forEach((cb) => cb(0));
  };

  it('runs at most once per frame with the latest arguments', () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(fn).not.toHaveBeenCalled();
    expect(queue.length).toBe(1); // only one frame scheduled for the burst
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('schedules a fresh frame after the previous one fires', () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);
    throttled('a');
    flush();
    throttled('b');
    flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
  });

  it('cancel prevents a pending frame from running', () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);
    throttled('x');
    throttled.cancel();
    flush();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses a burst into one trailing call with the latest args', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1500);
    d('a');
    d('b');
    d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('flush fires immediately and cancel discards', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d('flushed');
    d.flush();
    expect(fn).toHaveBeenCalledWith('flushed');
    d('discarded');
    d.cancel();
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('coalescedPointer', () => {
  it('returns the last coalesced sample when available', () => {
    const e = {
      clientX: 1,
      clientY: 1,
      getCoalescedEvents: () => [
        { clientX: 5, clientY: 6 },
        { clientX: 7, clientY: 8 },
      ],
    } as unknown as PointerEvent;
    expect(coalescedPointer(e)).toEqual({ clientX: 7, clientY: 8 });
  });

  it('falls back to the event itself without coalescing support', () => {
    const e = { clientX: 3, clientY: 4 } as PointerEvent;
    expect(coalescedPointer(e)).toEqual({ clientX: 3, clientY: 4 });
  });
});
