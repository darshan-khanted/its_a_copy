import { describe, expect, it } from 'vitest';
import { isValidPincode, normalizePincodeInput, PINCODE_RE } from './pincode';

describe('pincode validation (req 8.1)', () => {
  it('accepts a valid six-digit pincode', () => {
    expect(isValidPincode('560102')).toBe(true);
    expect(isValidPincode('110016')).toBe(true);
  });

  it('rejects a leading zero', () => {
    expect(isValidPincode('012345')).toBe(false);
    expect(PINCODE_RE.test('012345')).toBe(false);
  });

  it('rejects wrong length and non-digits', () => {
    expect(isValidPincode('12345')).toBe(false);
    expect(isValidPincode('1234567')).toBe(false);
    expect(isValidPincode('56010a')).toBe(false);
    expect(isValidPincode('')).toBe(false);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidPincode('  560102  ')).toBe(true);
  });

  it('normalizes input to at most six digits', () => {
    expect(normalizePincodeInput('56-01-02')).toBe('560102');
    expect(normalizePincodeInput('5601029999')).toBe('560102');
    expect(normalizePincodeInput('abc560')).toBe('560');
  });
});
