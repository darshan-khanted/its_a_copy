// Signal detail /g/:gigId — shareable (design §F.2/§F.3). Publicly browsable before auth
// (req 23.1). The claim affordance here is account-gated (req 23.2): triggering it while
// signed out records the full claim intent and opens the single-step auth sheet, which
// resumes the action afterwards (req 23.3). The claim ritual itself — one-liner, offer,
// availability, and the eligibility recheck + atomic submit — lands in Phase 2 (tasks 5.5/5.6);
// after authentication the next eligibility gate is identity verification (design §E.1).
import { useParams } from 'react-router-dom';
import { useGig } from '@/features/gigs/hooks/useGig';
import { useGatedAction } from '@/features/identity/hooks/useGatedAction';
import { useToast } from '@/app/providers/ToastProvider';
import { rupees } from '@/lib/format';
import { safety } from '@/copy/safety';

export function SignalDetail() {
  const { gigId } = useParams<{ gigId: string }>();
  const { gig, loading } = useGig(gigId);
  const { gate } = useGatedAction();
  const { pushToast } = useToast();

  if (loading) return <p style={{ padding: 16 }}>loading the signal…</p>;
  if (!gig) return <p style={{ padding: 16 }}>this signal is gone.</p>;

  function claim() {
    if (!gig) return;
    // Hood-liveness is enforced at the board level (a non-live hood surfaces no open gigs),
    // so the signal-level gate only needs the auth + intent-preservation contract.
    const outcome = gate(
      { kind: 'claim', requireLiveHood: false, claim: { gigId: gig.id } },
      () => {
        // Authenticated: the next eligibility gate before a first claim is verification.
        pushToast('neutral', safety.verificationRequired.body);
      },
    );
    // `needs-auth` already opened the sheet and preserved the intent; nothing else to do here.
    void outcome;
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
