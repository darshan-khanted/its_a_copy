// The chrome around the Field (design §C.3; requirements 3.4, 3.9, 5.4, 7.3).
//
// Top line:    `● LIVE · <HOOD>` with the blinking lime dot, and the ticking HH:MM:SS clock.
// Footer:      `<N> SIGNALS IN RANGE` · `₹<total> ON THE BOARD` · the FIELD ⇄ BOARD toggle.
// Corner:      the hood centroid at four decimal places — real, and coarse enough to be safe.
// Precision:   the opt-in live-location toggle, marked `PRECISION: ON` when engaged (req 3.4).
//
// Every count here is the *real* supply metric: ghosts contribute zero (req 9.2). The clock is
// `aria-hidden` because a screen reader announcing a per-second change would be unusable; the
// counts are not, and they live in a polite live region so a new flare is announced once.
import { ModeToggle } from '@/components/layout/ModeToggle';
import { labels, onTheBoard, signalsInRange } from '@/copy/labels';
import { fieldVoice } from '@/copy/field';
import { rupees } from '@/lib/format';
import type { PreciseAnchor } from '@/features/field/hooks/usePreciseAnchor';

const MONO = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-micro)',
  letterSpacing: '0.14em',
  color: 'var(--text-2)',
} as const;

export interface FieldTopLineProps {
  /** Hood area name — user-facing data, rendered as supplied (req 2.3). */
  hoodName: string;
  /** `HH:MM:SS`, ticking. */
  clock: string;
}

export function FieldTopLine({ hoodName, clock }: FieldTopLineProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
      }}
    >
      <p style={{ ...MONO, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
        {/* ~0.9 Hz blink, below the 3 Hz photosensitivity limit, and off under reduced motion */}
        <span
          className="blink"
          aria-hidden="true"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: 'var(--radius-chip)',
            backgroundColor: 'var(--color-lime-deep)',
            border: 'var(--box-border-sm) solid var(--line)',
          }}
        />
        <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{labels.live}</span>
        <span aria-hidden="true">·</span>
        <span style={{ textTransform: 'uppercase' }}>{hoodName}</span>
      </p>
      {/* the ticking clock is the live-ness proof (§C.3); decorative to assistive tech */}
      <p aria-hidden="true" style={{ ...MONO, margin: 0 }}>
        {clock}
      </p>
    </div>
  );
}

export interface FieldFooterProps {
  /** Exact real open-gig count — ghosts excluded (req 9.2, 9.9). */
  realCount: number;
  /** Exact real total rupee value — ghosts add zero (req 9.2, 9.9). */
  realValue: number;
  /** `SHOWING 60 OF 214 · OPEN BOARD FOR ALL`, when the node budget truncates (req 5.4). */
  truncationLine?: string | null;
}

export function FieldFooter({ realCount, realValue, truncationLine }: FieldFooterProps) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <p role="status" aria-live="polite" style={{ ...MONO, margin: 0 }}>
          <span style={{ color: 'var(--text-1)' }}>{signalsInRange(realCount)}</span>
          <span aria-hidden="true"> · </span>
          {onTheBoard(rupees(realValue))}
        </p>
        {/* one action, no menu (req 7.3) */}
        <ModeToggle />
      </div>
      {truncationLine ? <p style={{ ...MONO, margin: 0 }}>{truncationLine}</p> : null}
    </div>
  );
}

export interface FieldAnchorLineProps {
  /** `12.9121° N / 77.6446° E` — hood centroid or the opted-in live point (req 3.9). */
  coordinate: string;
  precision: PreciseAnchor;
}

export function FieldAnchorLine({ coordinate, precision }: FieldAnchorLineProps) {
  const status = precision.enabled
    ? fieldVoice.anchoredOnYou
    : precision.unavailable
      ? fieldVoice.precisionUnavailable
      : fieldVoice.anchoredOnHood;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
      }}
    >
      <p style={{ ...MONO, fontSize: 'var(--text-nano)', margin: 0 }}>{coordinate}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {/* the anchor mode is stated in words, so the toggle is never colour-only (req 1.3) */}
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-2)', margin: 0 }}>{status}</p>
        <button
          type="button"
          onClick={precision.toggle}
          aria-pressed={precision.enabled}
          className="ink-box-sm flat ink-press tap-target"
          style={{
            ...MONO,
            color: 'var(--text-1)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: precision.enabled ? 'var(--color-lime)' : 'var(--surface-raised)',
          }}
        >
          {precision.enabled ? labels.precisionOn : labels.precisionOff}
        </button>
      </div>
    </div>
  );
}
