// Public pincode claim + browse entry (design §C.7, §E.1, §F.2 /claim).
//
// The whole point of the first run is "value before identity" (req 23.1): a visitor claims a
// hood and browses the Field with zero account. This screen resolves the pincode through the
// server-authoritative Hood service (useResolveHood), handles the manual-area fallback when
// neither the postal API nor the static table knows the pincode (req 8.5), then plays the
// flag-planting sequence and confirms in voice (req 23.6) before navigating to the hood.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResolveHood } from '@/features/hood/hooks/useResolveHood';
import { FlagPlanting } from '@/features/hood/FlagPlanting';
import { normalizePincodeInput, isValidPincode } from '@/features/hood/lib/pincode';
import { hoodPathForMode, writeLastHood } from '@/lib/prefs';
import { useToast } from '@/app/providers/ToastProvider';
import { hoodClaimedLine } from '@/copy/empty';
import { errors } from '@/copy/errors';
import { labels } from '@/copy/labels';

export function ClaimHood() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { status, needsManualArea, error, resolve, resolveManual } = useResolveHood();

  const [pin, setPin] = useState('');
  const [area, setArea] = useState('');
  // The claimed hood being celebrated; while set, the flag-planting sequence owns the screen.
  const [claimed, setClaimed] = useState<{ pincode: string; area: string } | null>(null);

  const busy = status === 'loading';

  function celebrate(pincode: string, areaLabel: string) {
    writeLastHood(pincode);
    pushToast('win', hoodClaimedLine(areaLabel));
    setClaimed({ pincode, area: areaLabel });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPincode(pin)) return; // useResolveHood surfaces the in-voice pincode error
    const resolved = await resolve(pin);
    if (resolved) celebrate(resolved.pincode, resolved.area);
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (area.trim().length < 2) return;
    const resolved = await resolveManual(pin, area.trim());
    if (resolved) celebrate(resolved.pincode, resolved.area);
  }

  // Flag-planting owns the screen once a hood is claimed, then hands off to the Field.
  if (claimed) {
    return (
      <FlagPlanting
        area={claimed.area}
        onDone={() => navigate(hoodPathForMode(claimed.pincode))}
      />
    );
  }

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>claim your hood</h1>
      <p>post literally anything. get it done by someone 2 streets away.</p>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input
          inputMode="numeric"
          placeholder="560102"
          value={pin}
          maxLength={6}
          aria-label="pincode"
          disabled={busy}
          onChange={(e) => setPin(normalizePincodeInput(e.target.value))}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'scanning…' : 'scan it'}
        </button>
      </form>

      {/* Manual-area fallback: neither the API nor the static table resolved the pincode. */}
      {needsManualArea && (
        <form onSubmit={submitManual} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="mono-label">{labels.notFoundArea}</p>
          <input
            placeholder="e.g. HSR Layout, Sector 2"
            value={area}
            aria-label="area name"
            disabled={busy}
            onChange={(e) => setArea(e.target.value)}
          />
          <button type="submit" disabled={busy || area.trim().length < 2}>
            put it on the field
          </button>
        </form>
      )}

      {/* The hook owns the in-voice pincode / resolution error; only echo when not the manual state. */}
      {error && !needsManualArea && <p role="alert">{error || errors.pincodeBad}</p>}
    </section>
  );
}
