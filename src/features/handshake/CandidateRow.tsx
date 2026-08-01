// Candidate row for the poster's comparison surface (requirement 11.8).
// Shows each candidate's rank chip, rep count, one-liner, offered price, and distance.
// Used in the poster's thread/inbox to compare claims side by side.
import { Avatar, InkBox, Price, RankChip } from '@/components/ink';
import { distanceWords } from '@/lib/format';
import type { PublicIdentity } from '@/types';

export interface CandidateData {
  /** The doer's public identity snapshot at claim time. */
  doer: PublicIdentity;
  /** The doer's one-liner pitch (req 11.2). */
  oneLiner: string;
  /** The offered price in the claim (req 11.3/11.4). */
  offerPrice: number;
  /** Distance from the gig location to the doer, in metres (fuzzed). */
  distanceM?: number;
  /** The handshake id for this candidate. */
  handshakeId: string;
}

export interface CandidateRowProps {
  candidate: CandidateData;
  /** The gig's original asking price, to show a counter-offer indicator. */
  askPrice: number;
  /** Whether this candidate is currently selected/highlighted. */
  active?: boolean;
  /** Called when the poster taps this row. */
  onSelect?: (handshakeId: string) => void;
}

export function CandidateRow({ candidate, askPrice, active = false, onSelect }: CandidateRowProps) {
  const { doer, oneLiner, offerPrice, distanceM, handshakeId } = candidate;
  const isCounterOffer = offerPrice !== askPrice;

  return (
    <InkBox
      as="button"
      pop="sm"
      flat={!active}
      popColor={active ? 'lime' : 'ink'}
      onClick={() => onSelect?.(handshakeId)}
      className="tap-target"
      aria-label={`${doer.displayName}, rank ${doer.rank.toLowerCase()}, offered ${offerPrice}`}
      aria-pressed={active}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 'var(--space-3)',
        alignItems: 'center',
        padding: 'var(--space-3)',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        background: 'var(--surface-raised)',
      }}
    >
      {/* Left: avatar */}
      <Avatar user={doer} size={48} showRank />

      {/* Center: info */}
      <div style={{ display: 'grid', gap: 'var(--space-1)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <RankChip rank={doer.rank} showLabel />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-nano)',
              letterSpacing: '0.1em',
              color: 'var(--text-2)',
            }}
          >
            {doer.rep} rep
          </span>
          {typeof distanceM === 'number' && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-nano)',
                letterSpacing: '0.1em',
                color: 'var(--text-2)',
              }}
            >
              {distanceWords(distanceM)}
            </span>
          )}
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-small)',
            color: 'var(--text-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {oneLiner}
        </p>
      </div>

      {/* Right: price */}
      <div style={{ display: 'grid', justifyItems: 'end', gap: 'var(--space-1)' }}>
        <Price amount={offerPrice} size="md" strike={isCounterOffer ? askPrice : undefined} />
        {isCounterOffer && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-nano)',
              letterSpacing: '0.1em',
              color: 'var(--accent-text)',
            }}
          >
            counter
          </span>
        )}
      </div>
    </InkBox>
  );
}
