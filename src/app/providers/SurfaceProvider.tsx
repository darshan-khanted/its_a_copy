// Surface context: paper (day) vs night. URL-owned override (`?surface=`) with a persisted
// preference fallback (design §B.3, requirement 25.1). Automatic sunset scheduling is completed
// in Phase 5 (task 11.1); this provides the three-way preference plumbing the shell needs now.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SurfacePref = 'auto' | 'paper' | 'night';
export type Surface = 'paper' | 'night';

const STORAGE_KEY = 'qwick_surface_pref';

interface SurfaceValue {
  pref: SurfacePref;
  surface: Surface;
  setPref: (pref: SurfacePref) => void;
}

const SurfaceContext = createContext<SurfaceValue | null>(null);

function isPref(value: string | null): value is SurfacePref {
  return value === 'auto' || value === 'paper' || value === 'night';
}

function readStoredPref(): SurfacePref {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPref(stored)) return stored;
  } catch {
    // ignore
  }
  return 'auto';
}

function resolveSurface(pref: SurfacePref): Surface {
  if (pref === 'paper' || pref === 'night') return pref;
  // auto: night from 18:00 to 06:00 (refined with hood sunset in task 11.1)
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6 ? 'night' : 'paper';
}

export function SurfaceProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useSearchParams();
  const urlSurface = params.get('surface');

  // The URL wins when it carries an explicit override; otherwise fall back to storage.
  const [pref, setPrefState] = useState<SurfacePref>(() =>
    isPref(urlSurface) ? urlSurface : readStoredPref(),
  );

  // Reflect external URL changes (shared links, back/forward) into the preference.
  useEffect(() => {
    if (isPref(urlSurface) && urlSurface !== pref) {
      setPrefState(urlSurface);
      try {
        localStorage.setItem(STORAGE_KEY, urlSurface);
      } catch {
        // ignore
      }
    }
  }, [urlSurface, pref]);

  const surface = useMemo(() => resolveSurface(pref), [pref]);

  const setPref = useCallback(
    (next: SurfacePref) => {
      setPrefState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      // Keep the URL authoritative: explicit surfaces are shareable, `auto` clears the param.
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === 'auto') p.delete('surface');
          else p.set('surface', next);
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-surface', surface);
  }, [surface]);

  const value = useMemo<SurfaceValue>(() => ({ pref, surface, setPref }), [pref, surface, setPref]);

  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}

export function useSurface(): SurfaceValue {
  const ctx = useContext(SurfaceContext);
  if (!ctx) throw new Error('useSurface must be used within <SurfaceProvider>');
  return ctx;
}
