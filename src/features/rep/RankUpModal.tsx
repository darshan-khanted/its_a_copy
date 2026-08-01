// Addressable rank-up reveal modal /rank-up/:rankId (design §F.2 modal routes).
// The reduced-motion-safe reveal takeover is task 7.5; this establishes the addressable,
// back-closable modal route.
import { useParams } from 'react-router-dom';
import { ModalRoute } from '@/components/layout/ModalRoute';

export function RankUpModal() {
  const { rankId } = useParams<{ rankId: string }>();
  return (
    <ModalRoute label="rank up">
      <section style={{ padding: 16, background: 'var(--surface-raised, #f7f2e4)' }}>
        <h2 style={{ textTransform: 'lowercase' }}>you ranked up</h2>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }}>
          {rankId}
        </p>
        <p>the reveal takeover lands in phase 3.</p>
      </section>
    </ModalRoute>
  );
}
