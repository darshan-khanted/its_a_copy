// Board sorting + full-text search (design §C.8, requirements 7.2, 7.5, 25.1, 25.8).
//
// There is deliberately NO category taxonomy here (req 7.5, §K.2): one search box over the
// hood's own words, four sort orders, nothing else. All state lives in the URL via
// `useBoardFilters`, so a sorted, searched Board is a shareable link and the back button
// steps through it. Search stays on the Board rather than in the global header (req 25.8).
import { useEffect, useState } from 'react';
import { useBoardFilters, type BoardSort } from '@/hooks/useUrlState';
import { labels } from '@/copy/labels';
import { placeholders } from '@/copy/placeholders';

const SORT_OPTIONS: { sort: BoardSort; label: string }[] = [
  { sort: 'recency', label: labels.recency },
  { sort: 'price', label: labels.price },
  { sort: 'distance', label: labels.distance },
  { sort: 'rank', label: labels.requiredRank },
];

const monoLabel = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-micro)',
  letterSpacing: '0.14em',
  color: 'var(--text-2)',
} as const;

export interface BoardControlsProps {
  /** Id of the results region this search box controls, for `aria-controls`. */
  resultsId: string;
}

export function BoardControls({ resultsId }: BoardControlsProps) {
  const [filters, setFilters] = useBoardFilters();

  // The input is a controlled mirror of `?q=`: the URL stays the source of truth (req 25.1),
  // while local state keeps typing responsive. Back/forward re-syncs the field.
  const [draft, setDraft] = useState(filters.query);
  useEffect(() => setDraft(filters.query), [filters.query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div role="search">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <span style={monoLabel}>{labels.search}</span>
          <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="search"
              className="field-input tap-target"
              value={draft}
              placeholder={placeholders.boardSearch}
              aria-controls={resultsId}
              enterKeyHint="search"
              onChange={(e) => {
                setDraft(e.target.value);
                setFilters({ query: e.target.value });
              }}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                padding: 'var(--space-2) var(--space-3)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body)',
              }}
            />
            {filters.query !== '' ? (
              <button
                type="button"
                className="ink-box-sm flat ink-press tap-target"
                onClick={() => setFilters({ query: '' })}
                style={{ ...monoLabel, color: 'var(--text-1)', padding: '0 var(--space-3)' }}
              >
                {labels.clearSearch}
              </button>
            ) : null}
          </span>
        </label>
      </div>

      <div
        role="group"
        aria-label={labels.sortBy}
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          overflowX: 'auto',
          alignItems: 'center',
        }}
      >
        <span style={monoLabel}>{labels.sortBy}</span>
        {SORT_OPTIONS.map((opt) => {
          const selected = opt.sort === filters.sort;
          return (
            <button
              key={opt.sort}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilters({ sort: opt.sort })}
              className={
                selected
                  ? 'ink-box-sm ink-press tap-target'
                  : 'ink-box-sm flat ink-press tap-target'
              }
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                letterSpacing: '0.14em',
                fontWeight: selected ? 700 : 400,
                whiteSpace: 'nowrap',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: selected ? 'var(--color-lime)' : 'var(--surface-raised)',
                color: 'var(--text-1)',
              }}
            >
              {selected ? <span aria-hidden="true">▸ </span> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
