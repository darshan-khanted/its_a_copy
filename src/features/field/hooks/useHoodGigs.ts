// Hood-scoped gig subscription. Replaces the old app's `onSnapshot(collection(db,'gigs'))`
// which downloaded every gig in India (design §G.3, req 30.6, NFR-1.6). Bounded by
// hood + state, optionally widened to adjacent hoods, and filtered by visibility so
// gigs still inside a head-start window or behind a rank floor are withheld (§C.7).
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Gig, GigState } from '@/types';
import {
  filterVisibleGigs,
  PUBLIC_VIEWER,
  type ViewerVisibility,
} from '@/features/field/lib/visibility';

export interface UseHoodGigsOptions {
  /**
   * Adjacent hood pincodes to widen the subscription to (design §C.7). Combined
   * with the primary hood and capped at Firestore's `in` limit of 10. Never a
   * whole-collection listener.
   */
  adjacentHoodIds?: readonly string[];
  /** Visibility identity for head-start / rank-floor filtering. Defaults to public. */
  viewer?: ViewerVisibility;
}

export interface UseHoodGigsResult {
  /** Gigs visible to the viewer (visibility-filtered). */
  gigs: Gig[];
  loading: boolean;
}

// Firestore `in` supports at most 10 comparison values.
const IN_LIMIT = 10;

export function useHoodGigs(
  hoodId: string | undefined,
  state: GigState = 'OPEN',
  options: UseHoodGigsOptions = {},
): UseHoodGigsResult {
  const { adjacentHoodIds, viewer = PUBLIC_VIEWER } = options;

  const [raw, setRaw] = useState<Gig[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(hoodId));

  // Stable, deduped list of hoods to subscribe to (primary first).
  const hoodIds = useMemo(() => {
    if (!hoodId) return [] as string[];
    const set = new Set<string>([hoodId, ...(adjacentHoodIds ?? [])]);
    return Array.from(set).slice(0, IN_LIMIT);
  }, [hoodId, adjacentHoodIds]);

  // Serialise the id list so the effect only re-subscribes on a real change.
  const hoodKey = hoodIds.join(',');

  useEffect(() => {
    if (hoodIds.length === 0) {
      setRaw([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q =
      hoodIds.length === 1
        ? query(
            collection(db, 'gigs'),
            where('hoodId', '==', hoodIds[0]),
            where('state', '==', state),
            orderBy('createdAt', 'desc'),
          )
        : query(
            collection(db, 'gigs'),
            where('hoodId', 'in', hoodIds),
            where('state', '==', state),
            orderBy('createdAt', 'desc'),
          );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRaw(snap.docs.map((d) => ({ ...(d.data() as Gig), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoodKey, state]);

  const gigs = useMemo(() => filterVisibleGigs(raw, viewer), [raw, viewer]);

  return { gigs, loading };
}
