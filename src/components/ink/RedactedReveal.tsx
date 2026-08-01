// Redaction / reveal (design §B.4 / §B.2, requirement 27.11). Load-bearing: locked rank rewards
// and pre-agreement contact detail. Because blurred text is deliberately unreadable, it is NEVER
// the sole information carrier — when locked, the element always carries a real aria-label stating
// what is hidden and why (§I.1). Purely presentational; the caller decides `locked`.
import React from 'react';
import clsx from 'clsx';

export interface RedactedRevealProps {
  locked: boolean;
  /** Width of the blurred placeholder bar while locked. */
  placeholderWidth?: number | string;
  /** The real content, shown once unlocked. */
  children: React.ReactNode;
  /** In-voice hint, e.g. "hits at rank 04 👀". Also folded into the accessible label. */
  unlockHint?: string;
  /** Short description of what is hidden, for the accessible label. */
  hiddenLabel?: string;
  className?: string;
}

export function RedactedReveal({
  locked,
  placeholderWidth = 96,
  children,
  unlockHint,
  hiddenLabel = 'locked',
  className,
}: RedactedRevealProps) {
  if (!locked) {
    return <span className={className}>{children}</span>;
  }

  const label = unlockHint ? `${hiddenLabel} · ${unlockHint}` : hiddenLabel;
  const width = typeof placeholderWidth === 'number' ? `${placeholderWidth}px` : placeholderWidth;

  return (
    <span
      className={clsx('redacted', className)}
      role="img"
      aria-label={label}
      style={{ display: 'inline-block', width, minHeight: '1em' }}
    >
      {/* Decorative filler: the real content is hidden behind the blur, the aria-label carries meaning. */}
      <span aria-hidden="true">{children}</span>
    </span>
  );
}
