// Single-gig subscription, mounted by /g/:gigId (design §G.3).
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Gig } from '@/types';

export interface UseGigResult {
  gig: Gig | null;
  loading: boolean;
}

export function useGig(gigId: string | undefined): UseGigResult {
  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(gigId));

  useEffect(() => {
    if (!gigId) {
      setGig(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'gigs', gigId),
      (snap) => {
        setGig(snap.exists() ? ({ ...(snap.data() as Gig), id: gigId }) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [gigId]);

  return { gig, loading };
}
