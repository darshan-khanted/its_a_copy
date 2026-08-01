/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Debounced spatial announcer for the Field's polite live region (design §I.3;
 * reqs 4.8→announce, 27.8).
 *
 * The proximity preview updates on every pointer move; announcing each one would
 * be unusable, so pointer-driven previews are `aria-hidden` and only deliberate
 * changes (keyboard traversal, drawer open, new signal arriving) reach the live
 * region — debounced to at most one announcement per 1.5 s.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from '@/lib/raf';

/** Minimum interval between spoken announcements (design §I.3). */
export const ANNOUNCE_DEBOUNCE_MS = 1500;

export interface UseSpatialAnnouncerResult {
  /** Current message to render inside an `aria-live="polite"` region. */
  message: string;
  /** Queue a message; collapses to one announcement per interval. */
  announce: (message: string) => void;
}

export function useSpatialAnnouncer(
  debounceMs: number = ANNOUNCE_DEBOUNCE_MS,
): UseSpatialAnnouncerResult {
  const [message, setMessage] = useState('');
  const setterRef = useRef(setMessage);
  setterRef.current = setMessage;

  const announce = useMemo(
    () => debounce((next: string) => setterRef.current(next), debounceMs),
    [debounceMs],
  );

  useEffect(() => () => announce.cancel(), [announce]);

  return { message, announce };
}
