/**
 * Firestore subscription hook for a single handshake document.
 * Returns live data, loading state, and error if the doc is missing.
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Handshake } from '@/types/handshake';

export interface UseHandshakeResult {
  handshake: Handshake | null;
  loading: boolean;
  error: string | null;
}

export function useHandshake(handshakeId: string | undefined): UseHandshakeResult {
  const [handshake, setHandshake] = useState<Handshake | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(handshakeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handshakeId) {
      setHandshake(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      doc(db, 'handshakes', handshakeId),
      (snap) => {
        if (snap.exists()) {
          setHandshake({ ...(snap.data() as Handshake), id: snap.id });
          setError(null);
        } else {
          setHandshake(null);
          setError('not found');
        }
        setLoading(false);
      },
      (err) => {
        setError(err?.message ?? 'subscription failed');
        setLoading(false);
      },
    );
    return unsub;
  }, [handshakeId]);

  return { handshake, loading, error };
}
