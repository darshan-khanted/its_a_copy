/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Opt-in live-location anchoring for the Field (design §C.2, req 3.4).
 *
 * The Field anchors on the hood centroid by default and therefore works with
 * **zero location permissions** — the product's `NO LOCATION PERMISSION NEEDED`
 * claim is literal. Nothing here runs until the user explicitly asks for it: no
 * permission is queried, no watcher is started, and the browser prompt appears
 * only inside the click handler that calls {@link PreciseAnchor.enable}.
 *
 * When the user does opt in, the Field re-anchors to their live point and marks
 * the surface `PRECISION: ON` (req 3.4). The live coordinate stays in this hook
 * and the projection transform: it is never written to a document, never sent to
 * a server, and never rendered beyond the 4-decimal-place chrome line.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@/types';

export interface PreciseAnchor {
  /** The live anchor, or `null` while the Field is on the hood centroid. */
  point: GeoPoint | null;
  /** True once a live anchor is in use — drives `PRECISION: ON`. */
  enabled: boolean;
  /** True between the request and the first fix. */
  requesting: boolean;
  /** True when the request failed or geolocation is unavailable. */
  unavailable: boolean;
  /** Ask for precise location. Must be called from a user gesture. */
  enable: () => void;
  /** Drop the live anchor and return to the hood centroid. */
  disable: () => void;
  /** Flip between the two anchor modes. */
  toggle: () => void;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
};

export function usePreciseAnchor(): PreciseAnchor {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const watchRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
  }, []);

  const disable = useCallback(() => {
    clearWatch();
    setPoint(null);
    setRequesting(false);
    setUnavailable(false);
  }, [clearWatch]);

  const enable = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setUnavailable(true);
      return;
    }
    setRequesting(true);
    setUnavailable(false);
    // A watch, not a one-shot read: while precision is on, walking two streets
    // over must move the anchor, or the distances stop being true.
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
        setRequesting(false);
      },
      () => {
        clearWatch();
        setPoint(null);
        setRequesting(false);
        setUnavailable(true);
      },
      GEO_OPTIONS,
    );
  }, [clearWatch]);

  const toggle = useCallback(() => {
    if (point || requesting) disable();
    else enable();
  }, [point, requesting, disable, enable]);

  useEffect(() => clearWatch, [clearWatch]);

  return {
    point,
    enabled: point !== null,
    requesting,
    unavailable,
    enable,
    disable,
    toggle,
  };
}
