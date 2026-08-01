import { beforeEach, describe, expect, it } from 'vitest';
import { useIntentStore, type PendingIntent } from './intent';

function claimIntent(): PendingIntent {
  return {
    kind: 'claim',
    returnTo: '/g/gig_123',
    claim: { gigId: 'gig_123', oneLiner: 'i own an allen key set', offer: 250, availability: 'tonight' },
    createdAt: 1000,
  };
}

describe('preserved gated-action intent store (§E.1, req 23.2/23.3)', () => {
  beforeEach(() => {
    useIntentStore.getState().clearIntent();
  });

  it('records the complete claim intent (gig id, one-liner, offer, availability)', () => {
    useIntentStore.getState().setIntent(claimIntent());
    const pending = useIntentStore.getState().pending;
    expect(pending?.kind).toBe('claim');
    expect(pending?.returnTo).toBe('/g/gig_123');
    expect(pending?.claim).toEqual({
      gigId: 'gig_123',
      oneLiner: 'i own an allen key set',
      offer: 250,
      availability: 'tonight',
    });
  });

  it('consumeIntent returns the intent and clears it in one step', () => {
    useIntentStore.getState().setIntent(claimIntent());
    const consumed = useIntentStore.getState().consumeIntent();
    expect(consumed?.claim?.gigId).toBe('gig_123');
    // The intent is one-shot: a second consume yields nothing (no double resume).
    expect(useIntentStore.getState().pending).toBeNull();
    expect(useIntentStore.getState().consumeIntent()).toBeNull();
  });

  it('clearIntent discards a pending intent without resuming', () => {
    useIntentStore.getState().setIntent(claimIntent());
    useIntentStore.getState().clearIntent();
    expect(useIntentStore.getState().pending).toBeNull();
  });

  it('a later intent replaces an earlier one', () => {
    useIntentStore.getState().setIntent(claimIntent());
    useIntentStore.getState().setIntent({ kind: 'flare', returnTo: '/flare', createdAt: 2000 });
    expect(useIntentStore.getState().pending?.kind).toBe('flare');
    expect(useIntentStore.getState().pending?.claim).toBeUndefined();
  });
});
