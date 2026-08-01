// URL-owned browse state (requirement 25.1): the Field/Board mode, the day-rhythm scrubber
// hour, and the Board filters all live in the URL, never in component or zustand state.
// These hooks are the single read/write surface later phases (3.21 Field, 3.26 Board,
// 11.6 scrubber) consume so the URL stays the source of truth.
import { useCallback, useMemo } from 'react';
import { matchPath, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { type FieldMode, writeLastMode } from '@/lib/prefs';

/**
 * Field/Board mode is encoded in the path: `/hood/:pin` is the Field, `/hood/:pin/board` is
 * the Board. Switching mode is a single navigation and updates the URL (requirements 7.3, 25.1).
 * The chosen mode is also persisted for restoration on return (requirement 7.4).
 */
export function useFieldMode(): {
  mode: FieldMode;
  pincode: string | undefined;
  fieldPath: string;
  boardPath: string;
  setMode: (mode: FieldMode) => void;
  toggle: () => void;
} {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin } = useParams<{ pin: string }>();

  // Derive the pincode even on nested board routes where useParams may not expose it.
  const boardMatch = matchPath('/hood/:pin/board', location.pathname);
  const fieldMatch = matchPath('/hood/:pin', location.pathname);
  const pincode = pin ?? boardMatch?.params.pin ?? fieldMatch?.params.pin ?? undefined;
  const mode: FieldMode = boardMatch ? 'board' : 'field';

  const fieldPath = pincode ? `/hood/${pincode}` : '/claim';
  const boardPath = pincode ? `/hood/${pincode}/board` : '/claim';

  const setMode = useCallback(
    (next: FieldMode) => {
      writeLastMode(next);
      if (!pincode) return;
      const target = next === 'board' ? `/hood/${pincode}/board` : `/hood/${pincode}`;
      if (target !== location.pathname) navigate(target + location.search);
    },
    [pincode, location.pathname, location.search, navigate],
  );

  const toggle = useCallback(() => setMode(mode === 'field' ? 'board' : 'field'), [mode, setMode]);

  return { mode, pincode, fieldPath, boardPath, setMode, toggle };
}

const HOUR_MIN = 8;
const HOUR_MAX = 23;

/**
 * Day-rhythm scrubber hour, owned by the `?h=` search param (requirements 6.1, 25.1).
 * `null` means "now" (no explicit hour selected). Out-of-range values are ignored.
 */
export function useScrubHour(): [number | null, (hour: number | null) => void] {
  const [params, setParams] = useSearchParams();

  const hour = useMemo(() => {
    const raw = params.get('h');
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= HOUR_MIN && n <= HOUR_MAX ? n : null;
  }, [params]);

  const setHour = useCallback(
    (next: number | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next == null || next < HOUR_MIN || next > HOUR_MAX) p.delete('h');
          else p.set('h', String(next));
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [hour, setHour];
}

export type BoardSort = 'recency' | 'price' | 'distance' | 'rank';
const SORTS: BoardSort[] = ['recency', 'price', 'distance', 'rank'];

export interface BoardFilters {
  sort: BoardSort;
  query: string;
}

/**
 * Board sorting and full-text search, owned by the `?sort=` and `?q=` search params
 * (requirements 7.2, 7.5, 25.1). The Board UI (task 3.26) reads and writes through here.
 */
export function useBoardFilters(): [BoardFilters, (patch: Partial<BoardFilters>) => void] {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<BoardFilters>(() => {
    const rawSort = params.get('sort') as BoardSort | null;
    return {
      sort: rawSort && SORTS.includes(rawSort) ? rawSort : 'recency',
      query: params.get('q') ?? '',
    };
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<BoardFilters>) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (patch.sort !== undefined) {
            if (patch.sort === 'recency') p.delete('sort');
            else p.set('sort', patch.sort);
          }
          if (patch.query !== undefined) {
            if (patch.query.trim() === '') p.delete('q');
            else p.set('q', patch.query);
          }
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [filters, setFilters];
}
