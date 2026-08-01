/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Copy Module (design §B.5). Every user-facing string lives here as a typed
 * record; no user-facing string is written inline in a component (req 2.1).
 *
 * Categories:
 * - errors     — validation errors (expressive, actionable, never apologetic)
 * - loading    — loading states (expressive, personality)
 * - empty      — empty states (expressive, encouraging)
 * - labels     — functional UPPERCASE MONO labels, statuses, metadata, nav
 * - placeholders — input placeholders (location placeholders use real hood names)
 * - safety     — safety/payment/dispute/verification (plain, warm, non-humorous)
 */
export { errors, type ErrorKey } from './errors';
export { loading, type LoadingKey } from './loading';
export { empty, authGate, hoodClaimedLine, type EmptyKey } from './empty';
export { labels, showingOf, hoodProgress, type LabelKey } from './labels';
export { placeholders, REAL_HOOD_NAMES, type PlaceholderKey } from './placeholders';
export { safety, type SafetyKey } from './safety';
