/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Universal date formatter that detects any YYYY-MM-DD date patterns inside a string
 * and replaces them with DD/MM/YY format.
 * E.g., "Date: 2026-07-04" -> "Date: 04/07/26"
 * E.g., "2026-07-04" -> "04/07/26"
 */
export function formatToDDMMYY(str: string | undefined | null): string {
  if (!str) return "";
  // Match YYYY-MM-DD
  return str.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, y, m, d) => {
    const shortYear = y.slice(-2);
    return `${d}/${m}/${shortYear}`;
  });
}

/**
 * Formats a timestamp (number), Date, or valid Date string into DD/MM/YY.
 */
export function formatTimestampToDDMMYY(timestamp: number | Date | string | undefined | null): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const shortYear = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${shortYear}`;
}
