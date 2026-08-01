// Alerts /alerts (design §F.2). Participant-scoped, batched + deep-linked in Phase 5 (task 11.12).
import { Link } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { useAlerts } from '@/features/notifications/hooks/useAlerts';
import { relativeTime } from '@/lib/format';

export function AlertsList() {
  const { firebaseUser } = useSession();
  const { alerts, loading } = useAlerts(firebaseUser?.uid);

  if (!firebaseUser) return <p style={{ padding: 16 }}>sign in to see your alerts.</p>;
  if (loading) return <p style={{ padding: 16 }}>loading…</p>;

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>alerts</h1>
      {alerts.length === 0 ? (
        <p>all caught up.</p>
      ) : (
        <ul>
          {alerts.map((a) => (
            <li key={a.id} data-read={a.read ? 'true' : 'false'}>
              {a.route ? <Link to={a.route}>{a.title}</Link> : a.title} · {relativeTime(a.timestamp)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
