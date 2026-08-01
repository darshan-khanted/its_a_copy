import { describe, it, expect } from 'vitest';
import { rupees, distanceWords, relativeTime } from './format';

describe('rupees — Indian currency (req 2.4)', () => {
  it('prefixes ₹ and groups en-IN lakhs', () => {
    expect(rupees(100000)).toBe('₹1,00,000');
    expect(rupees(1000)).toBe('₹1,000');
    expect(rupees(400)).toBe('₹400');
  });

  it('rounds and guards non-finite input', () => {
    expect(rupees(499.6)).toBe('₹500');
    expect(rupees(NaN)).toBe('₹0');
    expect(rupees(Infinity)).toBe('₹0');
  });
});

describe('distanceWords — privacy granularity (req 20.6)', () => {
  it('rounds below 500 m to the nearest 50 m with a 50 m floor', () => {
    expect(distanceWords(0)).toBe('50 m');
    expect(distanceWords(120)).toBe('100 m');
    expect(distanceWords(312)).toBe('300 m');
    expect(distanceWords(460)).toBe('450 m');
  });

  it('rounds 500–999 m to the nearest 100 m', () => {
    expect(distanceWords(500)).toBe('500 m');
    expect(distanceWords(640)).toBe('600 m');
    expect(distanceWords(949)).toBe('900 m');
  });

  it('renders 1 km and above as one decimal kilometre', () => {
    expect(distanceWords(1000)).toBe('1.0 km');
    expect(distanceWords(1500)).toBe('1.5 km');
    expect(distanceWords(12000)).toBe('12.0 km');
  });

  it('returns empty string for invalid input', () => {
    expect(distanceWords(-5)).toBe('');
    expect(distanceWords(NaN)).toBe('');
  });
});

describe('relativeTime', () => {
  it('reads in voice', () => {
    const now = 1_000_000_000;
    expect(relativeTime(now, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60000, now)).toBe('5m ago');
    expect(relativeTime(now - 3 * 3600_000, now)).toBe('3h ago');
    expect(relativeTime(now - 2 * 86400_000, now)).toBe('2d ago');
  });
});
