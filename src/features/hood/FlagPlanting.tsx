// The flag-planting sequence (design §E.1, requirement 23.6).
//
// Claiming a hood is "planting a flag, not filling a field": the YOU marker drops with a
// pulse-ring expansion, the area name lands, and an in-voice line confirms the claim. Under
// reduced motion the sequence reaches the same final state with no animation (req 27.13,
// NFR-2.4) — the confirmation is announced either way. `onDone` fires once the sequence
// (or its reduced-motion instant equivalent) completes, so the caller can navigate on.
import { useEffect } from 'react';
import { hoodClaimedLine } from '@/copy/empty';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SEQUENCE_MS = 1400;

export function FlagPlanting({ area, onDone }: { area: string; onDone: () => void }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const delay = reducedMotion ? 0 : SEQUENCE_MS;
    const id = window.setTimeout(onDone, delay);
    return () => window.clearTimeout(id);
  }, [reducedMotion, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: '60dvh',
        padding: 16,
        textAlign: 'center',
      }}
    >
      {/* YOU marker + pulse ring. The ring only animates when motion is allowed. */}
      <span
        aria-hidden="true"
        data-marker="you"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--ink, currentColor)',
          animation: reducedMotion ? 'none' : 'youpulse 1s ease-out',
        }}
      />
      <p style={{ textTransform: 'lowercase', fontWeight: 700 }}>{hoodClaimedLine(area)}</p>
    </div>
  );
}
