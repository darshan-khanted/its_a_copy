/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multimodal proximity Scan hook — the React/DOM glue over the pure spatial-hash
 * core (design §C.4, §C.6, §H.2; reqs 4.1, 4.2, 4.3, 4.7, 4.8, 4.9; NFR-1.5).
 *
 * Responsibilities kept OUT of the pure module and handled here:
 * - Coalesce pointer/touch moves into one search per animation frame (req 4.7).
 * - Write the spotlight position as CSS custom properties directly on the Field
 *   element WITHOUT triggering a React render (req 4.9, §G.3).
 * - Read no layout geometry inside per-frame work: bounds are cached and refreshed
 *   only on resize/scroll (req 4.8, NFR-1.5).
 * - Enforce the tap threshold: a release within 200 ms and < 8 px of movement is a
 *   tap that opens the previewed signal (req 4.3).
 *
 * The nearest-node decision itself is delegated to `queryNearest`, which is pure
 * and deterministic so the Scan property tests can drive it directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { coalescedPointer, rafThrottle } from '@/lib/raf';
import {
  buildSpatialHashPacked,
  queryNearest,
  DEFAULT_SCAN_RADIUS_PX,
} from '@/features/field/lib/spatialHash';

/** Max time between press and release for a gesture to count as a tap (req 4.3). */
export const TAP_MAX_MS = 200;
/** Max pointer travel for a gesture to still count as a tap (req 4.3). */
export const TAP_MAX_MOVE_PX = 8;

export interface UseProximityScanOptions {
  /** The Field element. Spotlight custom properties are written on it. */
  fieldRef: RefObject<HTMLElement>;
  /** Cached field-space node positions in px, screen-relative: [x0,y0,x1,y1,...]. */
  positionsPx: Float32Array;
  /** Fires ONLY when the active nearest-signal index actually changes. */
  onActiveChange: (index: number | null) => void;
  /** Fires on a tap gesture (press+release within thresholds) with the active index. */
  onTap?: (index: number | null) => void;
  /** Proximity radius in px. Defaults to the prototype's 88 px. */
  radiusPx?: number;
  /** When false, all listeners are detached and no work runs. */
  enabled: boolean;
}

export interface UseProximityScanResult {
  /** True while a touch/pointer scan gesture is in progress. */
  isScanning: boolean;
  /** Imperatively end the current scan (e.g. when a drawer opens). */
  endScan: () => void;
}

interface CachedBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function useProximityScan(opts: UseProximityScanOptions): UseProximityScanResult {
  const { fieldRef, positionsPx, onActiveChange, onTap, enabled } = opts;
  const radiusPx = opts.radiusPx ?? DEFAULT_SCAN_RADIUS_PX;

  const [isScanning, setIsScanning] = useState(false);

  // Keep the latest callbacks in refs so the listener effect need not re-bind when
  // a parent re-renders with new closures.
  const onActiveChangeRef = useRef(onActiveChange);
  const onTapRef = useRef(onTap);
  onActiveChangeRef.current = onActiveChange;
  onTapRef.current = onTap;

  // Rebuild the spatial hash only when the positions buffer identity changes. The
  // hook expects callers to memoise `positionsPx` (re-created only on re-projection).
  const hash = useMemo(() => buildSpatialHashPacked(positionsPx), [positionsPx]);
  const hashRef = useRef(hash);
  hashRef.current = hash;

  const radiusRef = useRef(radiusPx);
  radiusRef.current = radiusPx;

  // Mutable per-gesture / per-frame state (never in React state — no renders).
  const boundsRef = useRef<CachedBounds | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const lastActiveRef = useRef<number | null>(null);
  const gestureRef = useRef<{ startX: number; startY: number; startT: number; moved: number } | null>(
    null,
  );

  const refreshBounds = useCallback(() => {
    const el = fieldRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    boundsRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
  }, [fieldRef]);

  const endScan = useCallback(() => {
    setIsScanning(false);
    gestureRef.current = null;
  }, []);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el || !enabled) return;

    // Cache bounds once up front, then only on resize/scroll — never per move.
    refreshBounds();

    const paint = () => {
      const bounds = boundsRef.current;
      const pt = pendingRef.current;
      if (!bounds || !pt) return;
      const lx = pt.x - bounds.left;
      const ly = pt.y - bounds.top;

      // Spotlight: write CSS custom properties directly. No setState, no render.
      if (bounds.width > 0 && bounds.height > 0) {
        el.style.setProperty('--mx', `${(lx / bounds.width) * 100}%`);
        el.style.setProperty('--my', `${(ly / bounds.height) * 100}%`);
      }

      const idx = queryNearest(hashRef.current, lx, ly, radiusRef.current);
      if (idx !== lastActiveRef.current) {
        lastActiveRef.current = idx;
        onActiveChangeRef.current(idx);
      }
    };

    const scheduledPaint = rafThrottle(paint);

    const onPointerMove = (e: PointerEvent) => {
      const sample = coalescedPointer(e);
      pendingRef.current = { x: sample.clientX, y: sample.clientY };
      const g = gestureRef.current;
      if (g) {
        const dx = sample.clientX - g.startX;
        const dy = sample.clientY - g.startY;
        g.moved = Math.max(g.moved, Math.hypot(dx, dy));
      }
      scheduledPaint();
    };

    const onPointerDown = (e: PointerEvent) => {
      gestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startT: e.timeStamp || Date.now(),
        moved: 0,
      };
      pendingRef.current = { x: e.clientX, y: e.clientY };
      setIsScanning(true);
      scheduledPaint();
    };

    const finishGesture = (e: PointerEvent) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      setIsScanning(false);
      if (!g) return;
      const elapsed = (e.timeStamp || Date.now()) - g.startT;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const moved = Math.max(g.moved, Math.hypot(dx, dy));
      // Tap: quick release with negligible travel opens the previewed signal.
      if (elapsed <= TAP_MAX_MS && moved < TAP_MAX_MOVE_PX) {
        onTapRef.current?.(lastActiveRef.current);
      }
    };

    const onScrollOrResize = () => refreshBounds();

    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointerup', finishGesture, { passive: true });
    el.addEventListener('pointercancel', endScan, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });

    return () => {
      scheduledPaint.cancel();
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', finishGesture);
      el.removeEventListener('pointercancel', endScan);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, { capture: true } as EventListenerOptions);
    };
  }, [fieldRef, enabled, refreshBounds, endScan]);

  return { isScanning, endScan };
}
