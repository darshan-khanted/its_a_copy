import { describe, expect, it } from 'vitest';
import type { Hood } from '@/types';
import {
  canActInHood,
  DEFAULT_LAUNCH_THRESHOLD,
  hoodLaunchProgress,
  isHoodLive,
  peakHour,
  priceGuidance,
  reachCount,
} from './stats';

function hood(partial: Partial<Hood>): Hood {
  return {
    pincode: '560102',
    area: 'HSR Layout',
    city: 'Bengaluru',
    state: 'Karnataka',
    centroid: { lat: 12.9121, lng: 77.6446 },
    adjacent: [],
    status: 'waitlist',
    waitlistCount: 0,
    activeMembers30d: 0,
    gigCount: 0,
    priceStats: {},
    hourHistogram: new Array(24).fill(0),
    resolvedAt: 0,
    source: 'fallback',
    ...partial,
  };
}

describe('hood stat selectors (§C.9, §E.2, req 8.10)', () => {
  it('finds the real peak hour within the scrubber window, earliest on ties', () => {
    const hist = new Array(24).fill(0);
    hist[9] = 5;
    hist[18] = 5; // tie with 9 -> earliest wins
    hist[3] = 99; // outside 8..23 window, ignored
    expect(peakHour(hood({ hourHistogram: hist }))).toBe(9);
  });

  it('returns null peak hour for an empty histogram', () => {
    expect(peakHour(hood({}))).toBeNull();
  });

  it('exposes price guidance only when the band has data', () => {
    expect(priceGuidance(hood({ priceStats: { all: { p25: 250, p50: 350, p75: 450, n: 12 } } }))).toEqual({
      p25: 250,
      p50: 350,
      p75: 450,
      n: 12,
    });
    expect(priceGuidance(hood({ priceStats: { all: { p25: 0, p50: 0, p75: 0, n: 0 } } }))).toBeNull();
    expect(priceGuidance(hood({}))).toBeNull();
  });

  it('reports reach and launch state', () => {
    expect(reachCount(hood({ activeMembers30d: 47 }))).toBe(47);
    expect(isHoodLive(hood({ status: 'live' }))).toBe(true);
    expect(canActInHood(hood({ status: 'live' }))).toBe(true);
    expect(canActInHood(hood({ status: 'waitlist' }))).toBe(false);
    expect(canActInHood(null)).toBe(false);
  });

  it('computes pre-launch progress using the server threshold (req 8.10, 9.4)', () => {
    const p = hoodLaunchProgress(hood({ waitlistCount: 31, launchThreshold: 40 }));
    expect(p).toEqual({ current: 31, target: 40, reached: false });
  });

  it('falls back to the default threshold when none is set', () => {
    const p = hoodLaunchProgress(hood({ waitlistCount: 5 }));
    expect(p.target).toBe(DEFAULT_LAUNCH_THRESHOLD);
    expect(p.current).toBe(5);
    expect(p.reached).toBe(false);
  });

  it('clamps current to the target and marks the threshold reached', () => {
    const p = hoodLaunchProgress(hood({ waitlistCount: 88, launchThreshold: 40 }));
    expect(p).toEqual({ current: 40, target: 40, reached: true });
  });

  it('never produces a negative count or a zero target', () => {
    const p = hoodLaunchProgress(hood({ waitlistCount: -3, launchThreshold: 0 }));
    expect(p.current).toBe(0);
    expect(p.target).toBeGreaterThanOrEqual(1);
  });
});
