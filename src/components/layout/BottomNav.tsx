// Mobile bottom tab bar: 5 slots, FLARE centre (lime, oversized), safe-area anchored
// (design §F.4, requirements 25.7). The FIELD slot restores the last hood in the last mode.
import { NavLink } from 'react-router-dom';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { hoodPathForMode, readLastHood } from '@/lib/prefs';

const slotStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 44,
  minHeight: 44,
  textTransform: 'lowercase',
};

export function BottomNav() {
  const { pincode } = useHoodContext();
  const hood = pincode ?? readLastHood();
  const fieldPath = hood ? hoodPathForMode(hood) : '/claim';

  return (
    <nav
      aria-label="primary"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 56,
      }}
    >
      {/* FIELD matches both /hood/:pin and /hood/:pin/board, so the surface toggle does not
          drop the active tab. */}
      <NavLink to={fieldPath} aria-label="field" style={slotStyle} end={false}>
        field
      </NavLink>
      <NavLink to="/inbox" aria-label="inbox" style={slotStyle}>
        inbox
      </NavLink>
      <NavLink
        to="/flare"
        aria-label="flare"
        style={{ ...slotStyle, fontWeight: 800, minWidth: 64, minHeight: 64 }}
      >
        flare
      </NavLink>
      <NavLink to="/alerts" aria-label="alerts" style={slotStyle}>
        alerts
      </NavLink>
      <NavLink to="/me" aria-label="me" style={slotStyle}>
        me
      </NavLink>
    </nav>
  );
}
