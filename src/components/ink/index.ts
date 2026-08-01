/**
 * The ink primitive set (design §B.4). Pure presentational components — no business logic and no
 * Firebase imports. Every visual value is a named token from theme.css consumed through the
 * ink.css utilities. These are what the Field, Board, and every feature surface compose from.
 */

// surfaces · pressables · cards
export { InkBox, popClass, type InkBoxProps, type Pop, type PopColor } from './InkBox';
export {
  InkPress,
  type InkPressProps,
  type InkPressVariant,
  type InkPressSize,
} from './InkPress';
export { TiltCard, type TiltCardProps } from './TiltCard';

// texture · brand
export { Halftone, type HalftoneProps } from './Halftone';
export { TapeLabel, type TapeLabelProps } from './TapeLabel';
export { ScribbleUnderline, type ScribbleUnderlineProps } from './ScribbleUnderline';
export { StrokeHeading, type StrokeHeadingProps } from './StrokeHeading';
export { Grain, type GrainProps } from './Grain';
export {
  BrandMark,
  Wordmark,
  BrandLockup,
  type BrandMarkProps,
  type WordmarkProps,
  type BrandLockupProps,
} from './Brand';

// motion
export { Marquee, type MarqueeProps } from './Marquee';
export { Reveal, type RevealProps } from './Reveal';
export { CountUp, type CountUpProps } from './CountUp';
export { ScrambleText, type ScrambleTextProps } from './ScrambleText';

// data display
export { Receipt, type ReceiptProps, type ReceiptLine } from './Receipt';
export { RedactedReveal, type RedactedRevealProps } from './RedactedReveal';
export { StatusPill, type StatusPillProps, type PillStatus } from './StatusPill';
export { RankChip, type RankChipProps } from './RankChip';
export { Price, type PriceProps } from './Price';
export {
  Avatar,
  pickAvatarTone,
  initialsFrom,
  AVATAR_TONES,
  type AvatarProps,
  type AvatarSize,
  type AvatarTone,
} from './Avatar';

// feedback · state
export { Skeleton, type SkeletonProps } from './Skeleton';
export { EmptyState, type EmptyStateProps, type EmptyArt } from './EmptyState';
export { Toast, type ToastProps, type ToastTone } from './Toast';
