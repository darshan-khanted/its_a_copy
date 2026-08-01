// Surface primitive (design §B.4). The ink card: border + hard offset shadow, mapped from tokens
// via the .ink-box family in ink.css. No business logic, no Firebase, no colour/offset literals —
// every visual value is a named token consumed through the utility classes (requirement 1.1).
import React from 'react';
import clsx from 'clsx';

export type Pop = 'sm' | 'md' | 'lg';
export type PopColor = 'ink' | 'magenta' | 'lime' | 'cobalt' | 'gold';

export interface InkBoxProps extends React.HTMLAttributes<HTMLElement> {
  /** Intrinsic element to render. Defaults to `div`. */
  as?: keyof JSX.IntrinsicElements;
  /** Shadow weight: sm → .ink-box-sm, md → .ink-box, lg → .ink-box-lg. */
  pop?: Pop;
  /** Coloured shadow signalling state (magenta = urgent/live, lime = agreed/done, cobalt = money). */
  popColor?: PopColor;
  /** Border only, no hard shadow — dense list contexts (§K.2). */
  flat?: boolean;
  children?: React.ReactNode;
}

/** Map the shadow weight to its named utility class. */
export function popClass(pop: Pop): string {
  return pop === 'sm' ? 'ink-box-sm' : pop === 'lg' ? 'ink-box-lg' : 'ink-box';
}

/** Map a coloured shadow to its utility class. `ink` is the default; `gold` is set inline via token. */
function popColorClass(popColor: PopColor): string | null {
  switch (popColor) {
    case 'magenta':
      return 'ink-box-magenta';
    case 'lime':
      return 'ink-box-lime';
    case 'cobalt':
      return 'ink-box-cobalt';
    default:
      return null; // ink (paper default) / gold (night default) need no override class
  }
}

export function InkBox({
  as = 'div',
  pop = 'md',
  popColor = 'ink',
  flat = false,
  className,
  style,
  children,
  ...rest
}: InkBoxProps) {
  // `gold` has no utility class (it is the Night surface default), so drive it from the token.
  const goldStyle =
    popColor === 'gold' ? ({ ['--pop-color']: 'var(--color-gold)' } as React.CSSProperties) : null;

  return React.createElement(
    as,
    {
      ...rest,
      className: clsx(popClass(pop), popColorClass(popColor), flat && 'flat', className),
      style: goldStyle ? { ...goldStyle, ...style } : style,
    },
    children,
  );
}
