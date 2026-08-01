import { describe, expect, it } from 'vitest';
import type { Gig, Hood, RealFieldSignal } from '@/types';
import {
  deriveFieldContent,
  deriveRealSignals,
  deriveSupplyPresentation,
  fieldRealCentroid,
  fieldRealCount,
  fieldRealValue,
  hasFabricatedSupply,
  isFirstFlareBonusEligible,
  isGhostSignal,
  isTeamGig,
  MAX_GHOST_NODES,
  seededGhostSignals,
  supplyState,
  waitlistIndicatorFor,
} from './supply';

const NOW = 1_700_000_000_000;

const HOOD_CENTROID = { lat: 12.9121, lng: 77.6446 };

function hood(partial: Partial<Hood> = {}): Hood {
  return {
    pincode: '560102',
    area: 'hsr layout',
    city: 'bengaluru',
    state: 'karnataka',
    centroid: HOOD_CENTROID,
    adjacent: ['560103', '560068'],
    status: 'live',
    launchThreshold: 40,
    waitlistCount: 31,
    activeMembers30d: 12,
    gigCount: 0,
    priceStats: {},
    hourHistogram: new Array(24).fill(0),
    resolvedAt: NOW,
    source: 'api',
    ...partial,
  };
}

function gig(partial: Partial<Gig> = {}): Gig {
  return {
    id: 'g1',
    title: 'carry a fridge up two floors',
    body: 'two of us, ten minutes',
    askPrice: 300,
    tags: [],
    urgent: false,
    hoodId: '560102',
    areaLabel: 'hsr layout',
    geoFuzzed: { lat: 12.9135, lng: 77.6462 },
    geohash7: 'tdr1bpe',
    fuzzSeedVersion: 1,
    startDate: '2024-01-01',
    startTime: '18:00',
    startHour: 18,
    expiresAt: NOW + 3_600_000,
    state: 'OPEN',
    agreedHandshakeId: null,
    claimCount: 0,
    posterUid: 'u1',
    posterSnapshot: {
      uid: 'u1',
      handle: 'neha',
      displayName: 'neha',
      avatarSeed: 'neha',
      rank: 'TAPPED_IN',
      rep: 10,
      verified: false,
      gigsSettled: 0,
      rating: null,
      ratingCount: 0,
    },
    minRank: null,
    visibleFrom: { legend: NOW - 1000, all: NOW - 1000 },
    createdAt: NOW - 600_000,
    schemaVersion: 2,
    ...partial,
  };
}

function gigs(n: number, price = 100): Gig[] {
  return Array.from({ length: n }, (_, i) =>
    gig({ id: `g${i}`, askPrice: price + i, geoFuzzed: { lat: 12.912 + i * 0.001, lng: 77.644 + i * 0.001 } }),
  );
}

describe('seededGhostSignals (req 9.1, 9.2, 9.3, 9.7)', () => {
  it('derives hollow WAITING ghosts from the real waitlist count', () => {
    const ghostNodes = seededGhostSignals('560102', 3, 0);
    expect(ghostNodes).toHaveLength(3);
    for (const g of ghostNodes) {
      expect(g.kind).toBe('WAITLIST_GHOST');
      expect(g.price).toBe(0);
      expect(g.title).toBe('WAITING');
      expect(g.claimable).toBe(false);
      expect(g.detailRoute).toBeNull();
      expect(g.fx).toBeGreaterThanOrEqual(0);
      expect(g.fx).toBeLessThanOrEqual(1);
      expect(g.fy).toBeGreaterThanOrEqual(0);
      expect(g.fy).toBeLessThanOrEqual(1);
    }
  });

  it('emits nothing when there is no real waitlist demand', () => {
    expect(seededGhostSignals('560102', 0, 0)).toEqual([]);
  });

  it('caps ghosts so a hollow wall never reads as a busy board', () => {
    expect(seededGhostSignals('560102', 5000, 0)).toHaveLength(MAX_GHOST_NODES);
  });

  it('places ghosts deterministically from the hood id (positions never move)', () => {
    const a = seededGhostSignals('560102', 4, 0);
    const b = seededGhostSignals('560102', 4, 0);
    expect(b).toEqual(a);
  });

  it('keeps a ghost slot fixed as the waitlist grows', () => {
    const small = seededGhostSignals('560102', 2, 0);
    const grown = seededGhostSignals('560102', 5, 0);
    expect(grown.slice(0, 2)).toEqual(small);
  });

  it('gives different hoods different silhouettes', () => {
    const a = seededGhostSignals('560102', 4, 0);
    const b = seededGhostSignals('560103', 4, 0);
    expect(a.map((g) => [g.fx, g.fy])).not.toEqual(b.map((g) => [g.fx, g.fy]));
  });

  it('refuses to fabricate ghosts when real supply exists', () => {
    // @ts-expect-error — the literal `0` type is the compile-time guard; this asserts the runtime one.
    expect(() => seededGhostSignals('560102', 4, 1)).toThrow(/zero real open gigs/);
  });
});

describe('deriveFieldContent zero supply (req 9.1, 9.2, 9.8)', () => {
  it('renders only ghosts and no waitlist indicator at zero real open gigs', () => {
    const content = deriveFieldContent([], hood({ waitlistCount: 3 }), { now: NOW });
    expect(content.nodes).toHaveLength(3);
    expect(content.nodes.every(isGhostSignal)).toBe(true);
    expect(content.waitlistIndicator).toBeNull();
  });

  it('excludes ghosts from count, value and centroid', () => {
    const content = deriveFieldContent([], hood({ waitlistCount: 5 }), { now: NOW });
    expect(fieldRealCount(content)).toBe(0);
    expect(fieldRealValue(content)).toBe(0);
    expect(fieldRealCentroid(content)).toBeNull();
  });
});

describe('deriveFieldContent with real supply (req 9.8, 9.9, 9.10)', () => {
  it('renders zero ghosts and exact real metrics', () => {
    const list = gigs(3, 100); // 100 + 101 + 102
    const content = deriveFieldContent(list, hood({ waitlistCount: 31 }), { now: NOW });

    expect(content.nodes.filter(isGhostSignal)).toHaveLength(0);
    expect(content.nodes.every((n) => n.kind === 'REAL_GIG')).toBe(true);
    expect(fieldRealCount(content)).toBe(3);
    expect(fieldRealValue(content)).toBe(303);
    expect(hasFabricatedSupply(content.nodes)).toBe(false);
  });

  it('reports waitlist demand only as a separate labelled indicator', () => {
    const content = deriveFieldContent(gigs(2), hood({ waitlistCount: 31, launchThreshold: 40 }), {
      now: NOW,
    });
    expect(content.waitlistIndicator).toEqual({ label: 'WAITLIST', count: 31, progressTarget: 40 });
    expect(content.nodes.some(isGhostSignal)).toBe(false);
  });

  it('drops the progress target once the launch threshold is met', () => {
    expect(waitlistIndicatorFor({ waitlistCount: 44, launchThreshold: 40 })).toEqual({
      label: 'WAITLIST',
      count: 44,
    });
    expect(waitlistIndicatorFor({ waitlistCount: 0, launchThreshold: 40 })).toBeNull();
  });

  it('accepts injected clustering that preserves real count and value', () => {
    const list = gigs(4, 100); // 100..103 => 406
    const cluster = (signals: readonly RealFieldSignal[]) => [
      {
        kind: 'REAL_GIG_CLUSTER' as const,
        id: 'c1',
        gigIds: signals.map((s) => s.id),
        count: signals.length,
        totalValue: signals.reduce((sum, s) => sum + s.price, 0),
        fx: 0.5,
        fy: 0.5,
      },
    ];
    const content = deriveFieldContent(list, hood(), { now: NOW, cluster });
    expect(content.nodes).toHaveLength(1);
    expect(fieldRealCount(content)).toBe(4);
    expect(fieldRealValue(content)).toBe(406);
  });

  it('rejects clustering that would misreport real supply', () => {
    const list = gigs(3, 100);
    const lossy = (signals: readonly RealFieldSignal[]) => signals.slice(0, 1);
    const content = deriveFieldContent(list, hood(), { now: NOW, cluster: lossy });
    expect(fieldRealCount(content)).toBe(3);
    expect(fieldRealValue(content)).toBe(303);
  });

  it('never lets injected clustering smuggle ghosts into the node layer', () => {
    const list = gigs(2, 100);
    const sneaky = (signals: readonly RealFieldSignal[]) => [
      ...signals,
      ...seededGhostSignals('560102', 3, 0),
    ];
    const content = deriveFieldContent(list, hood(), { now: NOW, cluster: sneaky });
    expect(content.nodes.some(isGhostSignal)).toBe(false);
    expect(hasFabricatedSupply(content.nodes)).toBe(false);
  });
});

describe('deriveRealSignals (req 9.3, 20.9)', () => {
  it('projects published fuzzed coordinates deterministically', () => {
    const a = deriveRealSignals(gigs(3), hood(), { now: NOW });
    const b = deriveRealSignals(gigs(3), hood(), { now: NOW });
    expect(b).toEqual(a);
    for (const s of a) {
      expect(s.fx).toBeGreaterThanOrEqual(0);
      expect(s.fx).toBeLessThanOrEqual(1);
      expect(Math.abs(s.rot)).toBeLessThanOrEqual(2.2);
    }
  });

  it('reports real age and never a negative age', () => {
    const [s] = deriveRealSignals([gig({ createdAt: NOW - 600_000 })], hood(), { now: NOW });
    expect(s.ageMins).toBe(10);
    const [future] = deriveRealSignals([gig({ createdAt: NOW + 60_000 })], hood(), { now: NOW });
    expect(future.ageMins).toBe(0);
  });
});

describe('hasFabricatedSupply (req 9.3, 9.8)', () => {
  it('flags ghosts mixed with real nodes', () => {
    const real = deriveRealSignals(gigs(1), hood(), { now: NOW });
    expect(hasFabricatedSupply([...real, ...seededGhostSignals('560102', 1, 0)])).toBe(true);
  });

  it('flags a ghost dressed up as a gig', () => {
    const [ghostNode] = seededGhostSignals('560102', 1, 0);
    expect(hasFabricatedSupply([{ ...ghostNode, price: 500 as 0 }])).toBe(true);
    expect(hasFabricatedSupply([{ ...ghostNode, claimable: true as false }])).toBe(true);
  });
});

describe('supplyState bands (design §K.4)', () => {
  it('bands zero, sparse and healthy boards', () => {
    expect(supplyState(0)).toBe('ZERO_SUPPLY');
    expect(supplyState(1)).toBe('SPARSE');
    expect(supplyState(4)).toBe('SPARSE');
    expect(supplyState(5)).toBe('HEALTHY');
  });
});

describe('deriveSupplyPresentation zero state (req 9.4, 9.5, 9.11)', () => {
  const present = (overrides = {}) =>
    deriveSupplyPresentation([], hood({ waitlistCount: 31, launchThreshold: 40 }), {
      now: NOW,
      ...overrides,
    });

  it('offers BE FIRST, LOOK AT NEARBY HOODS and a recruit share action', () => {
    const p = present();
    expect(p.state).toBe('ZERO_SUPPLY');
    expect(p.actions.map((a) => a.id)).toEqual([
      'BE_FIRST',
      'LOOK_AT_NEARBY_HOODS',
      'PULL_FRIENDS_IN',
    ]);
    expect(p.nearbyHoodIds).toEqual(['560103', '560068']);
    expect(p.nearbyLabel).toBe('FURTHER AWAY');
  });

  it('shows the launch meter in the N / M NEIGHBOURS · OPENS AT M form', () => {
    expect(present().launchMeter?.line).toBe('31 / 40 NEIGHBOURS · OPENS AT 40');
  });

  it('hides the launch meter once the hood has reached its threshold', () => {
    const p = deriveSupplyPresentation([], hood({ waitlistCount: 44, launchThreshold: 40 }), {
      now: NOW,
    });
    expect(p.launchMeter).toBeNull();
    expect(p.actions.map((a) => a.id)).toEqual(['BE_FIRST', 'LOOK_AT_NEARBY_HOODS']);
  });

  it('states the first-flare bonus only for an eligible viewer', () => {
    expect(present({ firstFlareEligible: true }).firstFlareBonusLine).toBe(
      'FIRST FLARE = DOUBLE REP',
    );
    expect(present().firstFlareBonusLine).toBeNull();
  });

  it('withholds flaring until the hood is live', () => {
    const p = deriveSupplyPresentation([], hood({ status: 'waitlist' }), { now: NOW });
    expect(p.canFlare).toBe(false);
    expect(p.actions.find((a) => a.id === 'BE_FIRST')?.disabled).toBe(true);
    expect(p.actions.find((a) => a.id === 'LOOK_AT_NEARBY_HOODS')?.disabled).toBe(false);
  });

  it('reports zero real supply with no summary line and ghost-town copy', () => {
    const p = present();
    expect(p.realCount).toBe(0);
    expect(p.realValue).toBe(0);
    expect(p.summaryLine).toBeNull();
    expect(p.ghosts).toHaveLength(6);
    expect(p.copy?.title).toBe('your hood is quiet rn');
  });
});

describe('deriveSupplyPresentation sparse state (req 9.6, 9.9, 9.11)', () => {
  it('reports the exact count and value with both sparse actions', () => {
    const p = deriveSupplyPresentation(gigs(3, 100), hood(), { now: NOW });
    expect(p.state).toBe('SPARSE');
    expect(p.realCount).toBe(3);
    expect(p.realValue).toBe(303);
    expect(p.summaryLine).toBe('3 SIGNALS · ₹303 ON THE FIELD');
    expect(p.actions.map((a) => a.id)).toEqual(['POST_A_FLARE', 'LOOK_AT_NEARBY_HOODS']);
    expect(p.ghosts).toEqual([]);
  });

  it('states the first-flare bonus next to the flare action when eligible', () => {
    const p = deriveSupplyPresentation(gigs(2), hood(), { now: NOW, firstFlareEligible: true });
    expect(p.firstFlareBonusLine).toBe('FIRST FLARE = DOUBLE REP');
    expect(p.copy?.title).toBe('just getting started here');
  });

  it('marks team-posted gigs instead of presenting them as ordinary users', () => {
    const list = [gig({ id: 'team-1', posterUid: 'qg-ops' }), gig({ id: 'g2', posterUid: 'u9' })];
    const p = deriveSupplyPresentation(list, hood(), { now: NOW, teamPosterUids: ['qg-ops'] });
    expect(p.teamGigIds).toEqual(['team-1']);
    expect(isTeamGig(list[0], ['qg-ops'])).toBe(true);
    expect(isTeamGig(list[1], ['qg-ops'])).toBe(false);
    expect(isTeamGig(list[0])).toBe(false);
  });
});

describe('deriveSupplyPresentation healthy state (req 9.10, 9.11)', () => {
  it('drops cold-start copy, actions and the bonus line on a healthy board', () => {
    const p = deriveSupplyPresentation(gigs(8, 100), hood({ waitlistCount: 31 }), {
      now: NOW,
      firstFlareEligible: true,
    });
    expect(p.state).toBe('HEALTHY');
    expect(p.actions).toEqual([]);
    expect(p.copy).toBeNull();
    expect(p.firstFlareBonusLine).toBeNull();
    expect(p.waitlistIndicator).toEqual({ label: 'WAITLIST', count: 31, progressTarget: 40 });
  });
});

describe('isFirstFlareBonusEligible (req 9.11)', () => {
  it('qualifies a viewer who has not yet flared in this hood', () => {
    expect(isFirstFlareBonusEligible({ hasFlaredInHood: false })).toBe(true);
    expect(isFirstFlareBonusEligible({ hasFlaredInHood: true })).toBe(false);
    expect(isFirstFlareBonusEligible(null)).toBe(false);
    expect(isFirstFlareBonusEligible(undefined)).toBe(false);
  });
});

describe('fieldRealCentroid (req 9.2)', () => {
  it('weights clusters by their real count and ignores ghosts', () => {
    const nodes = [
      { ...deriveRealSignals(gigs(1), hood(), { now: NOW })[0], fx: 0.2, fy: 0.2 },
      {
        kind: 'REAL_GIG_CLUSTER' as const,
        id: 'c1',
        gigIds: ['a', 'b', 'c'],
        count: 3,
        totalValue: 300,
        fx: 0.6,
        fy: 0.6,
      },
    ];
    const centroid = fieldRealCentroid({ nodes });
    expect(centroid?.fx).toBeCloseTo((0.2 + 0.6 * 3) / 4, 10);
    expect(centroid?.fy).toBeCloseTo((0.2 + 0.6 * 3) / 4, 10);
  });
});
