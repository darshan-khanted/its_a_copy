// Poster's candidate-comparison surface (requirement 11.8).
// Lists all active candidates for a gig, showing rank chip, rep, one-liner, offered price,
// and distance in a scrollable list. The poster selects one to begin the handshake agreement.
import { InkBox, InkPress } from '@/components/ink';
import { CandidateRow, type CandidateData } from './CandidateRow';

export interface CandidateListProps {
  /** All candidates for this gig. */
  candidates: CandidateData[];
  /** The gig's original asking price. */
  askPrice: number;
  /** Currently selected handshake id, if any. */
  selectedId?: string | null;
  /** Called when the poster taps a candidate row. */
  onSelect?: (handshakeId: string) => void;
  /** Called when the poster confirms acceptance of the selected candidate. */
  onAccept?: (handshakeId: string) => void;
}

export function CandidateList({
  candidates,
  askPrice,
  selectedId,
  onSelect,
  onAccept,
}: CandidateListProps) {
  if (candidates.length === 0) {
    return (
      <InkBox pop="sm" flat style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-small)',
            color: 'var(--text-2)',
            letterSpacing: '0.1em',
          }}
        >
          no claims yet
        </p>
      </InkBox>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          letterSpacing: '0.14em',
          color: 'var(--text-2)',
        }}
      >
        {candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'}
      </p>

      <div
        role="listbox"
        aria-label="candidates"
        style={{ display: 'grid', gap: 'var(--space-2)' }}
      >
        {candidates.map((c) => (
          <CandidateRow
            key={c.handshakeId}
            candidate={c}
            askPrice={askPrice}
            active={selectedId === c.handshakeId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {selectedId && onAccept && (
        <InkPress variant="lime" size="md" onClick={() => onAccept(selectedId)}>
          accept this one
        </InkPress>
      )}
    </div>
  );
}
