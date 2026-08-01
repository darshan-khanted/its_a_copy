// Pre-launch hood experience (design §C.7, §K.1, §K.4, requirements 8.10, 9.4, 9.5).
//
// When a hood's status is not `live`, flaring and claiming are withheld and this surface is
// shown instead of the board: the launch-progress meter (`N / M NEIGHBOURS · OPENS AT M`), a
// recruit/share action to pull more neighbours in, and the adjacency list of nearby hoods so
// the visitor can browse somewhere that is already live — clearly labelled as further away.
import { Link } from 'react-router-dom';
import type { Hood } from '@/types';
import { hoodLaunchProgress } from '@/features/hood/lib/stats';
import { hoodPathForMode } from '@/lib/prefs';
import { empty } from '@/copy/empty';
import { labels, hoodProgress } from '@/copy/labels';

export interface PreLaunchHoodProps {
  hood: Hood;
  /** Optional share handler (Web Share API wiring lands with notifications in Phase 5). */
  onShare?: () => void;
}

export function PreLaunchHood({ hood, onShare }: PreLaunchHoodProps) {
  const progress = hoodLaunchProgress(hood);
  const nearby = hood.adjacent ?? [];

  return (
    <section style={{ padding: 16 }} aria-labelledby="prelaunch-heading">
      <p className="mono-label" aria-hidden="true">
        {labels.notLive}
      </p>
      <h1 id="prelaunch-heading" style={{ textTransform: 'lowercase' }}>
        {hood.area}
      </h1>
      <p>{empty.preLaunch.title}</p>
      <p>{empty.preLaunch.body}</p>

      {/* Progress, not emptiness (design §K.4 move 4). */}
      <p
        className="mono-label"
        role="meter"
        aria-valuenow={progress.current}
        aria-valuemin={0}
        aria-valuemax={progress.target}
        aria-label={hoodProgress(progress.current, progress.target)}
      >
        {hoodProgress(progress.current, progress.target)}
      </p>

      <button type="button" onClick={onShare}>
        {labels.pullFriendsIn}
      </button>

      {/* Adjacent spillover — browse a hood that is already live (design §K.4 move 6). */}
      {nearby.length > 0 && (
        <nav aria-label="nearby hoods" style={{ marginTop: 16 }}>
          <p>{empty.preLaunch.nearby}</p>
          <ul>
            {nearby.map((pin) => (
              <li key={pin}>
                <Link to={hoodPathForMode(pin)}>
                  hood {pin} · <span className="mono-label">{labels.furtherAway}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
