// Signal detail /g/:gigId — shareable (design §F.2/§F.3). Publicly browsable before auth
// (req 23.1). The claim affordance here is fully gated through `useVerificationGate`
// (req 23.2, 23.3, 11.11, 11.12): triggering it while signed out records the full claim
// intent and opens the single-step auth sheet; triggering it authenticated-but-unverified
// records the same intent and routes to identity verification; either way the intent resumes
// automatically once every remaining gate is rechecked (design §E.1). The claim ritual itself
// — one-liner, offer, availability, and the atomic submit — lands in Phase 2 (tasks 5.5/5.6);
// this screen stops at reporting `ready` for that handoff.
import { useParams } from 'react-router-dom';
import { useGig } from '@/features/gigs/hooks/useGig';
import { useVerificationGate } from '@/features/identity/hooks/useVerificationGate';
import { useToast } from '@/app/providers/ToastProvider';
import { rupees } from '@/lib/format';

export function SignalDetail() {
  const { gigId } = useParams<{ gigId: string }>();
  const { gig, loading } = useGig(gigId);
  const { attemptClaim } = useVerificationGate();
  const { pushToast } = useToast();

  if (loading) return <p style={{ padding: 16 }}>loading the signal…</p>;
  if (!gig) return <p style={{ padding: 16 }}>this signal is gone.</p>;

  async function claim() {
    if (!gig) return;
    const result = await attemptClaim(
      { id: gig.id, state: gig.state, minRank: gig.minRank },
      { gigId: gig.id },
    );
    // `needs-auth` opened the auth sheet; `needs-verification` navigated to /me/verify — both
    // already preserved the intent, so there is nothing further to surface here. Only a
    // recheck failure (already-eligible doer hitting a real gate) needs a toast; `ready`
    // hands off to task 5.5's atomic submit, not yet wired.
    if (result.outcome === 'recheck-failed' && result.message) {
      pushToast('neutral', result.message);
    } else if (result.outcome === 'ready') {
      pushToast('neutral', 'you are eligible — the claim ritual arrives in a later task');
    }
  }

  return (
    <article style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>{gig.title}</h1>
      <p>{rupees(gig.askPrice)}</p>
      <p>{gig.body}</p>
      <p>
        {gig.areaLabel}
        {gig.tags.length > 0 ? ` · ${gig.tags.join(', ')}` : ''}
      </p>
      <p>posted by {gig.posterSnapshot.displayName}</p>
      {gig.startTime !== 'FLEXIBLE' && <p>starts {gig.startDate} at {gig.startTime}</p>}
      <button type="button" onClick={claim}>
        claim this
      </button>
    </article>
  );
}
