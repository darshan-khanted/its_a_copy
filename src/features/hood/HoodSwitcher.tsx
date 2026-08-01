// Hood switcher in the top bar (design §C.7, §F.4, requirements 8.9, 25.1).
//
// Changing hood is a URL change (a pushed history entry), so the hood is shareable,
// deep-linkable, and reachable by the browser back button — the three things the old
// `localStorage` city string could not do. The switcher offers a jump-to-pincode field and
// quick links to the current hood's adjacency; both navigate (never mutate component state
// as the source of truth) and persist the last hood for `/` and the FIELD nav slot.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { normalizePincodeInput, isValidPincode } from '@/features/hood/lib/pincode';
import { hoodPathForMode, writeLastHood } from '@/lib/prefs';
import { errors } from '@/copy/errors';
import { labels } from '@/copy/labels';

export function HoodSwitcher() {
  const navigate = useNavigate();
  const { hood, pincode } = useHoodContext();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const label = hood ? hood.area : pincode ? `hood ${pincode}` : 'pick a hood';
  const adjacent = hood?.adjacent ?? [];

  function go(target: string) {
    writeLastHood(target);
    setOpen(false);
    setPin('');
    setError(null);
    // A pushed navigation keeps the hood shareable and the browser back button correct (req 8.9).
    navigate(hoodPathForMode(target));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPincode(pin)) {
      setError(errors.pincodeBad);
      return;
    }
    go(pin);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="switch hood"
        onClick={() => setOpen((v) => !v)}
        style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}
      >
        {label} ▾
      </button>

      {open && (
        <div
          role="menu"
          aria-label="switch hood"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 60,
            minWidth: 220,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
            <input
              inputMode="numeric"
              placeholder="560102"
              value={pin}
              maxLength={6}
              aria-label="pincode"
              onChange={(e) => {
                setError(null);
                setPin(normalizePincodeInput(e.target.value));
              }}
            />
            <button type="submit">{labels.switchHood}</button>
          </form>
          {error && <p role="alert">{error}</p>}

          {adjacent.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {adjacent.map((adj) => (
                <li key={adj}>
                  <button type="button" role="menuitem" onClick={() => go(adj)}>
                    hood {adj}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link to="/claim" role="menuitem" onClick={() => setOpen(false)}>
            claim a new hood
          </Link>
        </div>
      )}
    </div>
  );
}
