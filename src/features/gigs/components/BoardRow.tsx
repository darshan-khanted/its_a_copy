// A single Board row (design §C.8, §K.2, requirement 1.5).
//
// `.ink-list-card` is the responsive list card: a small hard shadow and a deterministic tilt
// above 480 px, and FLAT with tilt disabled below it (req 1.5) — stacked shadows and a ragged
// rotated left edge measurably hurt scanning on a 360 px phone. The whole row is one link, so
// the Board is a standard document a screen reader and a keyboard can walk (req 7.1).
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Price, RankChip, StatusPill, TapeLabel } from '@/components/ink';
import { distanceWords, relativeTime } from '@/lib/format';
import { labels } from '@/copy/labels';
import { seededRotation } from '@/lib/seed';
import type { BoardRowData } from '@/features/gigs/lib/board';

const monoMeta = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-micro)',
  letterSpacing: '0.14em',
  color: 'var(--text-2)',
  whiteSpace: 'nowrap',
} as const;

export interface BoardRowProps {
  row: BoardRowData;
  now?: number;
}

export function BoardRow({ row, now }: BoardRowProps) {
  const { gig, distanceM } = row;
  // Deterministic per-gig rotation, identical on every render and device (req 1.4). The
  // list-card media query zeroes it below 480 px.
  const rot = { ['--rot']: `${seededRotation(gig.id)}deg` } as CSSProperties;

  return (
    <li className="ink-list-card" style={{ ...rot, listStyle: 'none' }}>
      <Link
        to={`/g/${gig.id}`}
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'flex-start',
          padding: 'var(--space-3)',
          color: 'var(--text-1)',
          textDecoration: 'none',
        }}
      >
        <Avatar user={gig.posterSnapshot} size={32} />

        <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0, flex: '1 1 auto' }}>
          {/* user-authored title, preserved exactly as submitted (req 2.3) */}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'var(--text-h3)',
              lineHeight: 1.15,
            }}
          >
            {gig.title}
          </span>

          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
            <StatusPill status={gig.state} size="sm" />
            {gig.urgent ? (
              <TapeLabel tone="magenta" rot={-2}>
                {labels.urgent}
              </TapeLabel>
            ) : null}
            {gig.minRank ? (
              <span style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span style={monoMeta}>{labels.unlocksAtRank}</span>
                <RankChip rank={gig.minRank} />
              </span>
            ) : (
              <span style={monoMeta}>{labels.openToAll}</span>
            )}
          </span>

          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {distanceM !== null ? <span style={monoMeta}>{distanceWords(distanceM)}</span> : null}
            <span style={monoMeta}>{relativeTime(gig.createdAt, now)}</span>
            {gig.claimCount > 0 ? (
              <span style={monoMeta}>
                {labels.claims} · {gig.claimCount}
              </span>
            ) : null}
          </span>
        </span>

        <Price amount={gig.askPrice} size="lg" />
      </Link>
    </li>
  );
}
