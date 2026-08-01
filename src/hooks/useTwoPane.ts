// Desktop two-pane breakpoint (requirement 25.9, design §F.4/§I.7): at >= 1024px the app
// shows a persistent Field pane alongside a detail pane. Below that it is single-pane mobile.
import { useEffect, useState } from 'react';

const TWO_PANE_QUERY = '(min-width: 1024px)';

export function useTwoPane(): boolean {
  const [twoPane, setTwoPane] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(TWO_PANE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(TWO_PANE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setTwoPane(e.matches);
    setTwoPane(mql.matches);
    // addEventListener is the modern API; fall back for older Safari.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return twoPane;
}
