// Deterministic tilt card (design §B.4 / §H.8). The per-card `--rot` is seeded from a stable key
// (gig id / uid) so the tilt is identical on every render and every device and never jitters
// (requirement 1.4). Pure — the only randomness is the pure seeded generator in @/lib/seed.
import React from 'react';
import clsx from 'clsx';
import { InkBox, type InkBoxProps } from './InkBox';
import { seededRotation, MAX_TILT_DEG } from '@/lib/seed';

export interface TiltCardProps extends InkBoxProps {
  /** Stable key that determines the rotation, e.g. `gig.id` or `user.uid`. */
  seed: string;
  /** Maximum absolute rotation in degrees. Defaults to the system tilt limit. */
  maxRot?: number;
  /** Dense-list mode disables tilt entirely (§K.2). */
  disabled?: boolean;
}

export function TiltCard({
  seed,
  maxRot = MAX_TILT_DEG,
  disabled = false,
  className,
  style,
  children,
  ...rest
}: TiltCardProps) {
  const rot = disabled ? 0 : seededRotation(seed, maxRot);
  const rotStyle = { ['--rot']: `${rot}deg` } as React.CSSProperties;
  return (
    <InkBox
      {...rest}
      className={clsx(!disabled && 'tilt', className)}
      style={{ ...rotStyle, ...style }}
    >
      {children}
    </InkBox>
  );
}
