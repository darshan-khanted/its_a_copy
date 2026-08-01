/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lintable voice constraints (design §B.5 "voice constitution", req 2.1–2.8).
 *
 * Pure, I/O-free predicates so the copy module can be checked as a unit test
 * (`src/**\/*.test.ts`) rather than relying only on human review. Every function
 * operates on system-authored copy. User-authored text is NEVER transformed or
 * validated here — see {@link preserveUserAuthored} (req 2.3).
 *
 * The voice constitution encoded here:
 *  1. Expressive text (headlines, empty, errors, loading) is lowercase.
 *  2. Functional text (labels, statuses, metadata, nav) is UPPERCASE MONO.
 *  3. At most one emoji, positioned at the end; never inside a mono label (req 2.5).
 *  4. Safety/payment/dispute/verification copy is plain and non-humorous (req 2.6).
 *  5. No apologetic error strings; every error names a next action (req 2.7).
 *  6. Location placeholders use a real Indian hood name (req 2.8).
 */

import { REAL_HOOD_NAMES } from '@/copy/placeholders';

/** Matches a single emoji / pictographic glyph. */
const EMOJI = /\p{Extended_Pictographic}/gu;

/** Emoji anchored to the end of the string (allowing a variation selector + trailing space). */
const EMOJI_AT_END = /\p{Extended_Pictographic}\uFE0F?\s*$/u;

/** Apologetic markers banned from error copy (req 2.7). */
const APOLOGETIC = /\b(oops|sorry)\b|something went wrong/i;

/**
 * Action indicators. An error must name a next action (req 2.7). This accepts
 * common in-voice imperatives and retry affordances rather than requiring a
 * rigid grammar, so the playful benchmark voice is preserved.
 */
const ACTION_INDICATORS = [
  'gimme', 'give', 'put', 'enter', 'tell', 'say', 'trim', 'tick', 'tap',
  'try', 'retry', 'check', 'double-check', 'confirm', 'pick', 'share',
  'add', 'search', 'continue', 'go first',
];

/** Preserve user-authored text exactly as submitted (req 2.3). Identity by design. */
export function preserveUserAuthored(text: string): string {
  return text;
}

/** Number of emoji in a string. */
export function emojiCount(s: string): number {
  const matches = s.match(EMOJI);
  return matches ? matches.length : 0;
}

/** True when there is no emoji, or exactly one positioned at the end (req 2.5). */
export function hasValidEmoji(s: string): boolean {
  const count = emojiCount(s);
  if (count === 0) return true;
  if (count > 1) return false;
  return EMOJI_AT_END.test(s.trimEnd());
}

/**
 * Functional text is UPPERCASE MONO: it contains no lowercase letter (digits,
 * punctuation, `₹`, `·`, `⇄`, and em dashes are allowed) and carries no emoji.
 */
export function isFunctional(s: string): boolean {
  if (emojiCount(s) > 0) return false;
  if (!/[A-Z]/.test(s)) return false; // must contain at least one letter
  return !/[a-z]/.test(s);
}

/**
 * Expressive text is lowercase in voice: it is not shouting (contains at least
 * one lowercase letter), and its first alphabetic character is lowercase, so
 * Title-Case sentence starts like "Oops" are rejected. Embedded uppercase for
 * proper nouns (real hood names) is allowed.
 */
export function isExpressive(s: string): boolean {
  if (!/[a-z]/.test(s)) return false;
  const firstAlpha = s.match(/[A-Za-z]/);
  if (firstAlpha && /[A-Z]/.test(firstAlpha[0])) return false;
  return true;
}

/** True when the string names a next action (req 2.7). */
export function namesAction(s: string): boolean {
  const lower = s.toLowerCase();
  if (lower.includes('?')) return true;
  return ACTION_INDICATORS.some((verb) => lower.includes(verb));
}

/** True when the string carries no apologetic marker (req 2.7). */
export function isNonApologetic(s: string): boolean {
  return !APOLOGETIC.test(s);
}

/** True when the string references at least one real Indian hood name (req 2.8). */
export function containsRealHoodName(s: string): boolean {
  return REAL_HOOD_NAMES.some((hood) => s.includes(hood));
}

/** Simple humour/joke markers disallowed on safety-tone surfaces (req 2.6). */
const HUMOUR_MARKERS = /\b(lol|lmao|bestie|menace|touch grass|mid|vibes)\b/i;

/** True when the string is plain and non-humorous, fit for safety copy (req 2.6). */
export function isPlainTone(s: string): boolean {
  return emojiCount(s) === 0 && !HUMOUR_MARKERS.test(s);
}

// ---------------------------------------------------------------------------
// Validators — return a list of human-readable violations (empty === valid).
// ---------------------------------------------------------------------------

export function validateExpressive(key: string, s: string): string[] {
  const out: string[] = [];
  if (!isExpressive(s)) out.push(`${key}: expressive copy must be lowercase in voice`);
  if (!hasValidEmoji(s)) out.push(`${key}: at most one emoji, positioned at the end`);
  if (!isNonApologetic(s)) out.push(`${key}: apologetic copy is banned (no oops/sorry/something went wrong)`);
  return out;
}

export function validateFunctional(key: string, s: string): string[] {
  const out: string[] = [];
  if (!isFunctional(s)) out.push(`${key}: functional labels must be UPPERCASE MONO with no lowercase letters`);
  if (emojiCount(s) > 0) out.push(`${key}: no emoji in a mono label`);
  return out;
}

export function validateError(key: string, s: string): string[] {
  const out = validateExpressive(key, s);
  if (!namesAction(s)) out.push(`${key}: every error must name a next action`);
  return out;
}

export function validateSafety(key: string, s: string): string[] {
  const out: string[] = [];
  if (!isExpressive(s)) out.push(`${key}: safety copy must be lowercase in voice`);
  if (!isPlainTone(s)) out.push(`${key}: safety copy must be plain and non-humorous`);
  return out;
}

export function validateLocationPlaceholder(key: string, s: string): string[] {
  const out = validateExpressive(key, s);
  if (!containsRealHoodName(s)) out.push(`${key}: location placeholders must use a real hood name`);
  return out;
}
