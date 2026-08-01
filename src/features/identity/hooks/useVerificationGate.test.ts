// Pure eligibility recheck for the claim-specific identity-verification gate (design §E.1/§E.3
// sequence; requirements 11.10, 11.12, 11.13, 17.12). Exercises `recheckClaimEligibility`
// directly — the same pure function `attemptClaim`/`resumeClaim` call after the async
// auth/verification checks — since it carries the actual eligibility logic under test.
import { describe, expect, it } from 'vitest';
import { recheckClaimEligibility, type GigEligibility } from './useVerificationGate';

function openGig(overrides: Partial<GigEligibility> = {}): GigEligibility {
  return { id: 'gig_1', state: 'OPEN', minRank: null, ...overrides };
}

describe('recheckClaimEligibility (design §E.1/§E.3, req 11.10, 11.12, 11.13, 17.12)', () => {
  it('passes every gate for a verified rank-01 doer with zero active claims on an open, ungated gig', () => {
    const result = recheckClaimEligibility(openGig(), 'TAPPED_IN', 0);
    expect(result).toEqual({ outcome: 'ready' });
  });

  it('rejects with GIG_NOT_OPEN when the gig is no longer OPEN', () => {
    const result = recheckClaimEligibility(openGig({ state: 'MATCHED' }), 'TAPPED_IN', 0);
    expect(result.outcome).toBe('recheck-failed');
    expect(result.reason).toBe('GIG_NOT_OPEN');
  });

  it('rejects with RANK_TOO_LOW when the viewer is below the gig minimum rank', () => {
    const result = recheckClaimEligibility(openGig({ minRank: 'LEGEND' }), 'TAPPED_IN', 0);
    expect(result.outcome).toBe('recheck-failed');
    expect(result.reason).toBe('RANK_TOO_LOW');
  });

  it('allows a viewer at or above the gig minimum rank', () => {
    const result = recheckClaimEligibility(openGig({ minRank: 'HUSTLER' }), 'LEGEND', 0);
    expect(result.outcome).toBe('ready');
  });

  it('rejects a rank-01 (verified) doer already holding their one allowed active claim (req 11.13, 17.12)', () => {
    const result = recheckClaimEligibility(openGig(), 'TAPPED_IN', 1);
    expect(result.outcome).toBe('recheck-failed');
    expect(result.reason).toBe('CLAIM_LIMIT_REACHED');
  });

  it('allows a rank-02+ doer under their higher active-claim allowance', () => {
    const result = recheckClaimEligibility(openGig(), 'HUSTLER', 2);
    expect(result.outcome).toBe('ready');
  });

  it('rejects a rank-02+ doer at their active-claim allowance', () => {
    const result = recheckClaimEligibility(openGig(), 'HUSTLER', 3);
    expect(result.outcome).toBe('recheck-failed');
    expect(result.reason).toBe('CLAIM_LIMIT_REACHED');
  });
});
