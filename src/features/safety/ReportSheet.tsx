// Addressable report modal /report/:targetType/:id (design §F.2 modal routes).
// The full reporting/blocking/dispute flow is task 9.10; this establishes the addressable,
// back-closable modal route so links and the back gesture behave correctly now.
import { useParams } from 'react-router-dom';
import { ModalRoute } from '@/components/layout/ModalRoute';

export function ReportSheet() {
  const { targetType, id } = useParams<{ targetType: string; id: string }>();
  return (
    <ModalRoute label="report">
      <section style={{ padding: 16, background: 'var(--surface-raised, #f7f2e4)' }}>
        <h2 style={{ textTransform: 'lowercase' }}>report this {targetType}</h2>
        <p>reporting tools land in phase 4.</p>
        <p style={{ fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }}>
          {targetType} · {id}
        </p>
      </section>
    </ModalRoute>
  );
}
