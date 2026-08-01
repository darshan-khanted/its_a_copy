// Pressable primitive (design §B.4 / §B.2). The tactile grammar: .ink-press translate-on-press,
// 44px minimum target, never a colour-only affordance (requirement 1.3, 1.8). Renders a <button>
// by default, or an <a> when `href` is supplied. Pure: no Firebase, no router import.
import React from 'react';
import clsx from 'clsx';
import { popClass, type Pop, type PopColor } from './InkBox';

export type InkPressVariant = 'primary' | 'ghost' | 'danger' | 'lime' | 'cobalt';
export type InkPressSize = 'sm' | 'md' | 'lg';

interface InkPressCommon {
  variant?: InkPressVariant;
  size?: InkPressSize;
  /** Border only, no hard shadow. */
  flat?: boolean;
  /** Swaps the label for an in-voice mono status line and disables interaction. */
  loading?: boolean;
  loadingLabel?: string;
  children?: React.ReactNode;
}

type ButtonProps = InkPressCommon &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { href?: undefined };
type AnchorProps = InkPressCommon &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string };

export type InkPressProps = ButtonProps | AnchorProps;

const SIZE_TO_POP: Record<InkPressSize, Pop> = { sm: 'sm', md: 'md', lg: 'lg' };

const VARIANT_TO_POPCOLOR: Record<InkPressVariant, PopColor> = {
  primary: 'ink',
  ghost: 'ink',
  danger: 'magenta',
  lime: 'lime',
  cobalt: 'cobalt',
};

function popColorClass(c: PopColor): string | null {
  return c === 'magenta'
    ? 'ink-box-magenta'
    : c === 'lime'
      ? 'ink-box-lime'
      : c === 'cobalt'
        ? 'ink-box-cobalt'
        : null;
}

function buildClasses(
  variant: InkPressVariant,
  size: InkPressSize,
  flat: boolean | undefined,
  className: string | undefined,
): string {
  const isGhost = variant === 'ghost' || Boolean(flat);
  return clsx(
    popClass(SIZE_TO_POP[size]),
    popColorClass(VARIANT_TO_POPCOLOR[variant]),
    isGhost && 'flat',
    'ink-press',
    'tap-target',
    className,
  );
}

function isAnchor(props: InkPressProps): props is AnchorProps {
  return typeof (props as AnchorProps).href === 'string';
}

export function InkPress(props: InkPressProps) {
  const label = props.loading ? (
    <span style={{ fontFamily: 'var(--font-mono)' }}>{props.loadingLabel ?? 'one sec…'}</span>
  ) : (
    props.children
  );

  if (isAnchor(props)) {
    const { variant = 'primary', size = 'md', flat, loading, loadingLabel, children, href, className, ...anchorRest } =
      props;
    void loadingLabel;
    void children;
    return (
      <a
        {...anchorRest}
        href={loading ? undefined : href}
        className={buildClasses(variant, size, flat, className)}
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
      >
        {label}
      </a>
    );
  }

  const {
    variant = 'primary',
    size = 'md',
    flat,
    loading,
    loadingLabel,
    children,
    className,
    type,
    disabled,
    ...buttonRest
  } = props;
  void loadingLabel;
  void children;
  return (
    <button
      {...buttonRest}
      type={type ?? 'button'}
      className={buildClasses(variant, size, flat, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {label}
    </button>
  );
}
