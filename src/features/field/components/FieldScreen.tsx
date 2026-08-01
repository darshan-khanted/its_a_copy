// The Field — default authenticated route /hood/:pin (design §C, §F.2).
// The custom SVG proximity field, projection, radar and clustering land across Phase 1
// (tasks 3.8, 3.15, 3.21, 3.22). This screen wires the hood-scoped data + Board toggle and
// demonstrates poster identity coming from the denormalised snapshot (req 30.6/30.7).
import { Link } from 'react-router-dom';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { useHoodGigs } from '@/features/field/hooks/useHoodGigs';
import { PreLaunchHood } from '@/features/hood/PreLaunchHood';
import { canActInHood } from '@/features/hood/lib/stats';
import { writeLastMode } from '@/lib/prefs';
import { rupees } from '@/lib/format';
import { empty } from '@/copy/empty';

export function FieldScreen() {
  const { pincode, hood, loading: hoodLoading } = useHoodContext();
  const { gigs, loading } = useHoodGigs(pincode);

  if (hoodLoading) {
    return <p style={{ padding: 16 }}>scanning your hood…</p>;
  }

  // Pre-launch hoods withhold flaring/claiming and show the launch-progress experience
  // instead of a live board (design §C.7/§K.1, requirement 8.10). Browsing itself is never
  // gated (req 23.1) — this surface is the browse experience for a not-yet-live hood.
  if (hood && !canActInHood(hood)) {
    return <PreLaunchHood hood={hood} />;
  }

  if (loading) {
    return <p style={{ padding: 16 }}>scanning your hood…</p>;
  }

  const totalValue = gigs.reduce((sum, g) => sum + g.askPrice, 0);

  return (
    <section style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ textTransform: 'lowercase' }}>{hood?.area ?? `hood ${pincode}`}</h1>
        <Link to={`/hood/${pincode}/board`} onClick={() => writeLastMode('board')}>
          board
        </Link>
      </div>

      {gigs.length === 0 ? (
        <div>
          <h2>{empty.ghostTown.title}</h2>
          <p>{empty.ghostTown.body}</p>
        </div>
      ) : (
        <>
          <p>
            {gigs.length} signals · {rupees(totalValue)} on the field
          </p>
          <ul>
            {gigs.map((g) => (
              <li key={g.id}>
                <Link to={`/g/${g.id}`}>
                  {g.title} — {rupees(g.askPrice)} · {g.posterSnapshot.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
