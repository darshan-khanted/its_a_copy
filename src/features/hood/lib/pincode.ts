// Canonical six-digit pincode validation (design §C.7, requirement 8.1).
// The leading-zero rejection matches the prototype's regex: `^[1-9][0-9]{5}$`.

export const PINCODE_RE = /^[1-9][0-9]{5}$/;

export function isValidPincode(pincode: string): boolean {
  return PINCODE_RE.test(pincode.trim());
}

/** Strip non-digits and clamp to six characters — for controlled input fields. */
export function normalizePincodeInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}
