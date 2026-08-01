// Thread + handshake card /t/:threadId (design F.2/F.3, task 5.16).
// Pins the HandshakeCard at the top and shows messages below.
import { useNavigate, useParams } from 'react-router-dom';
import { useMessages } from '@/features/chat/hooks/useMessages';
import { useHandshake } from '@/features/handshake/hooks/useHandshake';
import { HandshakeCard } from '@/features/handshake/HandshakeCard';
import { useSession } from '@/app/providers/SessionProvider';

/**
 * Derives the handshake ID from the thread ID. Thread IDs follow the format
 * `thread_{gigId}_{doerUid}`, and handshake IDs follow `{gigId}_{doerUid}`.
 */
function handshakeIdFromThread(threadId: string): string | undefined {
  // threadId = "thread_{gigId}_{doerUid}" => handshakeId = "{gigId}_{doerUid}"
  if (!threadId.startsWith('thread_')) return undefined;
  return threadId.slice('thread_'.length);
}

export function Thread() {
  const { threadId } = useParams<{ threadId: string }>();
  const { messages, loading: messagesLoading } = useMessages(threadId);
  const { firebaseUser } = useSession();
  const navigate = useNavigate();

  const hsId = threadId ? handshakeIdFromThread(threadId) : undefined;
  const { handshake, loading: hsLoading } = useHandshake(hsId);

  const loading = messagesLoading || hsLoading;

  if (loading) return <p style={{ padding: 16 }}>loading the thread...</p>;

  return (
    <section style={{ padding: 16, display: 'grid', gap: 'var(--space-4)' }}>
      <h1 style={{ textTransform: 'lowercase', margin: 0 }}>thread</h1>

      {/* Pinned handshake card (does not scroll away) */}
      {handshake && firebaseUser && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--surface-base)',
            paddingBottom: 'var(--space-2)',
          }}
        >
          <HandshakeCard
            handshake={handshake}
            askPrice={handshake.offers[0]?.price ?? 0}
            viewerUid={firebaseUser.uid}
            onOpenDetail={() => navigate(`/h/${handshake.id}`)}
          />
        </div>
      )}

      {/* Messages */}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {messages.map((m) => (
          <li key={m.id} data-system={m.isSystem ? 'true' : undefined}>
            <strong>{m.senderName}:</strong> {m.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
