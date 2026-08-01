// Status pill for a gig or handshake (design §B.4, requirement 27.4). Status is ALWAYS paired with
// text — never signalled by colour alone. A coloured dot plus an uppercase mono label. Pure: the
// label/tone maps are presentational display data, not business logic.
import React from 'react';
import clsx from 'clsx';
import type { GigState } from '@/types/gig';
import type { HandshakeState } from '@/types/handshake';

export type PillStatus = GigState | HandshakeState;

type Tone = 'ink' | 'lime' | 'cobalt' | 'magenta';

interface StatusMeta {
  label: string;
  tone: Tone;
}

// Union of gig + handshake states → display label + accent tone.
const STATUS_META: Record<PillStatus, StatusMeta> = {
  // gig states
  OPEN: { label: 'OPEN', tone: 'lime' },
  MATCHED: { label: 'MATCHED', tone: 'cobalt' },
  LIVE: { label: 'LIVE', tone: 'magenta' },
  DONE: { label: 'DONE', tone: 'lime' },
  CLOSED: { label: 'CLOSED', tone: 'ink' },
  CANCELLED: { label: 'CANCELLED', tone: 'ink' },
  EXPIRED: { label: 'EXPIRED', tone: 'ink' },
  // handshake states
  NEGOTIATING: { label: 'NEGOTIATING', tone: 'cobalt' },
  AGREED: { label: 'AGREED', tone: 'lime' },
  DONE_PENDING: { label: 'DONE · PENDING', tone: 'cobalt' },
  SETTLED: { label: 'SETTLED', tone: 'lime' },
  DECLINED: { label: 'DECLINED', tone: 'ink' },
  WITHDRAWN: { label: 'WITHDRAWN', tone: 'ink' },
  DISPUTED: { label: 'DISPUTED', tone: 'magenta' },
};

const TONE_TO_DOT: Record<Tone, string> = {
  ink: 'var(--text-2)',
  lime: 'var(--color-lime-deep)',
  cobalt: 'var(--color-cobalt)',
  magenta: 'var(--color-magenta)',
};

export interface StatusPillProps {
  status: PillStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusPill({ status, size = 'md', className }: StatusPillProps) {
  const meta = STATUS_META[status] ?? { label: String(status), tone: 'ink' as Tone };
  const live = status === 'LIVE';
  return (
    <span
      className={clsx('ink-box-sm', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: size === 'sm' ? '2px var(--space-2)' : 'var(--space-1) var(--space-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: size === 'sm' ? 'var(--text-nano)' : 'var(--text-micro)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        className={clsx(live && 'blink')}
        style={{
          width: 8,
          height: 8,
          borderRadius: 'var(--radius-chip)',
          backgroundColor: TONE_TO_DOT[meta.tone],
          flex: '0 0 auto',
        }}
      />
      {meta.label}
    </span>
  );
}
