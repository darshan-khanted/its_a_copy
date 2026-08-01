/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawer focus restoration (design §C.4, §I.3; req 4.5).
 *
 * When a Field signal drawer opens, focus moves into the drawer; when it closes
 * (via Escape or otherwise), focus must return to the element that was focused
 * beforehand — i.e. the signal the user opened. This hook captures the previously
 * focused element on open and restores it on close.
 */
import { useEffect, useRef } from 'react';

export interface UseFocusRestoreOptions {
  /** Whether the transient surface (drawer/modal) is currently open. */
  open: boolean;
  /**
   * Element to move focus into when opening. If omitted, focus is left wherever
   * the surface itself places it and only restoration on close is managed.
   */
  focusOnOpenRef?: React.RefObject<HTMLElement>;
}

export function useFocusRestore({ open, focusOnOpenRef }: UseFocusRestoreOptions): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      // Capture the element that had focus before the surface opened.
      previouslyFocused.current =
        (document.activeElement as HTMLElement | null) ?? null;
      focusOnOpenRef?.current?.focus();
      return;
    }
    // On close, restore focus to the previously focused element if it is still
    // connected to the document.
    const prev = previouslyFocused.current;
    previouslyFocused.current = null;
    if (prev && prev.isConnected && typeof prev.focus === 'function') {
      prev.focus();
    }
  }, [open, focusOnOpenRef]);
}
