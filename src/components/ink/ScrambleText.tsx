// Decode/scramble text (design §B.4, the rank-reveal payoff §D.5). Resolves the target string
// character by character from a glyph charset. Under reduced motion it shows the final text at
// once and fires no animation (requirement 27.13). Pure — deterministic charset, no I/O.
import React, { useEffect, useRef, useState } from 'react';

export interface ScrambleTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  charset?: string;
  trigger?: 'mount' | 'inview' | 'hover';
  /** Total decode duration in ms. */
  durationMs?: number;
}

const DEFAULT_CHARSET = '█▓▒░#@%&*?/\\<>*';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ScrambleText({
  text,
  charset = DEFAULT_CHARSET,
  trigger = 'mount',
  durationMs = 700,
  onMouseEnter,
  ...rest
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? text : ''));
  const ref = useRef<HTMLSpanElement | null>(null);
  const frame = useRef<number | null>(null);
  const started = useRef(false);

  const run = () => {
    if (started.current || prefersReducedMotion()) {
      setDisplay(text);
      return;
    }
    started.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const resolved = Math.floor(t * text.length);
      let out = text.slice(0, resolved);
      for (let i = resolved; i < text.length; i++) {
        out += text[i] === ' ' ? ' ' : charset[(i + Math.floor(now / 40)) % charset.length];
      }
      setDisplay(out);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else setDisplay(text);
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }
    if (trigger === 'mount') run();
    if (trigger === 'inview') {
      const node = ref.current;
      if (!node || typeof IntersectionObserver === 'undefined') {
        run();
        return;
      }
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            run();
            obs.disconnect();
          }
        },
        { threshold: 0.3 },
      );
      obs.observe(node);
      return () => obs.disconnect();
    }
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, trigger]);

  return (
    <span
      ref={ref}
      onMouseEnter={(e) => {
        if (trigger === 'hover') run();
        onMouseEnter?.(e);
      }}
      {...rest}
    >
      {display}
    </span>
  );
}
