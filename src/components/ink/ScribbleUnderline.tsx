// Hand-drawn emphasis underline (design §B.4 / §B.2). Renders the child text with a decorative
// magenta scribble stroke behind it via an inline SVG. The stroke colour is driven by a token,
// never a literal (requirement 1.1); the SVG is aria-hidden so the word stays readable.
import React from 'react';

export interface ScribbleUnderlineProps {
  children: React.ReactNode;
  className?: string;
}

export function ScribbleUnderline({ children, className }: ScribbleUnderlineProps) {
  return (
    <span className={className} style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 200 18"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '-0.12em',
          width: '100%',
          height: '0.42em',
          zIndex: 0,
          overflow: 'visible',
        }}
      >
        <path
          d="M2 12 C 40 4, 80 16, 120 8 S 180 4, 198 10"
          fill="none"
          stroke="var(--color-magenta)"
          strokeWidth={5}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
