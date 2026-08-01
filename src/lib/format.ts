/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formatting helpers (design §B.5 voice rule 3, §H.3, §I).
 *
 * Pure, I/O-free (req 30.11).
 */

/**
 * Indian-currency formatting. `₹` is always prefixed and the amount is grouped
 * with the en-IN lakh convention, so one hundred thousand renders as `1,00,000`
 * (req 2.4, design §B.5 rule 3). Non-finite input is treated as ₹0.
 */
export function rupees(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${safe.toLocaleString('en-IN')}`;
}

/**
 * Privacy-aware distance words. The displayed number is never more precise than
 * the fuzz allows (req 20.6, NFR-4.2, design §H.3):
 * - below 500 m: rounded to the nearest 50 m (minimum 50 m)
 * - 500 m to 999 m: rounded to the nearest 100 m
 * - 1 km and above: one decimal kilometre
 *
 * This exactly mirrors the granularity used by the Field's accessible names
 * (design §H.2) so the visual and spoken representations never disagree.
 */
export function distanceWords(distanceM: number): string {
  if (!Number.isFinite(distanceM) || distanceM < 0) return '';
  if (distanceM < 500) {
    const rounded = Math.max(50, Math.round(distanceM / 50) * 50);
    return `${rounded} m`;
  }
  if (distanceM < 1000) {
    const rounded = Math.round(distanceM / 100) * 100;
    return `${rounded} m`;
  }
  const km = distanceM / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * In-voice relative time. Lowercase, expressive (design §B.5 rule 1).
 */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
