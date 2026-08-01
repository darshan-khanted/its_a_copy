// Animated number tally (design §B.4). Counts from 0 to `to` over `durationMs` with rAF; under a
// reduced-motion preference it renders the final value immediately (requirement 27.13). Pure.
import React, { useEffect, useRef, useState } from 'react';

export interface CountUpProps extends React.HTMLAttributes<HTMLSpanElement> {
  to: number;
  durationMs?: number;
  format?: (n: number) => string;
  prefix?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function CountUp({
  to,
  durationMs = 900,
  format = (n) => String(Math.round(n)),
  prefix = '',
  ...rest
}: CountUpProps) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? to : 0));
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || durationMs <= 0) {
      setValue(to);
      return;
    }
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [to, durationMs]);

  return (
    <span {...rest}>
      {prefix}
      {format(value)}
    </span>
  );
}
