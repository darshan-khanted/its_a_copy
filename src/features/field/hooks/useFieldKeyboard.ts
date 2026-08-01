/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Geographic keyboard traversal + escape/announcement glue for the Field
 * (design §C.4, §I.3; reqs 4.4, 4.5, 27.8, 27.10).
 *
 * The Field is `role="application"` and captures arrow keys, which is normally
 * hostile — so this hook implements the mitigations the design requires:
 * - Arrow keys traverse by GEOGRAPHY (via the pure `traverse` helpers), not DOM
 *   order: → clockwise, ← counter-clockwise, ↑ closer, ↓ further (req 4.4).
 * - Enter opens the focused signal (req 4.4).
 * - Escape closes any open drawer, returns focus to the focused signal, and
 *   releases arrow-key capture (req 4.5).
 * - Deliberate moves are announced in a polite, debounced live region (req 27.8).
 *
 * The traversal maths is pure and lives in `../lib/traversal`; this hook only
 * binds keys and routes side effects.
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { traverse, nearestToAnchor, type FieldNodeGeometry } from '@/features/field/lib/traversal';

export interface UseFieldKeyboardOptions {
  /** The focusable Field region element (`tabIndex=0`, `role="application"`). */
  fieldRef: RefObject<HTMLElement>;
  /** Cached field-space geometry for every visible signal, in render order. */
  nodes: readonly FieldNodeGeometry[];
  /** The currently active/focused signal index, or null. */
  activeIndex: number | null;
  /** Move the active signal (URL/store-owned in the caller). */
  setActiveIndex: (index: number | null) => void;
  /** Open the drawer for a signal (Enter). */
  onOpen: (index: number) => void;
  /** Close any open drawer (Escape). */
  onEscape: () => void;
  /** Whether a drawer is currently open (affects Escape behaviour). */
  drawerOpen: boolean;
  /** Announce a message in the polite live region (already debounced upstream). */
  announce?: (message: string) => void;
  /** Produce the spatial narration for a signal index (design §I.3). */
  describe?: (index: number) => string;
  /** When false, the Field does not capture keys. */
  enabled: boolean;
}

export function useFieldKeyboard(opts: UseFieldKeyboardOptions): void {
  const {
    fieldRef,
    nodes,
    activeIndex,
    setActiveIndex,
    onOpen,
    onEscape,
    drawerOpen,
    announce,
    describe,
    enabled,
  } = opts;

  // Route through refs so the key handler need not re-bind on every render.
  const ref = useRef({
    nodes,
    activeIndex,
    setActiveIndex,
    onOpen,
    onEscape,
    drawerOpen,
    announce,
    describe,
  });
  ref.current = {
    nodes,
    activeIndex,
    setActiveIndex,
    onOpen,
    onEscape,
    drawerOpen,
    announce,
    describe,
  };

  useEffect(() => {
    const el = fieldRef.current;
    if (!el || !enabled) return;

    const move = (
      direction: 'clockwise' | 'counter-clockwise' | 'closer' | 'further',
    ) => {
      const s = ref.current;
      if (s.nodes.length === 0) return;
      // Entry point: if nothing is active yet, start at the node nearest the anchor.
      const from = s.activeIndex ?? nearestToAnchor(s.nodes);
      if (from === null) return;
      const next = s.activeIndex === null ? from : traverse(s.nodes, from, direction);
      if (next === null) return;
      s.setActiveIndex(next);
      if (s.announce && s.describe) s.announce(s.describe(next));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const s = ref.current;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          move('clockwise');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          move('counter-clockwise');
          break;
        case 'ArrowUp':
          e.preventDefault();
          move('closer');
          break;
        case 'ArrowDown':
          e.preventDefault();
          move('further');
          break;
        case 'Enter':
          if (s.activeIndex !== null) {
            e.preventDefault();
            s.onOpen(s.activeIndex);
          }
          break;
        case 'Escape': {
          e.preventDefault();
          // Escape closes the drawer if open, then always releases arrow capture
          // by returning focus to the Field region / active signal.
          if (s.drawerOpen) s.onEscape();
          el.focus();
          break;
        }
        default:
          break;
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [fieldRef, enabled]);
}
