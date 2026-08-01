/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Input placeholders (design §B.5). Every placeholder that references a location
 * uses a real Indian hood name (rule 6, req 2.8). Expressive lowercase for the
 * conversational prompts; the compose one-liner example is kept verbatim from
 * the design (§E.3).
 */

/**
 * Real Indian hood names for placeholders and examples (design §B.5 rule 6).
 * The voice linter checks location placeholders against this list.
 */
export const REAL_HOOD_NAMES = [
  'HSR Layout',
  'Indiranagar',
  'Koramangala',
  'Powai',
  'Bandra',
  'Vile Parle W',
  'Hauz Khas',
  'GK-1',
  'Koregaon Park',
  'Aundh',
  'Gachibowli',
  'Whitefield',
  'Salt Lake',
  'Alipore',
  'Sector 17',
  'Electronic City',
  'Vellore',
] as const;

export const placeholders = {
  // Location-referencing placeholders — must use a real hood name (req 2.8)
  areaName: 'e.g. HSR Layout, Sector 2',
  pincode: '560102 — the pincode for Koramangala',
  boardSearch: 'search Indiranagar…',

  // Compose (design §E.2, §E.3)
  gigTitle: 'what do you need doing?',
  gigBody: 'a couple of lines — the more you say, the better the match',
  tags: 'add a tag or two (optional)',
  claimOneLiner: "i've assembled 4 ikeas, i own an allen key set",

  // Chat
  message: 'say something…',
} as const;

export type PlaceholderKey = keyof typeof placeholders;
