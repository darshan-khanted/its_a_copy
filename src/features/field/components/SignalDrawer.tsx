// The signal drawer (design §C.3 z 30, §C.4, §I.3; requirements 4.3, 4.5, 20.9, 3.2).
//
// Slides up from the bottom of the Field when a node is tapped, previewed-and-tapped, or opened
// with Enter. Focus moves to the drawer on open and returns to whatever was focused before on
// close, so Escape always lands the user back where they were (req 4.5, via `useFocusRestore`).
//
// Privacy: the drawer shows the public `areaLabel` and the privacy-rounded distance derived from
// the *fuzzed* coordinate. It never reads the gig's private location subdocument, and it never
// links to a precision map — the exact point is revealed only after both sides agree (req 3.2,
// 20.9, and the Maps boundary in `@/features/map/precisionMap`).
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Price, StatusPill, TapeLabel } from '@/components/ink';
import { useFocusRestore } from '@/hooks/useFocusRestore';
import { clusterLabel } from '@/features/field/lib/clustering';
import { claimsTally, labels } from '@/copy/labels';
import { fieldVoice } from '@/copy/field';
import { distanceWords } from '@/lib/format';
import type { FieldSignal, Gig } from '@/types';

const MONO = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-micro)',
  letterSpacing: '0.14em',
  color: 'var(--text-2)',
} as const;

export interface SignalDrawerProps {
  /** The opened node, or null when the drawer is closed. */
  node: FieldSignal | null;
  /** The public gig document behind a real signal node, when it is loaded. */
  gig?: Gig;
  /** Distance from the anchor, in metres, from the fuzzed position. */
  distanceM?: number;
  /** Board route where every signal — including a whole cluster — stays reachable (req 5.4). */
  boardPath: string;
  onClose: () => void;
}

export function SignalDrawer({ node, gig, distanceM, boardPath, onClose }: SignalDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusRestore({ open: node !== null, focusOnOpenRef: closeRef });

  if (!node) return null;

  const isCluster = node.kind === 'REAL_GIG_CLUSTER';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={fieldVoice.drawerLabel}
      className="ink-box-lg field-drawer"
      style={{
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <p style={{ ...MONO, margin: 0 }}>
          {isCluster ? clusterLabel(node.count, node.totalValue) : labels.signals}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="ink-box-sm flat ink-press tap-target"
          style={{ ...MONO, color: 'var(--text-1)', padding: 'var(--space-2) var(--space-3)' }}
        >
          {labels.close}
        </button>
      </div>

      {isCluster ? (
        // The full Board-row cluster sheet is the clustering task's surface; the drawer keeps the
        // guarantee that every clustered signal stays reachable (req 5.3, 5.4).
        <>
          <p style={{ margin: 0 }}>{fieldVoice.clusterHint}</p>
          <Link
            to={boardPath}
            className="ink-box-sm ink-press tap-target"
            style={{
              ...MONO,
              color: 'var(--text-1)',
              textDecoration: 'none',
              padding: 'var(--space-2) var(--space-4)',
              justifySelf: 'start',
              backgroundColor: 'var(--color-lime)',
            }}
          >
            {labels.openBoard}
          </Link>
        </>
      ) : gig ? (
        <>
          {/* user-authored title, preserved exactly as submitted (req 2.3) */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'var(--text-h3)',
              margin: 0,
            }}
          >
            {gig.title}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Price amount={gig.askPrice} size="lg" />
            <StatusPill status={gig.state} size="sm" />
            {gig.urgent ? <TapeLabel tone="magenta">{labels.urgent}</TapeLabel> : null}
          </div>

          <p style={{ ...MONO, margin: 0 }}>
            {typeof distanceM === 'number' ? distanceWords(distanceM) : ''}
            {typeof distanceM === 'number' ? <span aria-hidden="true"> · </span> : null}
            {/* the public area label — never the exact address (req 20.9) */}
            <span style={{ textTransform: 'uppercase' }}>{gig.areaLabel}</span>
            <span aria-hidden="true"> · </span>
            {claimsTally(gig.claimCount)}
          </p>

          <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-2)', margin: 0 }}>
            {fieldVoice.approximateSpot}
          </p>

          <Link
            to={`/g/${gig.id}`}
            className="ink-box-sm ink-press tap-target"
            style={{
              ...MONO,
              color: 'var(--text-1)',
              textDecoration: 'none',
              padding: 'var(--space-2) var(--space-4)',
              justifySelf: 'start',
              backgroundColor: 'var(--color-lime)',
            }}
          >
            {labels.openSignal}
          </Link>
        </>
      ) : (
        <p style={{ margin: 0 }}>{fieldVoice.ghostSignal}</p>
      )}
    </div>
  );
}
