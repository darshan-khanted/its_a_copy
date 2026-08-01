// Client hook that resolves a pincode through the server-authoritative Hood
// service (GET /api/hoods/:pincode, design §C.7/§G.7). Resolution is public — a
// visitor claims a hood before authenticating (requirement 23.1) — so the request
// is sent without an ID token. Resolution is on-demand (user-triggered), never a
// standing subscription.
import { useCallback, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Hood } from '@/types';
import { isValidPincode } from '@/features/hood/lib/pincode';

export type ResolveStatus = 'idle' | 'loading' | 'found' | 'notfound' | 'error';

interface HoodResponse {
  success: boolean;
  hood: Hood;
}

export interface UseResolveHoodResult {
  status: ResolveStatus;
  hood: Hood | null;
  /** True when neither the API nor the fallback table resolved the pincode. */
  needsManualArea: boolean;
  error: string | null;
  /** Resolve a pincode; caches server-side on first resolution. */
  resolve: (pincode: string) => Promise<Hood | null>;
  /** Persist a manually entered area name for an unresolved pincode. */
  resolveManual: (pincode: string, area: string) => Promise<Hood | null>;
  reset: () => void;
}

export function useResolveHood(): UseResolveHoodResult {
  const [status, setStatus] = useState<ResolveStatus>('idle');
  const [hood, setHood] = useState<Hood | null>(null);
  const [needsManualArea, setNeedsManualArea] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a stale response overwriting a newer request's result.
  const reqIdRef = useRef(0);

  const resolve = useCallback(async (pincode: string): Promise<Hood | null> => {
    const pin = pincode.trim();
    const reqId = ++reqIdRef.current;
    setError(null);
    setNeedsManualArea(false);

    if (!isValidPincode(pin)) {
      setStatus('error');
      setError('6 digits. the one on your courier packages');
      return null;
    }

    setStatus('loading');
    try {
      const res = await api<HoodResponse>(`/api/hoods/${pin}`, { auth: false });
      if (reqIdRef.current !== reqId) return null;
      setHood(res.hood);
      setStatus('found');
      return res.hood;
    } catch (err) {
      if (reqIdRef.current !== reqId) return null;
      if (err instanceof ApiError && err.status === 404) {
        setNeedsManualArea(true);
        setStatus('notfound');
        setError(err.message);
        return null;
      }
      setStatus('error');
      setError(err instanceof Error ? err.message : 'resolution failed');
      return null;
    }
  }, []);

  const resolveManual = useCallback(async (pincode: string, area: string): Promise<Hood | null> => {
    const pin = pincode.trim();
    const reqId = ++reqIdRef.current;
    setError(null);

    if (!isValidPincode(pin)) {
      setStatus('error');
      setError('6 digits. the one on your courier packages');
      return null;
    }

    setStatus('loading');
    try {
      const res = await api<HoodResponse>(`/api/hoods/${pin}/manual`, {
        method: 'POST',
        body: { area },
        auth: false,
      });
      if (reqIdRef.current !== reqId) return null;
      setHood(res.hood);
      setNeedsManualArea(false);
      setStatus('found');
      return res.hood;
    } catch (err) {
      if (reqIdRef.current !== reqId) return null;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'manual create failed');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    reqIdRef.current++;
    setStatus('idle');
    setHood(null);
    setNeedsManualArea(false);
    setError(null);
  }, []);

  return { status, hood, needsManualArea, error, resolve, resolveManual, reset };
}
