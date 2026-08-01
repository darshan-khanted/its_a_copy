// Halftone dot texture (design §B.4 / §B.2). Decorative fill also used as the loading-shimmer
// base. Purely presentational; the dot colour comes from tokens via .halftone / .halftone-lime.
import React from 'react';
import clsx from 'clsx';

export interface HalftoneProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'ink' | 'lime';
  /** Optional dot pitch in px; defaults to the value baked into the utility class. */
  size?: number;
}

export function Halftone({ tone = 'ink', size, className, style, ...rest }: HalftoneProps) {
  const sizeStyle = size ? { backgroundSize: `${size}px ${size}px` } : null;
  return (
    <span
      aria-hidden="true"
      className={clsx(tone === 'lime' ? 'halftone-lime' : 'halftone', className)}
      style={sizeStyle ? { ...sizeStyle, ...style } : style}
      {...rest}
    />
  );
}
