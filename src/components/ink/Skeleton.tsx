// Loading skeleton (design §B.4 / §G.6). Never a grey rounded rectangle — .ink-box-sm blocks with
// a .halftone fill and an in-voice mono status line (requirement 2.2). Announced politely. Pure.
import React from 'react';
import clsx from 'clsx';

export interface SkeletonProps {
  lines?: number;
  halftone?: boolean;
  /** In-voice mono status line, e.g. "scanning your hood…". */
  statusLine?: string;
  className?: string;
}

export function Skeleton({ lines = 3, halftone = true, statusLine, className }: SkeletonProps) {
  return (
    <div
      className={className}
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={clsx('ink-box-sm', halftone && 'halftone')}
          style={{
            height: 'var(--space-6)',
            // taper the last bar so it reads as text, not a slab
            width: i === lines - 1 ? '62%' : '100%',
            opacity: 0.6,
          }}
        />
      ))}
      {statusLine ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-small)',
            color: 'var(--text-2)',
          }}
        >
          {statusLine}
        </span>
      ) : null}
    </div>
  );
}
