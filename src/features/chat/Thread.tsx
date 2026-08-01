// Thread + handshake card /t/:threadId (design §F.2/§F.3). The pinned offer card, composer
// and handshake actions land in Phase 2 (task 5.16). This wires the thread-scoped messages.
import { useParams } from 'react-router-dom';
import { useMessages } from '@/features/chat/hooks/useMessages';

export function Thread() {
  const { threadId } = useParams<{ threadId: string }>();
  const { messages, loading } = useMessages(threadId);

  if (loading) return <p style={{ padding: 16 }}>loading the thread…</p>;

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>thread</h1>
      <ol style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m) => (
          <li key={m.id} data-system={m.isSystem ? 'true' : undefined}>
            <strong>{m.senderName}:</strong> {m.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
