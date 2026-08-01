// Thread-scoped message subscription, mounted by the /t/:threadId route (design §G.3).
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ChatMessage } from '@/types';

export interface UseMessagesResult {
  messages: ChatMessage[];
  loading: boolean;
}

export function useMessages(threadId: string | undefined): UseMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(threadId));

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'chats', threadId, 'messages'),
      orderBy('timestamp', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ ...(d.data() as ChatMessage), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [threadId]);

  return { messages, loading };
}
