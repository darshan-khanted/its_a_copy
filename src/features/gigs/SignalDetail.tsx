// Signal detail /g/:gigId -- shareable (design F.2/F.3). Publicly browsable before auth
// (req 23.1). The claim affordance is fully gated through `useVerificationGate`
// (req 23.2, 23.3, 11.11, 11.12): triggering it while signed out records the full claim
// intent and opens the single-step auth sheet; triggering it authenticated-but-unverified
// records the same intent and routes to identity verification; either way the intent resumes
// automatically once every remaining gate is rechecked (design E.1). On `ready`, the claim
// ritual opens (task 5.6) for the doer to compose their pitch, offer, and availability.
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGig } from '@/features/gigs/hooks/useGig';
import { useVerificationGate, type ClaimGateResult } from '@/features/identity/hooks/useVerificationGate';
import { useIntentStore } from '@/features/identity/lib/intent';
import { useToast } from '@/app/providers/ToastProvider';
import { rupees } from '@/lib/format';
import { ClaimRitual } from '@/features/handshake/ClaimRitual';
import { ClaimCountBadge } from '@/features/handshake/ClaimCountBadge';

export function SignalDetail() {
  const { gigId } = useParams<{ gigId: string }>();
  const { gig, loading } = useGig(gigId);
  const { attemptClaim, resumeClaim, authed, verified } = useVerificationGate();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  // Claim ritual state
  const [ritualOpen, setRitualOpen] = useState(false);
  const [preservedFailure, setPreservedFailure] = useState<ClaimGateResult | null>(null);

  // Check for a preserved intent to resume (req 11.12)
  const pending = useIntentStore((s) => s.pending);
  const preservedClaim = pending?.kind === 'claim' && pending.claim?.gigId === gigId ? pending.claim : null;

  const handleClaimTap = useCallback(async () => {
    if (!gig) return;
    const result = await attemptClaim(
      { id: gig.id, state: gig.state, minRank: gig.minRank },
      { gigId: gig.id },
    );
    // `needs-auth` opened the auth sheet; `needs-verification` navigated to /me/verify.
    if (result.outcome === 'needs-auth' || result.outcome === 'needs-verification') return;

    if (result.outcome === 'recheck-failed') {
      pushToast('warn', result.message ?? 'cannot claim right now');
      return;
    }

    // Ready: open the claim ritual
    setPreservedFailure(null);
    setRitualOpen(true);
  }, [gig, attemptClaim, pushToast]);

  // Resume a preserved claim after returning from auth/verification (req 11.12)
  const handleResume = useCallback(async () => {
    if (!gig) return;
    const result = await resumeClaim(async () => ({
      id: gig.id,
      state: gig.state,
      minRank: gig.minRank,
    }));

    if (result.outcome === 'ready') {
      setPreservedFailure(null);
      setRitualOpen(true);
    } else if (result.outcome === 'recheck-failed') {
      setPreservedFailure(result);
      setRitualOpen(true);
    }
    // needs-auth / needs-verification: the gate handled navigation already
  }, [gig, resumeClaim]);

  const handleSuccess = useCallback(
    (handshakeId: string, threadId: string) => {
      setRitualOpen(false);
      navigate(`/t/${threadId}`);
    },
    [navigate],
  );

  if (loading) return <p style={{ padding: 16 }}>loading the signal...</p>;
  if (!gig) return <p style={{ padding: 16 }}>this signal is gone.</p>;

  if (ritualOpen) {
    return (
      <div style={{ padding: 16 }}>
        <ClaimRitual
          gig={gig}
          onSuccess={handleSuccess}
          onClose={() => setRitualOpen(false)}
          preservedOneLiner={preservedClaim?.oneLiner}
          preservedOffer={preservedClaim?.offer}
          preservedAvailability={preservedClaim?.availability}
          preservedFailure={preservedFailure}
        />
      </div>
    );
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={{ margin: 0 }}>posted by {gig.posterSnapshot.displayName}</p>
        <ClaimCountBadge count={gig.claimCount} />
      </div>
      {gig.startTime !== 'FLEXIBLE' && <p>starts {gig.startDate} at {gig.startTime}</p>}

      {/* Resume preserved claim (req 11.12) */}
      {preservedClaim && authed && verified && (
        <button type="button" onClick={handleResume} style={{ marginBottom: 8 }}>
          resume your claim
        </button>
      )}

      <button type="button" onClick={handleClaimTap}>
        claim this
      </button>
    </article>
  );
}
