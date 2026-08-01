/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Validation errors are jokes, per the benchmark voice (design §B.5).
 *
 * Voice constitution (enforced by the voice linter in `@/lib/voice`):
 * - expressive lowercase (rule 1)
 * - no apologetic strings — no "Oops", "Sorry", "Something went wrong" (rule 5, req 2.7)
 * - every error names a next action (req 2.7)
 * - at most one emoji, at the end (rule 4, req 2.5)
 */
export const errors = {
  nameTooShort: 'gimme at least 2 letters bestie',
  phoneBadLen: 'give me 10 digits, no country code',
  emailBad: 'double-check that email, looks mid',
  priceZero: 'put a real number — ₹0 is a favour, not a gig',
  priceWild: 'that is a lot of money — confirm to continue',
  titleEmpty: 'tell us what you actually need doing',
  bodyEmpty: 'a couple more lines helps people say yes',
  dateRequired: 'pick a date — today works',
  pincodeBad: 'enter 6 digits — the one on your courier packages',
  consentUnticked: "tick this to prove you're not a menace 😤",
  oneLinerTooShort: 'say a bit more — at least 10 characters',
  oneLinerTooLong: 'trim it down — 140 characters max',
  genericRetry: 'that did not go through — tap to try again',
  loadFailed: 'the board did not load — tap retry',
  offlineWrite: 'you are offline — we will retry this when you are back',
} as const;

export type ErrorKey = keyof typeof errors;
