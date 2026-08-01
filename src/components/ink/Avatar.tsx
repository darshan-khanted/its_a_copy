// Deterministic zine avatar (design §B.4 deleted-primitives note, requirement 1.9). Replaces the
// old 8-gradient generator with a palette-locked mark: a FLAT fill picked deterministically from
// [lime, magenta, cobalt, cyan, peach], an ink border, a halftone corner, initials in the display
// face, and a per-uid seeded `--rot` tilt. Same deterministic-hash idea, on-brand output.
//
// Pure: the only randomness is the pure seeded generator in @/lib/seed. No Firebase; `PublicIdentity`
// is a type-only import so nothing at runtime reaches the data layer.
import React from 'react';
import clsx from 'clsx';
import type { PublicIdentity } from '@/types/user';
import { seededPick, seededRotation } from '@/lib/seed';
import { RankChip } from './RankChip';

export type AvatarSize = 24 | 32 | 48 | 64 | 96;

/** The locked avatar palette (design §B.4). Token names, not colour literals. */
export const AVATAR_TONES = ['lime', 'magenta', 'cobalt', 'cyan', 'peach'] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

// Text ink that stays legible on each flat fill.
const TONE_TEXT: Record<AvatarTone, string> = {
  lime: 'var(--color-ink)',
  cyan: 'var(--color-ink)',
  peach: 'var(--color-ink)',
  magenta: 'var(--color-paper)',
  cobalt: 'var(--color-paper)',
};

/** Deterministically pick the fill tone for a seed. Stable across renders/devices. */
export function pickAvatarTone(seed: string): AvatarTone {
  return seededPick(seed, AVATAR_TONES);
}

/** Up to two uppercase initials from a display name. */
export function initialsFrom(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  user: Pick<PublicIdentity, 'uid' | 'displayName' | 'avatarSeed' | 'avatarUrl' | 'rank'>;
  size?: AvatarSize;
  showRank?: boolean;
  className?: string;
}

export function Avatar({ user, size = 48, showRank = false, className }: AvatarProps) {
  const tone = pickAvatarTone(user.avatarSeed || user.uid);
  const rot = seededRotation(user.uid || user.avatarSeed);
  const initials = initialsFrom(user.displayName);

  const box: React.CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    display: 'inline-flex',
    transform: `rotate(${rot}deg)`,
  };

  return (
    <span className={className} style={box}>
      <span
        className="ink-box-sm"
        role="img"
        aria-label={user.displayName}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: user.avatarUrl ? undefined : `var(--color-${tone})`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <>
            {/* halftone corner accent */}
            <span
              aria-hidden="true"
              className="halftone"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: '46%',
                height: '46%',
                opacity: 0.35,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: Math.round(size * 0.42),
                lineHeight: 1,
                color: TONE_TEXT[tone],
              }}
            >
              {initials}
            </span>
          </>
        )}
      </span>
      {showRank ? (
        <span style={{ position: 'absolute', right: -6, bottom: -6, transform: `rotate(${-rot}deg)` }}>
          <RankChip rank={user.rank} />
        </span>
      ) : null}
    </span>
  );
}
