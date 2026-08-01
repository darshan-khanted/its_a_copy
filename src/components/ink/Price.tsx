// Price display (design §B.4). Indian-rupee formatting from the pure @/lib/format helper; the
// money colour comes from the --price-text semantic token (cobalt on paper, lime on night). An
// optional struck-through original supports negotiation deltas. Pure presentational primitive.
import React from 'react';
import { rupees } from '@/lib/format';

export interface PriceProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  /** Original price to show struck through (a discounted / lowered offer). */
  strike?: number;
}

const SIZE_TO_FONT: Record<'sm' | 'md' | 'lg' | 'hero', string> = {
  sm: 'var(--text-small)',
  md: 'var(--text-body)',
  lg: 'var(--text-h3)',
  hero: 'var(--text-price)',
};

export function Price({ amount, size = 'md', strike, style, ...rest }: PriceProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: SIZE_TO_FONT[size],
        color: 'var(--price-text)',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 'var(--space-2)',
        ...style,
      }}
      {...rest}
    >
      {typeof strike === 'number' ? (
        <span
          style={{
            textDecoration: 'line-through',
            color: 'var(--text-2)',
            fontWeight: 400,
            fontSize: '0.7em',
          }}
        >
          {rupees(strike)}
        </span>
      ) : null}
      <span>{rupees(amount)}</span>
    </span>
  );
}
