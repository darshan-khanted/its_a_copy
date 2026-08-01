import { describe, it, expect } from 'vitest';
import {
  xmur3,
  mulberry32,
  seededRandom,
  seededPick,
  seededRotation,
  MAX_TILT_DEG,
} from './seed';

describe('seed — deterministic generation (§H.8)', () => {
  it('seededRandom is deterministic for identical keys', () => {
    const a = seededRandom('gig_123');
    const b = seededRandom('gig_123');
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('seededRandom differs across distinct keys', () => {
    expect(seededRandom('a')()).not.toEqual(seededRandom('b')());
  });

  it('mulberry32 yields values in [0, 1)', () => {
    const rnd = mulberry32(xmur3('seed')());
    for (let i = 0; i < 1000; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seededPick is stable and never undefined for non-empty arrays', () => {
    const items = ['lime', 'magenta', 'cobalt', 'cyan', 'peach'] as const;
    const first = seededPick('user_42', items);
    expect(items).toContain(first);
    expect(seededPick('user_42', items)).toBe(first);
  });

  it('seededPick throws on an empty array', () => {
    expect(() => seededPick('x', [])).toThrow();
  });

  it('seededRotation stays within ±maxDeg and is stable', () => {
    for (const key of ['gig_1', 'gig_2', 'user_9', 'hood_560102']) {
      const r1 = seededRotation(key);
      const r2 = seededRotation(key);
      expect(r1).toBe(r2);
      expect(Math.abs(r1)).toBeLessThanOrEqual(MAX_TILT_DEG);
    }
  });

  it('seededRotation honours a custom bound', () => {
    for (let i = 0; i < 200; i++) {
      const r = seededRotation(`k${i}`, 5);
      expect(Math.abs(r)).toBeLessThanOrEqual(5);
    }
  });
});
