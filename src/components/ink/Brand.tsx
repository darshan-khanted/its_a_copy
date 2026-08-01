// Official brand artwork (design §B.4 deleted-primitives note, §K.8, requirement 1.10).
//
// The wordmark is OUTLINED ARTWORK — it is never re-typeset as live text. `BrandMark` embeds the
// official proximity-diagram mark SVG verbatim (a supplied artwork asset, so its brand fill is part
// of the artwork, not a component colour decision). `Wordmark` and `BrandLockup` render the supplied
// official lockup SVG through an <img>, so no component ever reconstructs the letterforms.
//
// Sizing and clear-space are enforced by the .brand-mark / .brand-lockup / .brand-clearspace token
// utilities (§K.8): mark ≥ 20px, horizontal lockup ≥ 90px wide, clear space ≥ the ring radius.
import React from 'react';
import clsx from 'clsx';

export interface BrandMarkProps {
  /** Rendered size in px. Below 20px the favicon artwork should be used instead (§K.8). */
  size?: number;
  /** Reserve clear space of at least the ring radius on all sides. */
  clearSpace?: boolean;
  title?: string;
  className?: string;
}

/**
 * The official mark: a Q that is also a proximity diagram (ring = hood radius, dot = you,
 * tail = the nearby gig / map pin). Embedded verbatim from the supplied `qwick-gig-mark.svg`.
 */
export function BrandMark({
  size = 40,
  clearSpace = false,
  title = 'Qwick Gig',
  className,
}: BrandMarkProps) {
  return (
    <span
      className={clsx('brand-mark', clearSpace && 'brand-clearspace', className)}
      style={{ lineHeight: 0 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <g transform="translate(0.00 0.00) scale(1.25045)">
          <g transform="translate(-6.41 -9.00)">
            <g fill="#1545FF">
              <path
                fillRule="evenodd"
                d="M32.00 12.50 A19.50 19.50 0 1 1 32.00 51.50 A19.50 19.50 0 1 1 32.00 12.50 Z M32.00 20.00 A12.00 12.00 0 1 0 32.00 44.00 A12.00 12.00 0 1 0 32.00 20.00 Z"
              />
              <path d="M33.55 46.69 L46.25 56.68 L43.95 40.69 Z" />
              <circle cx="32.00" cy="32.00" r="5.60" />
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}

export interface WordmarkProps {
  /** Path to the supplied official lockup artwork (outlined SVG). */
  src?: string;
  /** Rendered width in px (horizontal lockup minimum is 90px, §K.8). */
  width?: number;
  clearSpace?: boolean;
  alt?: string;
  className?: string;
}

/**
 * The official horizontal lockup, rendered as the supplied outlined artwork. Consumers deploy the
 * official SVG at `src` (default `/brand/qwick-gig-logo-horizontal.svg`); this primitive never
 * re-typesets the wordmark.
 */
export function Wordmark({
  src = '/brand/qwick-gig-logo-horizontal.svg',
  width = 140,
  clearSpace = false,
  alt = 'Qwick Gig',
  className,
}: WordmarkProps) {
  return (
    <img
      className={clsx('brand-lockup', clearSpace && 'brand-clearspace', className)}
      src={src}
      width={width}
      alt={alt}
      style={{ height: 'auto', display: 'inline-block' }}
    />
  );
}

export interface BrandLockupProps {
  /** Path to the supplied official lockup artwork. */
  wordmarkSrc?: string;
  markSize?: number;
  className?: string;
}

/** Mark + official wordmark artwork, side by side, with clear space reserved. */
export function BrandLockup({ wordmarkSrc, markSize = 32, className }: BrandLockupProps) {
  return (
    <span
      className={clsx('brand-clearspace', className)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
    >
      <BrandMark size={markSize} />
      <Wordmark src={wordmarkSrc} width={markSize * 3.4} />
    </span>
  );
}
