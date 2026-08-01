/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Measured element size (design §C.6, reqs 4.8, 5.7).
 *
 * The Field needs its rendered pixel size for exactly two things: the cached
 * node positions the proximity scan reads, and the 48 px clustering grid. Both
 * must be derived from a *measurement taken outside* per-frame work — the one
 * thing from the prototype that must not be ported is `getBoundingClientRect()`
 * per node per pointer move.
 *
 * This hook measures once on mount and then only when the element actually
 * resizes, so the projection transform and the position cache are re-derived on
 * viewport change and nothing else (req 5.7).
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize(ref: RefObject<HTMLElement>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };

    measure();

    // ResizeObserver where available (every target browser); a window resize
    // listener is the jsdom/older-browser fallback so the hook is never a no-op.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [ref]);

  return size;
}
