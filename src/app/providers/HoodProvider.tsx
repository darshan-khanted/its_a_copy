// Hood context: current hood, anchor centroid, radius, adjacency (design §G.3).
// The active pincode is owned by the URL (:pin route param), never component state
// (requirement 25.5). Off the hood routes it falls back to the persisted last hood so the
// chrome and the desktop persistent Field pane still have a hood to render (requirement 25.9).
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { GeoPoint, Hood } from '@/types';
import { useHood } from '@/features/hood/hooks/useHood';
import { readLastHood, writeLastHood } from '@/lib/prefs';

const DEFAULT_RADIUS_M = 2000;

interface HoodValue {
  /** The active hood pincode: the route `:pin`, or the persisted last hood off-route. */
  pincode: string | undefined;
  /** The exact `:pin` route param (undefined when the current route carries no hood). */
  routePincode: string | undefined;
  hood: Hood | null;
  anchor: GeoPoint | null;
  radiusM: number;
  adjacent: string[];
  loading: boolean;
}

const HoodContext = createContext<HoodValue | null>(null);

export function HoodProvider({ children }: { children: React.ReactNode }) {
  const { pin } = useParams<{ pin: string }>();
  const activePincode = pin ?? (readLastHood() || undefined);
  const { hood, loading } = useHood(activePincode);

  // Keep "last hood" fresh as the user browses so `/` and the FIELD slot restore correctly.
  useEffect(() => {
    if (pin) writeLastHood(pin);
  }, [pin]);

  const value = useMemo<HoodValue>(
    () => ({
      pincode: activePincode,
      routePincode: pin,
      hood,
      anchor: hood ? hood.centroid : null,
      radiusM: DEFAULT_RADIUS_M,
      adjacent: hood?.adjacent ?? [],
      loading,
    }),
    [activePincode, pin, hood, loading],
  );

  return <HoodContext.Provider value={value}>{children}</HoodContext.Provider>;
}

export function useHoodContext(): HoodValue {
  const ctx = useContext(HoodContext);
  if (!ctx) throw new Error('useHoodContext must be used within <HoodProvider>');
  return ctx;
}
