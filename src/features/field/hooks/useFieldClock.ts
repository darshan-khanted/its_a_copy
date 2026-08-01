/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Field's ticking clock (design §C.3, req 3.9).
 *
 * The prototype's `HH:MM:SS` clock is a real trust signal: it proves the surface
 * is live rather than a screenshot. One interval per mounted Field, torn down on
 * unmount, and paused while the document is hidden so a backgrounded tab does no
 * work at all.
 */
import { useEffect, useState } from 'react';
import { clockTime } from '@/lib/format';

/** Tick interval. One second — the clock shows seconds. */
export const CLOCK_TICK_MS = 1000;

export function useFieldClock(tickMs: number = CLOCK_TICK_MS): string {
  const [time, setTime] = useState<string>(() => clockTime());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => setTime(clockTime());

    const start = () => {
      if (timer !== null) return;
      tick();
      timer = setInterval(tick, tickMs);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') start();
      else stop();
    };

    onVisibility();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [tickMs]);

  return time;
}
