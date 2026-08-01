// Scrolling rail (design §B.4 / §B.2). The moving track is aria-hidden and duplicated for a
// seamless loop; the accessible label lives on the wrapper. Speed/direction come from tokens.
// Reduced motion is handled globally by the .marquee reset in the design system.
import React from 'react';
import clsx from 'clsx';

export interface MarqueeProps {
  items: React.ReactNode[];
  speed?: 'slow' | 'normal' | 'fast';
  reverse?: boolean;
  pauseOnHover?: boolean;
  ariaLabel?: string;
  className?: string;
}

const SPEED_TO_DURATION: Record<'slow' | 'normal' | 'fast', string> = {
  slow: '46s',
  normal: 'var(--dur-marquee)',
  fast: '22s',
};

export function Marquee({
  items,
  speed = 'normal',
  reverse = false,
  ariaLabel,
  className,
}: MarqueeProps) {
  // Duplicate the item set so the -50% keyframe wraps seamlessly.
  const track = [...items, ...items];
  return (
    <div
      className={clsx('no-scrollbar', className)}
      style={{ overflow: 'hidden', width: '100%' }}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        aria-hidden="true"
        className="marquee"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-6)',
          animationDuration: SPEED_TO_DURATION[speed],
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {track.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
