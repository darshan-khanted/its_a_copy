// Addressable camera-capture modal /capture (design §F.2 modal routes; was CameraCaptureModal).
// The real capture surface (completion photos, KYC docs) lands in phases 2/4; this establishes
// the addressable, back-closable modal route.
import { ModalRoute } from '@/components/layout/ModalRoute';

export function CaptureModal() {
  return (
    <ModalRoute label="capture">
      <section style={{ padding: 16, background: 'var(--surface-raised, #f7f2e4)' }}>
        <h2 style={{ textTransform: 'lowercase' }}>capture</h2>
        <p>the camera surface lands in a later phase.</p>
      </section>
    </ModalRoute>
  );
}
