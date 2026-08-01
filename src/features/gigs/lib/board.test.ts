import { describe, it, expect } from 'vitest';
import {
  buildBoardRows,
  distanceToAnchorM,
  matchesQuery,
  queryTokens,
  requiredRankIndex,
  searchGigs,
  searchableText,
  sortRows,
  totalValue,
  type BoardRowData,
} from './board';
import type { Gig } from '@/types';

const HSR = { lat: 12.9121, lng: 77.6446 };

function gig(over: Partial<Gig> & { id: string }): Gig {
  return {
    title: 'assemble an ikea shelf',
    body: 'two boxes, allen key provided',
    askPrice: 400,
    tags: ['furniture'],
    urgent: false,
    hoodId: '560102',
    areaLabel: 'HSR Layout',
    geoFuzzed: HSR,
    geohash7: 'tdnv2mn',
    fuzzSeedVersion: 1,
    startDate: '2025-01-01',
    startTime: '18:00',
    startHour: 18,
    expiresAt: 0,
    state: 'OPEN',
    agreedHandshakeId: null,
    claimCount: 0,
    posterUid: 'uid_a',
    posterSnapshot: {
      uid: 'uid_a',
      handle: 'aisha',
      displayName: 'Aisha Khan',
      avatarSeed: 'seed_a',
      rank: 'HUSTLER',
      rep: 250,
      verified: true,
      gigsSettled: 3,
      rating: null,
      ratingCount: 0,
    },
    minRank: null,
    visibleFrom: { legend: 0, all: 0 },
    createdAt: 1_000,
    schemaVersion: 2,
    ...over,
  } as Gig;
}

const rows = (gigs: Gig[]): BoardRowData[] => gigs.map((g) => ({ gig: g, distanceM: null }));

describe('board search (req 7.5)', () => {
  it('tokenises a query into deduped lowercase words', () => {
    expect(queryTokens('  IKEA   shelf ikea ')).toEqual(['ikea', 'shelf']);
    expect(queryTokens('   ')).toEqual([]);
  });

  it('searches title, body, freeform tags, area label and poster name — no categories', () => {
    const text = searchableText(gig({ id: 'g1' }));
    expect(text).toContain('ikea');
    expect(text).toContain('allen key');
    expect(text).toContain('furniture');
    expect(text).toContain('hsr layout');
    expect(text).toContain('aisha khan');
  });

  it('treats multiple words as an AND', () => {
    const g = gig({ id: 'g1' });
    expect(matchesQuery(g, queryTokens('ikea allen'))).toBe(true);
    expect(matchesQuery(g, queryTokens('ikea plumbing'))).toBe(false);
  });

  it('returns every gig for an empty query', () => {
    const all = [gig({ id: 'a' }), gig({ id: 'b', title: 'walk my dog' })];
    expect(searchGigs(all, '   ').map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('filters to matching gigs and is case-insensitive', () => {
    const all = [gig({ id: 'a' }), gig({ id: 'b', title: 'Walk My Dog', body: 'twice', tags: [] })];
    expect(searchGigs(all, 'DOG').map((g) => g.id)).toEqual(['b']);
  });
});

describe('board distance (req 7.2)', () => {
  it('measures from the anchor to the published fuzzed point', () => {
    const near = gig({ id: 'near', geoFuzzed: { lat: 12.9121, lng: 77.6446 } });
    const far = gig({ id: 'far', geoFuzzed: { lat: 12.9301, lng: 77.6446 } });
    expect(distanceToAnchorM(near, HSR)).toBeCloseTo(0, 5);
    expect(distanceToAnchorM(far, HSR)).toBeGreaterThan(1500);
  });

  it('is null without an anchor or usable coordinates', () => {
    expect(distanceToAnchorM(gig({ id: 'a' }), null)).toBeNull();
    expect(
      distanceToAnchorM(gig({ id: 'a', geoFuzzed: undefined as unknown as Gig['geoFuzzed'] }), HSR),
    ).toBeNull();
  });
});

describe('board sorting (req 7.2)', () => {
  const recent = gig({ id: 'recent', createdAt: 3_000, askPrice: 100 });
  const middle = gig({ id: 'middle', createdAt: 2_000, askPrice: 900, minRank: 'LEGEND' });
  const oldest = gig({ id: 'oldest', createdAt: 1_000, askPrice: 500, minRank: 'HUSTLER' });

  it('sorts by recency, newest first', () => {
    expect(sortRows(rows([oldest, recent, middle]), 'recency').map((r) => r.gig.id)).toEqual([
      'recent',
      'middle',
      'oldest',
    ]);
  });

  it('sorts by price, highest first', () => {
    expect(sortRows(rows([recent, oldest, middle]), 'price').map((r) => r.gig.id)).toEqual([
      'middle',
      'oldest',
      'recent',
    ]);
  });

  it('sorts by distance, nearest first, with unknown distances last', () => {
    const withDistance: BoardRowData[] = [
      { gig: recent, distanceM: 900 },
      { gig: middle, distanceM: null },
      { gig: oldest, distanceM: 120 },
    ];
    expect(sortRows(withDistance, 'distance').map((r) => r.gig.id)).toEqual([
      'oldest',
      'recent',
      'middle',
    ]);
  });

  it('sorts by required rank, open-to-everyone first', () => {
    expect(requiredRankIndex(recent)).toBe(0);
    expect(requiredRankIndex(oldest)).toBeLessThan(requiredRankIndex(middle));
    expect(sortRows(rows([middle, oldest, recent]), 'rank').map((r) => r.gig.id)).toEqual([
      'recent',
      'oldest',
      'middle',
    ]);
  });

  it('breaks ties deterministically and never mutates the input', () => {
    const a = gig({ id: 'a', createdAt: 5_000, askPrice: 200 });
    const b = gig({ id: 'b', createdAt: 5_000, askPrice: 200 });
    const input = rows([b, a]);
    expect(sortRows(input, 'price').map((r) => r.gig.id)).toEqual(['a', 'b']);
    expect(sortRows(input, 'price').map((r) => r.gig.id)).toEqual(['a', 'b']);
    expect(input.map((r) => r.gig.id)).toEqual(['b', 'a']);
  });
});

describe('buildBoardRows', () => {
  it('searches, derives distance, then sorts', () => {
    const shelf = gig({ id: 'shelf', createdAt: 1_000, geoFuzzed: { lat: 12.9301, lng: 77.6446 } });
    const dog = gig({
      id: 'dog',
      title: 'walk my dog',
      body: 'evening loop',
      tags: [],
      createdAt: 2_000,
    });
    const built = buildBoardRows([shelf, dog], { sort: 'distance', query: '' }, {
      anchor: HSR,
      now: 5_000,
    });
    expect(built.map((r) => r.gig.id)).toEqual(['dog', 'shelf']);
    expect(built[1].distanceM).toBeGreaterThan(1500);

    const searched = buildBoardRows([shelf, dog], { sort: 'recency', query: 'dog' }, {
      anchor: HSR,
      now: 5_000,
    });
    expect(searched.map((r) => r.gig.id)).toEqual(['dog']);
  });

  it('totals the rupee value of the listed rows', () => {
    const built = buildBoardRows(
      [gig({ id: 'a', askPrice: 400 }), gig({ id: 'b', askPrice: 350 })],
      { sort: 'recency', query: '' },
      { anchor: HSR, now: 0 },
    );
    expect(totalValue(built)).toBe(750);
  });
});
