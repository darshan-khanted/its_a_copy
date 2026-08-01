/**
 * Addressable handshake detail view at /h/:handshakeId (requirement 25.2, task 5.16).
 * Shows full offer history with expanded details, state indicator, and agreed terms.
 */
import { useParams } from 'react-router-dom';
import { InkBox, Price, StatusPill } from '@/components/ink';
import { useHandshake } from '@/features/handshake/hooks/useHandshake';
import type { Offer } from '@/types/handshake';

function OfferRow({ offer, posterUid }: { offer: Offer; posterUid: string }) {
  const role = offer.byUid === posterUid ? 'poster' : 'doer';
  const statusLabel =
    offer.status === 'accepted'
      ? 'accepted'
      : offer.status === 'superseded'
        ? 'superseded'
        : 'live';

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) 0',
        borderBottom: '1px solid var(--border-subtle)',
        opacity: offer.status === 'superseded' ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Price amount={offer.price} size="sm" />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-nano)',
              color: 'var(--text-2)',
            }}
          >
            seq {offer.seq} by {role}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-nano)',
            color: 'var(--text-2)',
          }}
        >
          {offer.date} {offer.startTime}{offer.endTime ? ` - ${offer.endTime}` : ''}
        </span>
        {offer.note && (
          <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-1)' }}>
            {offer.note}
          </p>
        )}
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-nano)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: offer.status === 'accepted' ? 'var(--color-lime-deep)' : 'var(--text-2)',
          alignSelf: 'center',
        }}
      >
        {statusLabel}
      </span>
    </li>
  );
}

export function HandshakeDetail() {
  const { handshakeId } = useParams<{ handshakeId: string }>();
  const { handshake, loading, error } = useHandshake(handshakeId);

  if (loading) return <p style={{ padding: 16 }}>loading handshake...</p>;
  if (error || !handshake) return <p style={{ padding: 16 }}>handshake not found</p>;

  return (
    <section style={{ padding: 16, maxWidth: 600 }}>
      <h1
        style={{
          textTransform: 'lowercase',
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          margin: '0 0 var(--space-4)',
        }}
      >
        handshake
      </h1>

      {/* State indicator */}
      <InkBox pop="sm" popColor="ink" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusPill status={handshake.state} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-nano)', color: 'var(--text-2)' }}>
            {handshake.id}
          </span>
        </div>
      </InkBox>

      {/* Agreed terms */}
      {handshake.agreed && (
        <InkBox pop="sm" popColor="lime" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <h2
            style={{
              textTransform: 'lowercase',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              margin: '0 0 var(--space-2)',
            }}
          >
            agreed terms
          </h2>
          <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
              <Price amount={handshake.agreed.price} size="md" />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-nano)', color: 'var(--text-2)' }}>
              {handshake.agreed.date} {handshake.agreed.startTime}
              {handshake.agreed.endTime ? ` - ${handshake.agreed.endTime}` : ''}
            </span>
          </div>
        </InkBox>
      )}

      {/* Full offer history */}
      <h2
        style={{
          textTransform: 'lowercase',
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-base)',
          margin: '0 0 var(--space-2)',
        }}
      >
        offer history
      </h2>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {handshake.offers.map((offer) => (
          <OfferRow key={offer.seq} offer={offer} posterUid={handshake.posterUid} />
        ))}
      </ol>
    </section>
  );
}
