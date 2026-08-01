// Rep ledger /me/rep (design §D.8). Renders every rep event as a receipt line. The paginated
// server ledger fetch + rank track land in Phase 3 (task 7.5); this wires the route.
import { useSession } from '@/app/providers/SessionProvider';

export function RepLedger() {
  const { user } = useSession();
  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>your rep</h1>
      <p>{user ? `${user.rep} rep · ${user.rank}` : 'sign in to see your ledger.'}</p>
      <p>the itemised ledger arrives in phase 3.</p>
    </section>
  );
}
