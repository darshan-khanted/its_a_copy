// The Board — list mode of the hood /hood/:pin/board (design §C.8, §F.2).
// Sorting, filters and full-text search land in task 3.26; this wires hood-scoped data.
import { Link } from 'react-router-dom';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { useHoodGigs } from '@/features/field/hooks/useHoodGigs';
import { PreLaunchHood } from '@/features/hood/PreLaunchHood';
import { canActInHood } from '@/features/hood/lib/stats';
import { writeLastMode } from '@/lib/prefs';
import { rupees } from '@/lib/format';
import { relativeTime } from '@/lib/format';

export function BoardScreen() {
  const { pincode, hood, loading: hoodLoading } = useHoodContext();
  const { gigs, loading } = useHoodGigs(pincode);

  // Same launch gate as the Field: a not-yet-live hood shows the pre-launch experience
  // rather than a board of gigs (design §C.7, requirement 8.10).
  if (!hoodLoading && hood && !canActInHood(hood)) {
    return <PreLaunchHood hood={hood} />;
  }

  return (
    <section style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ textTransform: 'lowercase' }}>the board</h1>
        <Link to={`/hood/${pincode}`} onClick={() => writeLastMode('field')}>
          field
        </Link>
      </div>
      {loading ? (
        <p>counting the neighbours…</p>
      ) : (
        <ul>
          {gigs.map((g) => (
            <li key={g.id}>
              <Link to={`/g/${g.id}`}>
                <strong>{g.title}</strong> — {rupees(g.askPrice)}
                {g.urgent ? ' · urgent' : ''} · {relativeTime(g.createdAt)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
