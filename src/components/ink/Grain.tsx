// Paper grain overlay (design §B.4 / §B.2 / §I.5). Mounted once at the app root. The feTurbulence
// texture and surface-aware opacity live in the .grain token utility; the texture-budget gating
// (mount/skip on data-saver, memory, motion) lands in task 11.2. Pure presentational primitive.
import React from 'react';
import { useSurface } from '@/app/providers/SurfaceProvider';

export interface GrainProps {
  /** Optional override of the surface-aware grain opacity token. */
  opacity?: number;
}

export function Grain({ opacity }: GrainProps) {
  const { surface } = useSurface();
  const style: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    pointerEvents: 'none',
  };
  if (typeof opacity === 'number') {
    (style as Record<string, unknown>)['--grain-opacity'] = String(opacity);
  }
  return <div aria-hidden="true" className="grain" data-surface={surface} style={style} />;
}
