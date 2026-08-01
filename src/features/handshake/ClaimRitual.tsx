// Claim ritual — the multi-step claim composer (design §E.1, requirements 11.1-11.5, 11.10, 11.12).
//
// Steps:
//   1. One-liner input (10-140 chars with live counter, req 11.2)
//   2. Offer price stepper (prefilled with askPrice, ₹25 increments, counter-offer indicator, req 11.3/11.4)
//   3. Availability text (doer's time response, req 11.5)
//   4. Summary before submit (req 11.1)
//
// Wired to `useSubmitClaim` (atomic creation) and `useVerificationGate` (preserved intent
// correction path, req 11.12). On a failed preserved intent recheck, the doer is shown the
// failure reason with a path to correct (e.g. gig no longer open, claim limit reached).
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InkBox, InkPress, Price } from '@/components/ink';
import { useSubmitClaim, type SubmitClaimInput } from '@/features/handshake/hooks/useSubmitClaim';
import {
  useVerificationGate,
  type ClaimGateResult,
  type GigEligibility,
} from '@/features/identity/hooks/useVerificationGate';
import { useIntentStore } from '@/features/identity/lib/intent';
import { useToast } from '@/app/providers/ToastProvider';
import { rupees } from '@/lib/format';
import { unlocksForRank } from '@/features/rep/lib/unlocks';
import { RANK_ORDER } from '@/features/rep/lib/unlocks';
import type { Gig, RankId } from '@/types';

export type ClaimRitualStep = 'one-liner' | 'offer' | 'availability' | 'summary';

const ONE_LINER_MIN = 10;
const ONE_LINER_MAX = 140;
const PRICE_STEP = 25;

export interface ClaimRitualProps {
  gig: Gig;
  /** Called after a successful claim submission. */
  onSuccess?: (handshakeId: string, threadId: string) => void;
  /** Called when the ritual is dismissed / closed. */
  onClose?: () => void;
  /** Pre-filled values from a preserved intent (req 11.12). */
  preservedOneLiner?: string;
  preservedOffer?: number;
  preservedAvailability?: string;
  /** If a preserved claim was rechecked and failed, the result. */
  preservedFailure?: ClaimGateResult | null;
}

export function ClaimRitual({
  gig,
  onSuccess,
  onClose,
  preservedOneLiner,
  preservedOffer,
  preservedAvailability,
  preservedFailure,
}: ClaimRitualProps) {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { submitClaim, submitting, lastError } = useSubmitClaim();
  const { attemptClaim } = useVerificationGate();

  // If we have a preserved failure, show a correction banner. The doer can retry or dismiss.
  const [failureDismissed, setFailureDismissed] = useState(false);

  // Step state
  const [step, setStep] = useState<ClaimRitualStep>(
    preservedFailure && !failureDismissed ? 'summary' : 'one-liner',
  );

  // Form state
  const [oneLiner, setOneLiner] = useState(preservedOneLiner ?? '');
  const [offerPrice, setOfferPrice] = useState(preservedOffer ?? gig.askPrice);
  const [availability, setAvailability] = useState(preservedAvailability ?? '');

  // Validation
  const oneLinerValid = oneLiner.length >= ONE_LINER_MIN && oneLiner.length <= ONE_LINER_MAX;
  const availabilityValid = availability.trim().length > 0;
  const isCounterOffer = offerPrice !== gig.askPrice;

  // Determine which rank raises the claim limit (req 11.10)
  const limitMessage = useMemo(() => {
    if (!preservedFailure || preservedFailure.reason !== 'CLAIM_LIMIT_REACHED') return null;
    // Find next rank that raises the limit
    const currentRankIdx = RANK_ORDER.indexOf('TAPPED_IN'); // default
    for (let i = currentRankIdx + 1; i < RANK_ORDER.length; i++) {
      const nextUnlocks = unlocksForRank(RANK_ORDER[i]);
      const currentUnlocks = unlocksForRank(RANK_ORDER[currentRankIdx]);
      if (nextUnlocks.maxActiveClaims > currentUnlocks.maxActiveClaims) {
        return `you are at your ${currentUnlocks.maxActiveClaims}-claim limit. reach ${RANK_ORDER[i].toLowerCase().replace('_', ' ')} to unlock ${nextUnlocks.maxActiveClaims}.`;
      }
    }
    return preservedFailure.message ?? 'claim limit reached';
  }, [preservedFailure]);

  const canProceedFromOneLiner = oneLinerValid;
  const canProceedFromAvailability = availabilityValid;

  function goNext() {
    if (step === 'one-liner') setStep('offer');
    else if (step === 'offer') setStep('availability');
    else if (step === 'availability') setStep('summary');
  }

  function goBack() {
    if (step === 'offer') setStep('one-liner');
    else if (step === 'availability') setStep('offer');
    else if (step === 'summary') setStep('availability');
  }

  const handleSubmit = useCallback(async () => {
    // Run the eligibility gate one final time before submit (req 11.12)
    const eligibility: GigEligibility = { id: gig.id, state: gig.state, minRank: gig.minRank };
    const gateResult = await attemptClaim(eligibility, {
      gigId: gig.id,
      oneLiner,
      offer: offerPrice,
      availability,
    });

    if (gateResult.outcome === 'needs-auth' || gateResult.outcome === 'needs-verification') {
      // The gate preserved the intent and navigated away; nothing more to do here.
      return;
    }

    if (gateResult.outcome === 'recheck-failed') {
      pushToast('warn', gateResult.message ?? 'cannot claim right now');
      return;
    }

    // Ready - submit the claim
    const input: SubmitClaimInput = {
      gigId: gig.id,
      oneLiner,
      offerPrice,
      availability,
    };

    const result = await submitClaim(input);

    if (result.success && result.handshake && result.threadId) {
      pushToast('neutral', result.existing ? 'you already claimed this one' : 'claim sent');
      onSuccess?.(result.handshake.id, result.threadId);
    } else if (!result.success) {
      pushToast('warn', result.error ?? 'something went wrong');
    }
  }, [gig, oneLiner, offerPrice, availability, attemptClaim, submitClaim, pushToast, onSuccess]);

  return (
    <InkBox
      pop="lg"
      className="claim-ritual"
      style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'var(--text-h3)',
            margin: 0,
            textTransform: 'lowercase',
          }}
        >
          claim it
        </h2>
        {onClose && (
          <InkPress variant="ghost" size="sm" onClick={onClose} aria-label="close claim ritual">
            close
          </InkPress>
        )}
      </div>

      {/* Preserved failure banner (req 11.12) */}
      {preservedFailure && !failureDismissed && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-magenta)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-small)',
            display: 'grid',
            gap: 'var(--space-2)',
          }}
          className="ink-box-sm"
        >
          <p style={{ margin: 0 }}>
            {preservedFailure.reason === 'GIG_NOT_OPEN' && 'this signal closed while you were away.'}
            {preservedFailure.reason === 'RANK_TOO_LOW' && (preservedFailure.message ?? 'your rank is too low for this one.')}
            {preservedFailure.reason === 'CLAIM_LIMIT_REACHED' && (limitMessage ?? 'claim limit reached.')}
            {!preservedFailure.reason && (preservedFailure.message ?? 'something changed.')}
          </p>
          <InkPress
            variant="ghost"
            size="sm"
            onClick={() => {
              setFailureDismissed(true);
              if (preservedFailure.reason === 'GIG_NOT_OPEN') {
                onClose?.();
              } else {
                setStep('one-liner');
              }
            }}
          >
            {preservedFailure.reason === 'GIG_NOT_OPEN' ? 'got it' : 'try again'}
          </InkPress>
        </div>
      )}

      {/* Step: One-liner (req 11.2) */}
      {step === 'one-liner' && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <label
            htmlFor="claim-oneliner"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              letterSpacing: '0.14em',
              color: 'var(--text-2)',
            }}
          >
            your pitch — why you?
          </label>
          <textarea
            id="claim-oneliner"
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value.slice(0, ONE_LINER_MAX))}
            placeholder="i can do this because..."
            rows={3}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body)',
              padding: 'var(--space-3)',
              border: 'var(--box-border-sm) solid var(--line)',
              borderRadius: 'var(--radius-chip)',
              resize: 'vertical',
              backgroundColor: 'var(--surface-raised)',
              color: 'var(--text-1)',
            }}
            aria-describedby="oneliner-counter"
          />
          <span
            id="oneliner-counter"
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-nano)',
              color: oneLiner.length < ONE_LINER_MIN ? 'var(--accent-text)' : 'var(--text-2)',
              letterSpacing: '0.1em',
            }}
          >
            {oneLiner.length}/{ONE_LINER_MAX}
            {oneLiner.length > 0 && oneLiner.length < ONE_LINER_MIN && ` (min ${ONE_LINER_MIN})`}
          </span>
          <InkPress
            variant="lime"
            size="md"
            disabled={!canProceedFromOneLiner}
            onClick={goNext}
          >
            next
          </InkPress>
        </div>
      )}

      {/* Step: Offer price (req 11.3, 11.4) */}
      {step === 'offer' && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              letterSpacing: '0.14em',
              color: 'var(--text-2)',
              margin: 0,
            }}
          >
            your offer
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <InkPress
              variant="ghost"
              size="sm"
              onClick={() => setOfferPrice((p) => Math.max(PRICE_STEP, p - PRICE_STEP))}
              aria-label={`decrease offer by ${PRICE_STEP} rupees`}
            >
              -
            </InkPress>
            <Price
              amount={offerPrice}
              size="hero"
              strike={isCounterOffer ? gig.askPrice : undefined}
            />
            <InkPress
              variant="ghost"
              size="sm"
              onClick={() => setOfferPrice((p) => p + PRICE_STEP)}
              aria-label={`increase offer by ${PRICE_STEP} rupees`}
            >
              +
            </InkPress>
          </div>
          {isCounterOffer && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-nano)',
                letterSpacing: '0.1em',
                color: 'var(--accent-text)',
                margin: 0,
              }}
              aria-live="polite"
            >
              counter-offer ({offerPrice > gig.askPrice ? '+' : ''}{rupees(offerPrice - gig.askPrice)} from asking)
            </p>
          )}
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-nano)',
              color: 'var(--text-2)',
              margin: 0,
            }}
          >
            asking: {rupees(gig.askPrice)}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <InkPress variant="ghost" size="sm" onClick={goBack}>
              back
            </InkPress>
            <InkPress variant="lime" size="md" onClick={goNext}>
              next
            </InkPress>
          </div>
        </div>
      )}

      {/* Step: Availability (req 11.5) */}
      {step === 'availability' && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <label
            htmlFor="claim-availability"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              letterSpacing: '0.14em',
              color: 'var(--text-2)',
            }}
          >
            when can you do it?
          </label>
          <input
            id="claim-availability"
            type="text"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="e.g. today after 5pm, tomorrow morning"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body)',
              padding: 'var(--space-3)',
              border: 'var(--box-border-sm) solid var(--line)',
              borderRadius: 'var(--radius-chip)',
              backgroundColor: 'var(--surface-raised)',
              color: 'var(--text-1)',
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <InkPress variant="ghost" size="sm" onClick={goBack}>
              back
            </InkPress>
            <InkPress
              variant="lime"
              size="md"
              disabled={!canProceedFromAvailability}
              onClick={goNext}
            >
              next
            </InkPress>
          </div>
        </div>
      )}

      {/* Step: Summary (req 11.1) */}
      {step === 'summary' && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              letterSpacing: '0.14em',
              color: 'var(--text-2)',
              margin: 0,
            }}
          >
            review your claim
          </p>

          <dl
            style={{
              display: 'grid',
              gap: 'var(--space-2)',
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-small)',
            }}
          >
            <dt style={{ color: 'var(--text-2)', fontWeight: 600 }}>your pitch</dt>
            <dd style={{ margin: 0, color: 'var(--text-1)' }}>{oneLiner}</dd>

            <dt style={{ color: 'var(--text-2)', fontWeight: 600 }}>offer</dt>
            <dd style={{ margin: 0 }}>
              <Price amount={offerPrice} size="md" strike={isCounterOffer ? gig.askPrice : undefined} />
              {isCounterOffer && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-nano)',
                    color: 'var(--accent-text)',
                    marginLeft: 'var(--space-2)',
                  }}
                >
                  counter-offer
                </span>
              )}
            </dd>

            <dt style={{ color: 'var(--text-2)', fontWeight: 600 }}>availability</dt>
            <dd style={{ margin: 0, color: 'var(--text-1)' }}>{availability}</dd>

            <dt style={{ color: 'var(--text-2)', fontWeight: 600 }}>signal</dt>
            <dd style={{ margin: 0, color: 'var(--text-1)' }}>{gig.title}</dd>
          </dl>

          {lastError && (
            <p
              role="alert"
              style={{
                margin: 0,
                color: 'var(--accent-text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-small)',
              }}
            >
              {lastError}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <InkPress variant="ghost" size="sm" onClick={goBack} disabled={submitting}>
              back
            </InkPress>
            <InkPress
              variant="primary"
              size="md"
              onClick={handleSubmit}
              loading={submitting}
              loadingLabel="sending..."
              disabled={!oneLinerValid || !availabilityValid}
            >
              send claim
            </InkPress>
          </div>
        </div>
      )}
    </InkBox>
  );
}
