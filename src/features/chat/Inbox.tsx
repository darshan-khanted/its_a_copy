// Inbox /inbox (design §F.2). Participant-scoped thread list.
import { Link } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { useThreads } from '@/features/chat/hooks/useThreads';
import { relativeTime } from '@/lib/format';

export function Inbox() {
  const { firebaseUser } = useSession();
  const { threads, loading } = useThreads(firebaseUser?.uid);

  if (!firebaseUser) return <p style={{ padding: 16 }}>sign in to see your inbox.</p>;
  if (loading) return <p style={{ padding: 16 }}>loading your threads…</p>;

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>inbox</h1>
      {threads.length === 0 ? (
        <p>no conversations yet.</p>
      ) : (
        <ul>
          {threads.map((t) => (
            <li key={t.id}>
              <Link to={`/t/${t.id}`}>
                <strong>{t.gigTitle}</strong> — {t.lastMessage} · {relativeTime(t.lastMessageTime)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
