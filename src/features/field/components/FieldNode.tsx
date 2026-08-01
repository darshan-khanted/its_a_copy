// A single Field node (design §C.3 z 10, §C.5, §I.7; requirements 1.3, 1.8, 5.2, 9.1, 9.2).
//
// Three kinds, one component, because they share the geometry and the hit area:
//   REAL_GIG          — price label, deterministic per-node tone, staggered pulse
//   REAL_GIG_CLUSTER  — count and summed value (`4 · ₹1.9k`), lime halftone fill (req 5.2)
//   WAITLIST_GHOST    — hollow dashed `WAITING`, no price, not claimable (req 9.1, 9.2)
//
// Rules held here: colour is never the sole carrier of meaning — tone is decoration on top of
// the ink stroke and the text label (req 1.3); the tap area is at least 44 px even for the
// clustered nodes (req 1.8, NFR-2.2); and the pulse is decorative motion that pauses when the
// Field is off-screen (req 28.13) and stops entirely under reduced motion.
import type { CSSProperties } from 'react';
import { clusterLabel } from '@/features/field/lib/clustering';
import { positionPercent } from '@/features/field/lib/surface';
import { labels } from '@/copy/labels';
import { rupees } from '@/lib/format';
import type { FieldSignal, RealFieldSignal } from '@/types';

/** Per-node accent, used for the hard shadow only — never for the label colour. */
const TONE_TO_SHADOW: Record<RealFieldSignal['tone'], string> = {
  cobalt: 'var(--color-cobalt)',
  magenta: 'var(--color-magenta)',
  lime: 'var(--color-lime-deep)',
  cyan: 'var(--color-cyan)',
  peach: 'var(--color-peach)',
};

export interface FieldNodeProps {
  node: FieldSignal;
  index: number;
  /** The proximity-scan / keyboard active node. */
  active: boolean;
  /** Spatial narration used as the accessible name (§I.3.2). */
  accessibleName: string;
  /** Stable DOM id so the Field region can point `aria-activedescendant` at it. */
  id: string;
  /** Open this node (drawer for a signal, cluster sheet for a cluster). */
  onActivate: (index: number) => void;
  /** Stagger offset for the decorative pulse, in ms. */
  delayMs?: number;
  /** True while the Field is scrolled out of view — pauses the pulse (req 28.13). */
  offscreen?: boolean;
  /** Marks a gig posted by the operating team (req 9.6). */
  team?: boolean;
}

const LABEL: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-nano)',
  letterSpacing: '0.1em',
  color: 'var(--text-1)',
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
};

export function FieldNode({
  node,
  index,
  active,
  accessibleName,
  id,
  onActivate,
  delayMs = 0,
  offscreen = false,
  team = false,
}: FieldNodeProps) {
  const ghost = node.kind === 'WAITLIST_GHOST';
  const cluster = node.kind === 'REAL_GIG_CLUSTER';
  const tone = node.kind === 'REAL_GIG' ? TONE_TO_SHADOW[node.tone] : 'var(--color-lime-deep)';
  const position = positionPercent(node);

  const text = cluster
    ? clusterLabel(node.count, node.totalValue)
    : ghost
      ? labels.waiting
      : rupees(node.price);

  return (
    <button
      type="button"
      id={id}
      // Focus is managed by the Field region's `aria-activedescendant`; nodes are activated by
      // tap, by Enter on the region, or through the parallel semantic list.
      tabIndex={-1}
      data-active={active ? 'true' : 'false'}
      data-kind={node.kind}
      aria-label={accessibleName}
      aria-disabled={ghost ? 'true' : undefined}
      onClick={() => {
        if (!ghost) onActivate(index);
      }}
      className={`field-node tap-target${ghost ? '' : ' nodepulse'}`}
      data-offscreen={offscreen ? 'true' : 'false'}
      style={{
        left: position.left,
        top: position.top,
        ['--delay' as string]: `${delayMs}ms`,
        cursor: ghost ? 'default' : 'pointer',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          minWidth: cluster ? 'var(--tap-min)' : '54px',
          minHeight: cluster ? 'var(--tap-min)' : '54px',
          padding: '0 var(--space-2)',
          borderRadius: 'var(--radius-chip)',
          border: `var(--box-border-sm) ${ghost ? 'dashed' : 'solid'} var(--line)`,
          backgroundColor: ghost ? 'transparent' : 'var(--surface-raised)',
          boxShadow: ghost ? 'none' : `var(--pop-sm) var(--pop-sm) 0 0 ${tone}`,
          transform: active ? 'scale(1.12)' : 'none',
          transition: 'transform var(--dur-press) var(--ease-out-quint)',
        }}
        className={cluster ? 'halftone-lime' : undefined}
      >
        <span style={LABEL}>{text}</span>
        {/* urgency and team provenance are text markers, never colour alone (req 1.3, 9.6) */}
        {node.kind === 'REAL_GIG' && node.urgent ? (
          <span style={{ ...LABEL, fontSize: 'var(--text-nano)', color: 'var(--accent-text)' }}>
            {labels.urgent}
          </span>
        ) : null}
        {team ? <span style={LABEL}>{labels.qgTeam}</span> : null}
      </span>
    </button>
  );
}
