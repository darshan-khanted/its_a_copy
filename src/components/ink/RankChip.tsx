// Rank chip (design §B.4 / §D.5, requirement 27.4). Shows the two-digit rank number and, optionally,
// the rank name. Rank is paired with text, never colour alone. When `locked`, it renders redacted
// with a real accessible label. The rank → number/label maps are presentational display data.
import React from 'react';
import clsx from 'clsx';
import type { RankId } from '@/types/user';
import { RedactedReveal } from './RedactedReveal';

const RANK_NUMBER: Record<RankId, string> = {
  TAPPED_IN: '01',
  HUSTLER: '02',
  LEGEND: '03',
  MAX_CHARISMA: '04',
  MYTH: '05',
};

const RANK_LABEL: Record<RankId, string> = {
  TAPPED_IN: 'TAPPED IN',
  HUSTLER: 'HUSTLER',
  LEGEND: 'NEIGHBOURHOOD LEGEND',
  MAX_CHARISMA: 'MAX CHARISMA',
  MYTH: 'MYTH',
};

export interface RankChipProps {
  rank: RankId;
  showLabel?: boolean;
  locked?: boolean;
  className?: string;
}

export function RankChip({ rank, showLabel = false, locked = false, className }: RankChipProps) {
  const number = RANK_NUMBER[rank];
  const label = RANK_LABEL[rank];

  const body = (
    <span
      className={clsx('ink-box-sm', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '2px var(--space-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 700 }}>{number}</span>
      {showLabel ? <span style={{ color: 'var(--text-2)' }}>{label}</span> : null}
    </span>
  );

  if (locked) {
    return (
      <RedactedReveal
        locked
        placeholderWidth={showLabel ? 140 : 44}
        hiddenLabel="locked rank"
        unlockHint={`unlocks at ${label}`}
      >
        {body}
      </RedactedReveal>
    );
  }
  return body;
}
