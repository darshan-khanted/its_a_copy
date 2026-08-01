// One-shot scroll reveal (design §B.4 / §B.2). Slides up + fades in once when it enters the
// viewport via IntersectionObserver, then stays put. The .reveal/.in token utilities carry the
// transition; reduced motion is neutralised by the global reset. Pure presentational primitive.
import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

export interface RevealProps {
  /** Stagger step (0–3) mapped to a small transition delay. */
  delay?: 0 | 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
}

const DELAY_MS: Record<0 | 1 | 2 | 3, number> = { 0: 0, 1: 80, 2: 160, 3: 240 };

export function Reveal({ delay = 0, children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx('reveal', shown && 'in', className)}
      style={{ transitionDelay: `${DELAY_MS[delay]}ms` }}
    >
      {children}
    </div>
  );
}
