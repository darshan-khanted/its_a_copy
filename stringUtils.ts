/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Capitalizes the first letter of each word in a string (e.g. for Name and Surname).
 */
export function toTitleCase(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Simple hash function to convert email to a deterministic non-sensitive ID.
 */
export function hashEmail(email: string | undefined | null): string {
  if (!email) return "";
  const lower = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    const char = lower.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return "hash_" + Math.abs(hash).toString(36);
}

