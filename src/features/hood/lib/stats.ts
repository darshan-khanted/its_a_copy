// Pure client selectors over the persisted Hood document (design §C.7, §C.9, §E.2).
// The server owns statistics computation; these read the denormalised results for
// the day-rhythm scrubber, price guidance, launch state, and broadcast reach.
import type { Hood } from '@/types';

/** The day-rhythm scrubber covers hours 8..23 (design §C.9). */
export const SCRUBBER_START_HOUR = 8;
export const SCRUBBER_END_HOUR = 23;

/**
 * The hood's real busiest hour within the scrubber window, or null when there is
 * no activity. Ties resolve to the earliest hour for stability.
 */
export function peakHour(hood: Pick<Hood, 'hourHistogram'>): number | null {
  const hist = hood.hourHistogram ?? [];
  let best: number | null = null;
  let bestCount = 0;
  for (let h = SCRUBBER_START_HOUR; h <= SCRUBBER_END_HOUR; h++) {
    const count = hist[h] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = h;
    }
  }
  return best;
}

export interface PriceGuidance {
  p25: number;
  p50: number;
  p75: number;
  n: number;
}

/** Price guidance band for the compose flow (design §E.2). Defaults to the `all` band. */
export function priceGuidance(hood: Pick<Hood, 'priceStats'>, band = 'all'): PriceGuidance | null {
  const stats = hood.priceStats?.[band];
  if (!stats || stats.n <= 0) return null;
  return { p25: stats.p25, p50: stats.p50, p75: stats.p75, n: stats.n };
}

/** Real 30-day active membership — powers the "REACHING N NEIGHBOURS" broadcast. */
export function reachCount(hood: Pick<Hood, 'activeMembers30d'>): number {
  return Math.max(0, hood.activeMembers30d ?? 0);
}

export function isHoodLive(hood: Pick<Hood, 'status'>): boolean {
  return hood.status === 'live';
}

/**
 * Default neighbours required for a hood to go live when the server has not set an
 * explicit `launchThreshold` (design §K.4 uses 40 in its worked example).
 */
export const DEFAULT_LAUNCH_THRESHOLD = 40;

export interface LaunchProgress {
  /** Real waitlist neighbours signed up so far. */
  current: number;
  /** Neighbours required before the hood flips to `live`. */
  target: number;
  /** Whether the waitlist has already reached the launch threshold. */
  reached: boolean;
}

/**
 * Pre-launch progress for the `N / M NEIGHBOURS · OPENS AT M` meter (requirement 8.10, 9.4,
 * design §K.4). Reads the denormalised waitlist count and the server threshold, falling back
 * to {@link DEFAULT_LAUNCH_THRESHOLD}. `current` is clamped to the target so the meter never
 * overflows once the threshold is met.
 */
export function hoodLaunchProgress(
  hood: Pick<Hood, 'waitlistCount' | 'launchThreshold'>,
): LaunchProgress {
  const target = Math.max(1, hood.launchThreshold ?? DEFAULT_LAUNCH_THRESHOLD);
  const raw = Math.max(0, hood.waitlistCount ?? 0);
  return { current: Math.min(raw, target), target, reached: raw >= target };
}

/**
 * Whether flaring and claiming are permitted in this hood. Withheld until the hood
 * is live (design §C.7, requirement 8.10).
 */
export function canActInHood(hood: Pick<Hood, 'status'> | null | undefined): boolean {
  return Boolean(hood && hood.status === 'live');
}
