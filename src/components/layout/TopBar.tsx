// Minimal top bar: hood switcher, live clock, surface toggle (design §F.4).
// Search deliberately lives on the Board, not here (requirement 25.8).
import { useEffect, useState } from 'react';
import { useSurface, type SurfacePref } from '@/app/providers/SurfaceProvider';
import { HoodSwitcher } from '@/features/hood/HoodSwitcher';

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const NEXT_PREF: Record<SurfacePref, SurfacePref> = {
  auto: 'paper',
  paper: 'night',
  night: 'auto',
};

export function TopBar() {
  const { pref, setPref } = useSurface();
  const clock = useClock();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 45,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        minHeight: 44,
      }}
    >
      <HoodSwitcher />
      <span aria-hidden="true">{clock}</span>
      <button type="button" aria-label={`surface: ${pref}`} onClick={() => setPref(NEXT_PREF[pref])}>
        {pref}
      </button>
    </header>
  );
}
