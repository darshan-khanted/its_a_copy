// Hood document subscription, scoped to a single pincode (design §G.3, req 30.6).
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Hood } from '@/types';

export interface UseHoodResult {
  hood: Hood | null;
  loading: boolean;
}

export function useHood(pincode: string | undefined): UseHoodResult {
  const [hood, setHood] = useState<Hood | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(pincode));

  useEffect(() => {
    if (!pincode) {
      setHood(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'hoods', pincode),
      (snap) => {
        setHood(snap.exists() ? ({ ...(snap.data() as Hood), pincode }) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [pincode]);

  return { hood, loading };
}
