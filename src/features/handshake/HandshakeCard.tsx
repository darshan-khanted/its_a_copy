/**
 * Pinned offer card shown at the top of a thread (design F.2/F.3, task 5.16).
 * Displays current offer price, who moved last, delta from asking, a collapsed
 * offer-history strip, and two big action buttons based on LEGAL[state] for the viewer.
 */
import { InkBox, InkPress, Price, StatusPill } from '@/components/ink';
import { LEGAL } from '@/features/handshake/lib/reducer';
import type { HandshakeActionType } from '@/features/handshake/lib/reducer';
import type { Handshake, Offer } from '@/types/handshake';

export interface HandshakeCardProps {
  handshake: Handshake;
  /** The gig's original asking price (for delta display). */
  askPrice: number;
  /** Current viewer's UID to determine role and available actions. */
  viewerUid: string;
  /** Called when a user taps an action button. */
  onAction?: (action: HandshakeActionType) => void;
  /** Called when user taps the history strip to open full detail. */
  onOpenDetail?: () => void;
}

/** Human-friendly labels for action buttons (lowercase expressive voice). */
const ACTION_LABELS: Record<string, string> = {
  COUNTER: 'counter',
  ACCEPT: 'accept',
  DECLINE: 'decline',
  WITHDRAW: 'withdraw',
  START: 'start gig',
  CANCEL: 'cancel',
  ATTEST_DONE: 'mark done',
  ATTEST_PAID: 'confirm paid',
  DISPUTE: 'dispute',
};

/** Actions that are "positive" (lime accent) vs "negative" (ink/muted). */
const POSITIVE_ACTIONS: ReadonlySet<string> = new Set([
  'COUNTER',
  'ACCEPT',
  'START',
  'ATTEST_DONE',
  'ATTEST_PAID',
]);

/**
 * Builds the collapsed offer strip: "450 -> 550 -> 500 -> 520 check"
 * The check mark appears on the accepted offer.
 */
function offerStrip(offers: Offer[]): string {
  return offers
    .map((o) => {
      const price = `\u20B9${o.price}`;
      if (o.status === 'accepted') return `${price} \u2713`;
      return price;
    })
    .join(' \u2192 ');
}

/**
 * Determines which actions the viewer can take given their role and the handshake state.
 * Filters the LEGAL table to those that make sense for the viewer's role (poster vs doer).
 */
function viewerActions(handshake: Handshake, viewerUid: string): HandshakeActionType[] {
  const legalActions = LEGAL[handshake.state];
  return legalActions.filter((action) => {
    // System-only or moderator-only actions are never shown to participants
    if (action === 'EXPIRE' || action === 'RESOLVE') return false;
    // ACCEPT: only the party who did NOT author the latest offer can accept
    if (action === 'ACCEPT') {
      if (handshake.offers.length === 0) return false;
      const latest = handshake.offers[handshake.latestSeq];
      return latest && latest.byUid !== viewerUid;
    }
    // COUNTER: only the party who did NOT author the latest offer can counter
    if (action === 'COUNTER') {
      if (handshake.offers.length === 0) return false;
      const latest = handshake.offers[handshake.latestSeq];
      return latest && latest.byUid !== viewerUid;
    }
    // DECLINE: only poster can decline (design convention)
    if (action === 'DECLINE') return viewerUid === handshake.posterUid;
    // WITHDRAW: only doer can withdraw
    if (action === 'WITHDRAW') return viewerUid === handshake.doerUid;
    // ATTEST_DONE: either party but not if already attested
    if (action === 'ATTEST_DONE') {
      return handshake.attestations.done[viewerUid] === undefined;
    }
    // ATTEST_PAID: either party
    if (action === 'ATTEST_PAID') return true;
    // START, CANCEL, DISPUTE: both participants
    return true;
  });
}

export function HandshakeCard({ handshake, askPrice, viewerUid, onAction, onOpenDetail }: HandshakeCardProps) {
  const latest = handshake.offers.length > 0 ? handshake.offers[handshake.latestSeq] : null;
  const currentPrice = latest?.price ?? askPrice;
  const delta = currentPrice - askPrice;
  const movedLast = latest ? (latest.byUid === handshake.posterUid ? 'poster' : 'doer') : null;
  const actions = viewerActions(handshake, viewerUid);

  return (
    <InkBox
      pop="md"
      popColor="lime"
      style={{
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-3)',
      }}
      data-testid="handshake-card"
    >
      {/* Top row: price + state + delta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
          <Price amount={currentPrice} size="lg" />
          {delta !== 0 && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-nano)',
                color: delta > 0 ? 'var(--accent-text)' : 'var(--text-2)',
              }}
            >
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </div>
        <StatusPill status={handshake.state} />
      </div>

      {/* Who moved last */}
      {movedLast && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-nano)',
            color: 'var(--text-2)',
            letterSpacing: '0.05em',
          }}
        >
          last move by {movedLast}
        </p>
      )}

      {/* Collapsed offer history strip */}
      {handshake.offers.length > 0 && (
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label="view full offer history"
          style={{
            background: 'var(--surface-sunken)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-small)',
            color: 'var(--text-1)',
            cursor: 'pointer',
            textAlign: 'left',
            letterSpacing: '0.03em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {offerStrip(handshake.offers)}
        </button>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {actions.slice(0, 2).map((action) => (
            <InkPress
              key={action}
              variant={POSITIVE_ACTIONS.has(action) ? 'primary' : 'ghost'}
              size="md"
              onClick={() => onAction?.(action)}
              aria-label={ACTION_LABELS[action] ?? action.toLowerCase()}
            >
              {ACTION_LABELS[action] ?? action.toLowerCase()}
            </InkPress>
          ))}
        </div>
      )}
    </InkBox>
  );
}
