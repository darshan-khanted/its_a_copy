// The Board — the list mode of a hood, `/hood/:pin/board` (design §C.8, §F.2, §I.7).
//
// First-class, not a fallback: a standard document-structured page with NO `role="application"`
// region (req 7.1), four sort orders and full-text search over the hood's own words (req 7.2,
// 7.5), zero category taxonomy (§K.2), one-action FIELD ⇄ BOARD switching with the choice
// persisted (req 7.3, 7.4), search kept on the Board rather than the global header (req 25.8),
// and flat list cards below 480 px (req 1.5). Every filter lives in the URL (req 25.1).
import { useEffect, useMemo } from 'react';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { useHoodGigs } from '@/features/field/hooks/useHoodGigs';
import { PreLaunchHood } from '@/features/hood/PreLaunchHood';
import { canActInHood } from '@/features/hood/lib/stats';
import { ModeToggle } from '@/components/layout/ModeToggle';
import { BoardControls } from '@/features/gigs/components/BoardControls';
import { BoardRow } from '@/features/gigs/components/BoardRow';
import { buildBoardRows, totalValue } from '@/features/gigs/lib/board';
import { useBoardFilters } from '@/hooks/useUrlState';
import { Link } from 'react-router-dom';
import { EmptyState, Skeleton } from '@/components/ink';
import { writeLastMode } from '@/lib/prefs';
import { rupees } from '@/lib/format';
import { boardTally, labels, matchTally } from '@/copy/labels';
import { empty } from '@/copy/empty';
import { loading as loadingCopy } from '@/copy/loading';

const RESULTS_ID = 'board-results';

export function BoardScreen() {
  const { pincode, hood, anchor, loading: hoodLoading } = useHoodContext();
  const { gigs, loading } = useHoodGigs(pincode);
  const [filters] = useBoardFilters();

  // Remember that the Board was the last surface chosen, so returning to the app restores it
  // (requirement 7.4). The URL already carries the mode (requirement 25.1); this is only the
  // preference for `/` and the primary nav slot.
  useEffect(() => {
    writeLastMode('board');
  }, []);

  const rows = useMemo(
    () => buildBoardRows(gigs, filters, { anchor, now: Date.now() }),
    [gigs, filters, anchor],
  );

  // Same launch gate as the Field: a not-yet-live hood shows the pre-launch experience
  // rather than a board of gigs (design §C.7, requirement 8.10).
  if (!hoodLoading && hood && !canActInHood(hood)) {
    return <PreLaunchHood hood={hood} />;
  }

  const searching = filters.query.trim() !== '';
  const heading = hood?.area ?? `hood ${pincode ?? ''}`.trim();

  return (
    <section aria-labelledby="board-heading" style={{ padding: 'var(--space-4)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <h1
          id="board-heading"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'var(--text-h2)',
            textTransform: 'lowercase',
            margin: 0,
          }}
        >
          {heading}
        </h1>
        {/* one action, no menu — the toggle keeps ?sort= and ?q= (req 7.3) */}
        <ModeToggle />
      </header>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <BoardControls resultsId={RESULTS_ID} />
      </div>

      {/* the tally is the live region: sorting and searching announce their result count
          without the whole list being re-read (req 27.x) */}
      <p
        role="status"
        aria-live="polite"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          letterSpacing: '0.14em',
          color: 'var(--text-2)',
          margin: 'var(--space-4) 0 var(--space-3)',
        }}
      >
        {searching
          ? matchTally(rows.length, gigs.length)
          : boardTally(rows.length, rupees(totalValue(rows)))}
      </p>

      {loading ? (
        <Skeleton lines={4} statusLine={loadingCopy.field[1]} />
      ) : rows.length === 0 ? (
        searching ? (
          <EmptyState art="no-signals" title={empty.noMatches.title} body={empty.noMatches.body} />
        ) : (
          <EmptyState
            art="ghost-town"
            title={empty.ghostTown.title}
            body={empty.ghostTown.body}
            action={
              <Link
                to="/flare"
                className="ink-box-sm ink-press tap-target"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 'var(--space-2) var(--space-4)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  letterSpacing: '0.14em',
                  backgroundColor: 'var(--color-lime)',
                  color: 'var(--text-1)',
                  textDecoration: 'none',
                }}
              >
                {labels.postAFlare}
              </Link>
            }
          />
        )
      ) : (
        <ul id={RESULTS_ID} className="board-grid" style={{ margin: 0, padding: 0 }}>
          {rows.map((row) => (
            <BoardRow key={row.gig.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
