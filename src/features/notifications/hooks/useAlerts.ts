// Participant-scoped notification subscription, mounted by the /alerts route (design §G.3).
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppNotification } from '@/types';

export interface UseAlertsResult {
  alerts: AppNotification[];
  unreadCount: number;
  loading: boolean;
}

export function useAlerts(uid: string | undefined): UseAlertsResult {
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', uid),
      orderBy('timestamp', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAlerts(snap.docs.map((d) => ({ ...(d.data() as AppNotification), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  return { alerts, unreadCount: alerts.filter((a) => !a.read).length, loading };
}
