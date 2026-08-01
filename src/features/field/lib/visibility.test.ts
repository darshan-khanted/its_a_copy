import { describe, expect, it } from 'vitest';
import type { Gig } from '@/types';
import {
  filterVisibleGigs,
  isGigVisible,
  PUBLIC_VIEWER,
  type ViewerVisibility,
} from './visibility';

const NOW = 1_000_000;

function gig(partial: Partial<Pick<Gig, 'minRank' | 'visibleFrom'>>): Pick<Gig, 'minRank' | 'visibleFrom'> {
  return {
    minRank: partial.minRank ?? null,
    visibleFrom: partial.visibleFrom ?? { legend: NOW, all: NOW },
  };
}

const legendViewer: ViewerVisibility = {
  isLegendPlus: true,
  meetsMinRank: () => true,
};

describe('gig visibility (req 18.6, 18.7, 18.8, §D.6)', () => {
  it('shows public gigs whose window has opened for everyone', () => {
    expect(isGigVisible(gig({ visibleFrom: { legend: NOW - 600_000, all: NOW - 1 } }), PUBLIC_VIEWER, NOW)).toBe(true);
  });

  it('withholds a head-start gig from public until the all-window opens', () => {
    const g = gig({ visibleFrom: { legend: NOW - 600_000, all: NOW + 600_000 } });
    expect(isGigVisible(g, PUBLIC_VIEWER, NOW)).toBe(false);
    // ...but a LEGEND+ viewer sees it during the head start (req 18.8)
    expect(isGigVisible(g, legendViewer, NOW)).toBe(true);
  });

  it('redacts a rank-floored gig from a viewer below the floor', () => {
    const g = gig({ minRank: 'LEGEND' });
    expect(isGigVisible(g, PUBLIC_VIEWER, NOW)).toBe(false);
    expect(isGigVisible(g, legendViewer, NOW)).toBe(true);
  });

  it('is monotone: once visible it stays visible at later times while open (req 18.7)', () => {
    const g = gig({ visibleFrom: { legend: NOW - 100, all: NOW - 100 } });
    expect(isGigVisible(g, PUBLIC_VIEWER, NOW)).toBe(true);
    expect(isGigVisible(g, PUBLIC_VIEWER, NOW + 10_000_000)).toBe(true);
  });

  it('tolerates legacy gigs missing visibleFrom / minRank', () => {
    expect(isGigVisible({ minRank: null, visibleFrom: undefined as never }, PUBLIC_VIEWER, NOW)).toBe(true);
  });

  it('filterVisibleGigs drops the withheld ones', () => {
    const gigs = [
      gig({ visibleFrom: { legend: NOW, all: NOW - 1 } }), // visible
      gig({ visibleFrom: { legend: NOW, all: NOW + 999 } }), // head-start only
      gig({ minRank: 'LEGEND' }), // floored
    ];
    expect(filterVisibleGigs(gigs, PUBLIC_VIEWER, NOW)).toHaveLength(1);
    expect(filterVisibleGigs(gigs, legendViewer, NOW)).toHaveLength(3);
  });
});
