// Participant-scoped thread subscription (already correctly scoped in the old app via
// array-contains; kept, colocated with the chat feature and mounted by the inbox route).
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ChatThread } from '@/types';

export interface UseThreadsResult {
  threads: ChatThread[];
  loading: boolean;
}

export function useThreads(uid: string | undefined): UseThreadsResult {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid),
      orderBy('lastMessageTime', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setThreads(snap.docs.map((d) => ({ ...(d.data() as ChatThread), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  return { threads, loading };
}
