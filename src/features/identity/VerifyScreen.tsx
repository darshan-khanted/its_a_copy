// Identity verification /me/verify (design §E.1, requirements 11.11, 11.12, 21.9, 23.4, 23.5).
// Available on demand any time after account creation — NOT gated behind rank 02, and not
// mandatory at signup. It becomes the mandatory next step only when a claim attempt routed
// here with a preserved intent (design §E.1 sequence).
//
// Three states, each rendered explicitly rather than as an absent screen (req 23.5):
//   - none/rejected: the submission form.
//   - pending: the redacted verified chip with `UNDER REVIEW` (req 23.5) — browsing continues.
//   - approved: confirmation, and — if a claim intent is still preserved — an automatic resume
//     through every remaining eligibility gate (req 11.12), landing back on the gig detail.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/app/providers/SessionProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useIntentStore } from '@/features/identity/lib/intent';
import { useSubmitVerification } from '@/features/identity/hooks/useSubmitVerification';
import { useVerificationGate, type GigEligibility } from '@/features/identity/hooks/useVerificationGate';
import { RedactedReveal } from '@/components/ink/RedactedReveal';
import { labels } from '@/copy/labels';
import { safety } from '@/copy/safety';
import type { Gig } from '@/types';

async function fetchGigEligibility(gigId: string): Promise<GigEligibility | null> {
  const snap = await getDoc(doc(db, 'gigs', gigId));
  if (!snap.exists()) return null;
  const data = snap.data() as Gig;
  return { id: gigId, state: data.state, minRank: data.minRank };
}

export function VerifyScreen() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { firebaseUser, user } = useSession();
  const { submit, status: submitStatus, error: submitError } = useSubmitVerification();
  const { resumeClaim } = useVerificationGate();
  const pending = useIntentStore((s) => s.pending);
  const [file, setFile] = useState<string | null>(null);
  // Guards against resuming more than once per approval.
  const resumedRef = useRef(false);

  const verificationStatus = user?.verification?.status ?? 'none';
  const hasPendingClaim = pending?.kind === 'claim' && Boolean(pending.claim);

  // The one moment this screen acts on its own: once verification flips to `approved` while a
  // claim intent is still preserved, resume it through every remaining eligibility gate
  // (req 11.12) and land back where the claim was attempted.
  useEffect(() => {
    if (verificationStatus !== 'approved' || !hasPendingClaim || resumedRef.current) return;
    resumedRef.current = true;
    const returnTo = pending!.returnTo;
    resumeClaim(fetchGigEligibility).then((result) => {
      if (result.outcome === 'ready') {
        pushToast('win', 'you are verified — pick this claim back up');
      } else if (result.message) {
        pushToast('neutral', result.message);
      }
      navigate(returnTo, { replace: true });
    });
  }, [verificationStatus, hasPendingClaim, pending, resumeClaim, navigate, pushToast]);

  if (!firebaseUser) {
    return (
      <section style={{ padding: 16 }}>
        <h1 style={{ textTransform: 'lowercase' }}>verify</h1>
        <p>sign in first, then come back here.</p>
      </section>
    );
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFile(String(reader.result));
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const ok = await submit(file);
    if (ok) pushToast('win', 'sent for review');
  }

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>verify</h1>

      {/* Redacted verified chip — rendered in every state, never absent (req 23.5). */}
      <p className="mono-label">
        <RedactedReveal
          locked={verificationStatus !== 'approved'}
          hiddenLabel={verificationStatus === 'pending' ? labels.underReview : 'not verified yet'}
          unlockHint="verify your identity"
        >
          {labels.underReview}
        </RedactedReveal>
      </p>

      {verificationStatus === 'approved' && (
        <>
          <h2 style={{ textTransform: 'lowercase' }}>{safety.verificationApproved.title}</h2>
          <p>{safety.verificationApproved.body}</p>
        </>
      )}

      {verificationStatus === 'pending' && (
        <>
          <h2 style={{ textTransform: 'lowercase' }}>{safety.verificationPending.title}</h2>
          <p>{safety.verificationPending.body}</p>
        </>
      )}

      {(verificationStatus === 'none' || verificationStatus === 'rejected') && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>{safety.verificationRequired.body}</p>
          {verificationStatus === 'rejected' && (
            <p role="alert">that submission was not approved — try again with a clearer document.</p>
          )}
          <input type="file" accept="image/*,application/pdf" aria-label="identity document" onChange={onFileChange} />
          <button type="submit" disabled={!file || submitStatus === 'uploading' || submitStatus === 'submitting'}>
            {submitStatus === 'uploading' || submitStatus === 'submitting' ? 'sending…' : 'submit for review'}
          </button>
          {submitError && <p role="alert">{submitError}</p>}
        </form>
      )}
    </section>
  );
}
