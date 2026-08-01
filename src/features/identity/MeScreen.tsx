// Identity card /me (design §F.2/§F.3). The Day Zero Pass and rich identity card land in
// task 7.6; this wires the session user + sign out.
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { signOutUser } from '@/lib/firebase';

export function MeScreen() {
  const navigate = useNavigate();
  const { firebaseUser, user } = useSession();

  if (!firebaseUser) {
    return (
      <section style={{ padding: 16 }}>
        <h1 style={{ textTransform: 'lowercase' }}>you</h1>
        <Link to="/auth">sign in</Link>
      </section>
    );
  }

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>{user?.displayName ?? firebaseUser.email}</h1>
      {user && (
        <p>
          {user.rank} · {user.rep} rep · {user.gigsSettled} settled
        </p>
      )}
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/me/rep">rep ledger</Link>
        <Link to="/me/flares">my flares</Link>
        <Link to="/me/claims">my claims</Link>
        <Link to="/me/verify">verify</Link>
      </nav>
      <button type="button" onClick={() => signOutUser().then(() => navigate('/'))}>
        sign out
      </button>
    </section>
  );
}
