// Outlined display heading (design §B.4 / §B.2). Uses the .stroke-ink / .stroke-thin token
// utilities for the transparent-fill, ink-stroked look. The stroke colour and width are tokens.
import React from 'react';
import clsx from 'clsx';

export interface StrokeHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3;
  weight?: 'thin' | 'bold';
  children: React.ReactNode;
}

const LEVEL_TO_SIZE: Record<1 | 2 | 3, string> = {
  1: 'var(--text-h1)',
  2: 'var(--text-h2)',
  3: 'var(--text-h3)',
};

export function StrokeHeading({
  level,
  weight = 'bold',
  className,
  style,
  children,
  ...rest
}: StrokeHeadingProps) {
  const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
  return React.createElement(
    Tag,
    {
      ...rest,
      className: clsx(weight === 'thin' ? 'stroke-thin' : 'stroke-ink', className),
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: LEVEL_TO_SIZE[level],
        lineHeight: 1.02,
        margin: 0,
        ...style,
      } as React.CSSProperties,
    },
    children,
  );
}
