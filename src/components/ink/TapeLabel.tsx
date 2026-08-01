// Pinned tape label — "NEW", "URGENT", pinned things (design §B.4 / §B.2). Functional mono
// uppercase content; the tape colour and typography come from the .tape token utility.
import React from 'react';
import clsx from 'clsx';

export interface TapeLabelProps {
  children: React.ReactNode;
  /** Slight physical rotation, in degrees. */
  rot?: number;
  tone?: 'lime' | 'magenta';
  className?: string;
}

export function TapeLabel({ children, rot = -3, tone = 'lime', className }: TapeLabelProps) {
  return (
    <span
      className={clsx('tape', tone === 'magenta' && 'tape-magenta', className)}
      style={{ transform: `rotate(${rot}deg)` }}
    >
      {children}
    </span>
  );
}
