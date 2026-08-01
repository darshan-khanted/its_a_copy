import { describe, it, expect } from 'vitest';
import {
  clusterAccessibleName,
  ghostAccessibleName,
  moveAnnouncement,
  nodeAccessibleName,
  octantWords,
  positionWords,
  signalAccessibleName,
} from './narration';
import { fieldVoice } from '@/copy/field';
import type { GhostFieldSignal, RealFieldCluster, RealFieldSignal } from '@/types';

const signal: RealFieldSignal = {
  kind: 'REAL_GIG',
  id: 'gig_1',
  fx: 0.62,
  fy: 0.4,
  distanceM: 312,
  bearingDeg: 44,
  price: 450,
  title: 'assemble my ikea desk pls',
  tone: 'cobalt',
  urgent: false,
  ageMins: 12,
  rot: 1.2,
  locked: false,
  headStart: false,
};

describe('compass octants (design §I.3.2)', () => {
  it('speaks bearings as octants, not degrees', () => {
    expect(octantWords(0)).toBe('north');
    expect(octantWords(44)).toBe('north-east');
    expect(octantWords(90)).toBe('east');
    expect(octantWords(183)).toBe('south');
    expect(octantWords(315)).toBe('north-west');
  });

  it('wraps out-of-range bearings', () => {
    expect(octantWords(360)).toBe('north');
    expect(octantWords(-45)).toBe('north-west');
    expect(octantWords(450)).toBe('east');
    expect(octantWords(725)).toBe('north');
  });

  it('falls back to north for non-finite input', () => {
    expect(octantWords(Number.NaN)).toBe('north');
  });
});

describe('spatial narration (req 4.4, 20.6)', () => {
  it('rounds distance to the same granularity as the visual', () => {
    // 312 m rounds to the nearest 50 m below 500 m, so the spoken form is never more
    // precise than the fuzz allows.
    expect(positionWords(312, 44)).toBe('300 m north-east');
  });

  it('states title, price, position, age and claims', () => {
    const name = signalAccessibleName(signal, { claimCount: 2 });
    expect(name).toBe(
      'assemble my ikea desk pls. ₹450. 300 m north-east. posted 12 minutes ago. 2 people claimed.',
    );
  });

  it('reports an unclaimed signal honestly', () => {
    expect(signalAccessibleName(signal)).toContain('nobody has claimed yet');
  });

  it('narrates a cluster as a list, never as a zoom (req 5.3)', () => {
    const cluster: RealFieldCluster = {
      kind: 'REAL_GIG_CLUSTER',
      id: 'cluster:1:2',
      gigIds: ['a', 'b', 'c', 'd'],
      count: 4,
      totalValue: 1900,
      fx: 0.4,
      fy: 0.4,
    };
    const name = clusterAccessibleName(cluster);
    expect(name).toContain('4 signals here');
    expect(name).toContain('₹1,900');
    expect(name).toContain(fieldVoice.clusterHint);
  });

  it('never lets a ghost claim to be work (req 9.1, 9.2)', () => {
    const ghost: GhostFieldSignal = {
      kind: 'WAITLIST_GHOST',
      id: 'ghost:560102:0',
      fx: 0.6,
      fy: 0.3,
      price: 0,
      title: 'WAITING',
      claimable: false,
      detailRoute: null,
    };
    const name = ghostAccessibleName(ghost);
    expect(name).toBe(fieldVoice.ghostSignal);
    expect(name).not.toMatch(/₹/);
    expect(nodeAccessibleName(ghost)).toBe(name);
  });

  it('announces deliberate moves with the signal name', () => {
    expect(moveAnnouncement('₹450 desk')).toBe('now on: ₹450 desk');
  });
});
