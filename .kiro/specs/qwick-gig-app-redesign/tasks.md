# Implementation Plan: Qwick Gig App Redesign

## Overview

Implement the redesign incrementally in TypeScript on the approved React 18 + Vite 5 + Tailwind v4 + Firebase 12 + Express 5 stack. The sequence first restores a secure, buildable baseline, then introduces the Field and hood architecture, the identity-gated Handshake, the server-authoritative rep ledger, trust and direct-payment safety, and finally Night Board, marketplace rhythm, reliability, accessibility, and performance polish. Every implementation task is traced to finalized acceptance criteria, and every correctness property in design §J has a dedicated optional `fast-check` task.

## Tasks

- [x] 1. Phase 0 — unbreak the build, secure data, and clean up authentication
  - [x] 1.1 Establish the TypeScript project and automated-test foundation
    - Add the approved runtime and development dependencies, remove `d3`, `@types/d3`, client `@google/genai`, and `@react-oauth/google`, and add non-watch scripts for type-check, unit, rules, integration, and property tests.
    - Configure the `@/` alias consistently in Vite and TypeScript and retain modular Firebase imports.
    - _Requirements: 28.2, 28.3, 30.1, 30.3, 30.11_

  - [x] 1.2 Move the flattened application into the approved `src/` feature structure
    - Relocate existing components, providers, utilities, copy, and types; repair every import; reduce `App.tsx` to providers, router host, grain, and toast host under 150 lines.
    - Move subscriptions into route-mounted, hood- or participant-scoped feature hooks and replace whole-user lookups with poster snapshots.
    - _Requirements: 30.2, 30.5, 30.6, 30.7, 30.8_

  - [x] 1.3 Split the Express entry point and remove authentication bypasses
    - Extract route, service, and middleware modules; verify Firebase ID tokens on every mutating route.
    - Delete hostname-conditioned authentication, use only the explicit auth-emulator environment flag locally, and make failed legacy migration return invalid credentials without a user-document fallback.
    - _Requirements: 23.8, 23.9, 23.10, 30.9; NFR-3.4, NFR-3.5_

  - [x] 1.4 Replace generated positional CSS with stable named styles
    - Delete every sibling-position selector and obsolete indigo override, retaining `!important` only in the reduced-motion reset.
    - Leave a minimal stylesheet entry ready for the token and ink layers introduced in Phase 1.
    - _Requirements: 30.4, 31.10_

  - [x] 1.5 Deploy the default-deny Firestore and Storage rule baseline
    - Replace world-readable/writeable rules with reusable auth, ownership, immutable-field, participant, and server-only helpers.
    - Protect verification, progression, Handshake, private KYC, report, contact, location, and unknown paths by default while preserving only the minimum currently valid access.
    - _Requirements: 12.15, 15.2, 21.5, 21.6, 21.7, 21.8, 21.9; NFR-3.1, NFR-3.2, NFR-3.3, NFR-3.6_

  - [x] 1.6 Declare every required Firestore composite index
    - Add indexes for hood/state/recency, scrubber hour, visibility windows, geohash, poster flares, doer claims, gig candidates, rep ledger, and released reviews.
    - Keep index deployment ordered before migration execution.
    - _Requirements: 30.10, 31.1_

  - [x] 1.7 Build the versioned migration harness and compatibility layer
    - Add resumable, idempotent migration commands with dry-run/reporting support; enforce rules-and-indexes-first ordering.
    - Rekey users from email to Firebase UID with an email-hash index, support schema-versioned dual reads for renamed gig fields, and retain legacy user documents read-only for one release.
    - _Requirements: 31.1, 31.5, 31.9_

  - [x]* 1.8 Write migration-harness and compatibility tests
    - Verify resume safety, idempotency, rules/index preconditions, UID rekeying, read-only legacy records, and schema-version dual reads against Firebase emulators.
    - _Requirements: 31.1, 31.5, 31.9_

  - [x] 1.9 Add build, type-check, and bundle verification to CI
    - Run production client/server builds and clean type-checks from a fresh install using one-shot commands.
    - Fail on unresolved aliases, missing server modules, or accidental umbrella Firebase imports.
    - _Requirements: 28.2, 30.1, 30.3, 30.9_

  - [x]* 1.10 Write baseline security-rule regression tests
    - Extend the existing security scenarios to prove unauthenticated writes, non-owner gig mutations, private KYC reads, progression writes, Handshake writes, and unspecified paths are denied.
    - _Requirements: 12.15, 15.2, 21.5, 21.8, 21.9; NFR-3.1, NFR-3.2, NFR-3.3_

- [x] 2. Checkpoint — secure, buildable baseline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Phase 1 — design system, router, hoods, Board, and the custom Field
  - [x] 3.1 Implement shared deterministic, formatting, and typed-copy modules
    - Add seeded randomness, Indian-currency and privacy-aware distance formatting, typed copy records for every label/error/loading/empty state, and lintable voice constraints.
    - Preserve user-authored casing while enforcing expressive lowercase, functional uppercase mono, emoji, safety-tone, location-placeholder, and actionable-error rules.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8; 9.7_

  - [x]* 3.2 Write property test P9.3 for deterministic tilt
    - **Property P9.3: Deterministic tilt remains stable and bounded**
    - Generate arbitrary keys and rotation limits and verify identical results across calls/devices with absolute rotation no greater than the configured maximum.
    - **Validates: Requirements 1.4**

  - [x] 3.3 Create the tokenized paper/night design-system styles and self-hosted fonts
    - Implement the single `@theme` token source, ink utilities, focus-visible rules, responsive flat-card variant, safe-area sizing, font subsets/fallback metrics, and official-brand sizing/clear-space rules.
    - Ensure no component contains literal colors, stroke widths, or shadow offsets.
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 1.10, 27.1, 27.2, 27.3, 27.4, 27.5, 27.11, 27.14, 28.4, 28.5, 28.6, 28.7_

  - [x] 3.4 Implement pure ink primitives, deterministic avatars, and state components
    - Create `components/ink` surfaces, pressables, cards, receipt, redaction, rank/status, price, avatar, texture, motion, skeleton, empty, and toast primitives with no Firebase imports.
    - Build the palette-locked deterministic zine avatar and use official artwork rather than re-typesetting the wordmark.
    - _Requirements: 1.2, 1.3, 1.4, 1.8, 1.9, 1.10, 27.4, 27.5, 27.11_

  - [x] 3.5 Replace view-state navigation with the addressable router and app chrome
    - Define every route from design §F.2, background-location modal routes, URL-owned hood/mode/filter/hour/surface state, back-button behavior, mobile five-slot navigation, and desktop two-pane shell.
    - Persist only permitted ephemeral UI state and last Field/Board preference.
    - _Requirements: 3.1, 7.1, 7.3, 7.4, 8.9, 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9_

  - [x] 3.6 Implement the server-authoritative Hood service and hood-scoped data hooks
    - Validate and resolve six-digit pincodes, cache API/fallback/manual results, compute adjacency within 3 km capped at nine, enforce hood launch status, and expose hood statistics.
    - Query gigs by `hoodId` and visibility without whole-collection listeners; write `hoodId` and `geohash7` to the versioned gig schema.
    - _Requirements: 5.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.10; NFR-1.6_

  - [x] 3.7 Build hood claim, switcher, pre-launch, and flag-planting experiences
    - Allow public hood claim and browsing before auth, update URL/history on hood changes, show launch progress and nearby hoods, and gate flare/claim actions when the hood is not live.
    - Preserve intended gated actions through the single-step auth sheet without gating navigation or incomplete onboarding.
    - _Requirements: 8.9, 8.10, 9.4, 9.5, 23.1, 23.2, 23.3, 23.6, 23.7_

  - [x] 3.8 Implement the pure geo-to-Field projection module
    - Implement linear and square-root radial transforms, inverse projection, haversine distance, bearing, center mapping, and boundary clamping with no I/O.
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 30.11; NFR-5.5_

  - [x]* 3.9 Write property test P4.1 for projection round trips
    - **Property P4.1: Projection round-trip stays within tolerance**
    - **Validates: Requirements 3.7**

  - [x]* 3.10 Write property test P4.2 for projection bounds
    - **Property P4.2: Every projected point remains inside the unit disc**
    - **Validates: Requirements 3.5**

  - [x]* 3.11 Write property test P4.3 for anchor centering
    - **Property P4.3: The anchor maps exactly to Field center**
    - **Validates: Requirements 3.7**

  - [x]* 3.12 Write property test P4.4 for radial ordering
    - **Property P4.4: Both warps preserve strict distance ordering**
    - **Validates: Requirements 3.6**

  - [x]* 3.13 Write property test P4.5 for bearing preservation
    - **Property P4.5: Projection preserves bearing within 0.5 degrees**
    - **Validates: Requirements 3.8**

  - [x]* 3.14 Write property test P4.6 for out-of-range clamping
    - **Property P4.6: Beyond-radius points clamp to the boundary and never disappear**
    - **Validates: Requirements 3.5**

  - [x] 3.15 Implement the spatial hash, rAF scheduler, and multimodal Scan hook
    - Cache projected positions/bounds, coalesce pointer and touch events, update spotlight CSS properties outside React, enforce tap thresholds, and provide deterministic nearest-node lookup.
    - Add geographic keyboard traversal, drawer focus restoration, escape behavior, and debounced spatial announcements.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 4.9, 4.10, 4.11; NFR-1.5_

  - [x]* 3.16 Write property test P5.1 for Scan determinism
    - **Property P5.1: Identical nearest-signal inputs always return the same index**
    - **Validates: Requirements 4.10**

  - [x]* 3.17 Write property test P5.2 against exhaustive search
    - **Property P5.2: Spatial-hash nearest lookup agrees with brute force**
    - **Validates: Requirements 4.11**

  - [x]* 3.18 Write property test P5.3 for search-radius safety
    - **Property P5.3: Scan never returns a point outside the search radius**
    - **Validates: Requirements 4.11**

  - [x]* 3.19 Write property test P5.4 for stable tie-breaking
    - **Property P5.4: Equidistant ties resolve to the lowest index**
    - **Validates: Requirements 4.10**

  - [x]* 3.20 Write property test P5.5 for frame throttling
    - **Property P5.5: Any event burst causes at most one active change per animation frame**
    - **Validates: Requirements 4.7**

  - [-] 3.21 Build the live Field surface from real hood data
    - Render fuzzed real-gig positions, 250/500/1000/2000 m rings, centroid/live-location anchor modes, radar/spotlight layers, live clock, counts, values, centroid, claim counts, and lazy precision-map boundaries.
    - Ensure the Field route loads no Google Maps JavaScript and never reads private exact coordinates.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9, 3.10, 4.6, 4.9, 5.7, 9.9, 20.9, 28.8, 28.9; NFR-1.1, NFR-1.4_

  - [-] 3.22 Implement Field clustering, collision control, and the 60-node budget
    - Cluster 48 px cells, provide Board-row cluster sheets, rank overflow deterministically, preserve access to excluded gigs, and apply at most three ring-preserving repulsion iterations.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [~] 3.23 Add complete Field touch, keyboard, and screen-reader presentation
    - Add the peek bar above the thumb zone, semantic nearest-first link list, accessible signal names, key instructions, list escape, decorative-motion hiding, 44 px targets, and standard document semantics on the Board.
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 7.1, 27.6, 27.7, 27.8, 27.9, 27.10; NFR-2.2, NFR-2.3, NFR-2.5_

  - [-] 3.24 Implement honest zero-supply and sparse-board derivation
    - Derive hollow deterministic `WAITING` ghosts only at zero real open gigs; exclude them from all real metrics/actions; show exact sparse counts/value, separate waitlist indicators, team markers, nearby-hood actions, and eligible first-flare bonus copy.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11_

  - [ ]* 3.25 Write property test P9.4 for ghost/supply separation
    - **Property P9.4: Ghosts exist only at zero real supply and never affect real nodes or metrics**
    - **Validates: Requirements 9.1, 9.2, 9.8, 9.9, 9.10**

  - [-] 3.26 Build the first-class Board, mode toggle, filters, sorting, and search
    - Implement recency/price/distance/rank sorting, full-text hood search without categories, filter URL state, one-action Field/Board switching, and mobile flat cards.
    - _Requirements: 1.5, 7.1, 7.2, 7.3, 7.4, 7.5, 25.1, 25.8_

  - [ ]* 3.27 Write Field, hood, clustering, and Board integration tests
    - Verify hood-scoped subscriptions, no whole-collection listeners, real/fuzzed data rendering, node budgets, cluster reachability, mode persistence, public browsing, and absence of Maps JS on the Field route.
    - _Requirements: 3.2, 3.10, 5.1, 5.3, 5.4, 5.6, 7.3, 7.4, 8.6, 23.1_

  - [ ]* 3.28 Write responsive router and app-shell tests
    - Verify deep links, browser-back modal closure, safe-area bottom navigation, two-pane desktop behavior, route restoration, and no component-state route ownership at 360/768/1280 widths.
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.7, 25.9_

  - [ ]* 3.29 Write automated Phase 1 accessibility tests
    - Run axe and keyboard suites for contrast-token usage, focus visibility, target size, semantic Board markup, Field semantic links, spatial names, and escape behavior.
    - _Requirements: 1.8, 4.4, 4.5, 4.6, 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.10, 27.11_

  - [ ]* 3.30 Write Phase 1 visual-regression tests
    - Capture paper Field, Board, zero/sparse hoods, cluster sheet, hood claim, and official-brand usage at 360/768/1280 widths.
    - _Requirements: 1.1, 1.2, 1.5, 1.10, 9.1, 9.9, 25.9_

- [~] 4. Checkpoint — Field and hood marketplace foundation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 2 — identity gate, eligibility-preserving claim flow, and exactly one AGREED Handshake
  - [~] 5.1 Build the three-beat flare composer and authoritative creation endpoint
    - Implement what/value/where-and-when beats, live keyboard-aware signal preview, hood price guidance, freeform tags, date/time defaults, urgency expiry, rank-photo gating, broadcast reach, and exact/private versus fuzzed/public write boundaries.
    - Add idempotent create-request semantics and leave offline queue transport to Phase 5.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11; 18.4, 18.5, 18.9, 18.10_

  - [~] 5.2 Implement immediate identity-verification access and preserved-action orchestration
    - Make verification available to every new rank-01 account, display pending redaction, and preserve full claim intent across authentication and verification.
    - Resume only after rechecking gig state, minimum rank, and active-claim allowance; retain failed intents without creating claim artifacts.
    - _Requirements: 11.10, 11.11, 11.12, 11.13, 17.12, 23.2, 23.3, 23.4, 23.5_

  - [ ]* 5.3 Write property test P2.8 for the identity claim gate
    - **Property P2.8: Unverified claims preserve intent while verified rank-01 users receive exactly one active-claim allowance**
    - **Validates: Requirements 11.11, 11.13, 17.7, 23.1, 23.4**

  - [ ]* 5.4 Write property test P2.9 for preserved-claim rechecks
    - **Property P2.9: Preserved claims resume only when every eligibility gate still passes**
    - **Validates: Requirements 11.12**

  - [~] 5.5 Implement idempotent atomic claim creation
    - Validate identity, one-liner length, ₹25 pricing, availability, counter-offer status, rank floor, and active-claim limit.
    - Atomically create deterministic Handshake and thread IDs, pinned Handshake card, first human message, and one claim-count increment; make retries return existing artifacts unchanged.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.10, 11.11, 11.12, 11.13_

  - [~] 5.6 Build claim ritual and poster candidate-comparison surfaces
    - Create the human one-liner, offer stepper, availability controls, candidate rank/rep/line/offer/distance rows, claim-count signal treatment, and correction path for failed preserved intents.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.8, 11.9, 11.10, 11.12_

  - [~] 5.7 Implement the pure Handshake reducer and offer model
    - Encode legal actions, participant checks, price bounds, append-only contiguous offers, self/stale-offer rejection, absorbing states, mirrored agreed terms, and two-attestation settlement using injected time and no I/O.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.10, 12.11, 12.12, 12.13, 12.14, 30.11_

  - [ ]* 5.8 Write property test P2.1 for illegal Handshake actions
    - **Property P2.1: Illegal actions are rejected without mutation**
    - **Validates: Requirements 12.2**

  - [ ]* 5.9 Write property test P2.2 for terminal states
    - **Property P2.2: Terminal Handshake states are absorbing**
    - **Validates: Requirements 12.3**

  - [ ]* 5.10 Write property test P2.3 for self-accept rejection
    - **Property P2.3: A party can never accept its own latest offer**
    - **Validates: Requirements 12.4**

  - [ ]* 5.11 Write property test P2.4 for stale-offer rejection
    - **Property P2.4: Non-latest offers can never be accepted**
    - **Validates: Requirements 12.5**

  - [ ]* 5.12 Write property test P2.6 for append-only offer history
    - **Property P2.6: Offer sequences remain contiguous, append-only, and singly accepted**
    - **Validates: Requirements 12.7, 12.10**

  - [ ]* 5.13 Write property test P2.7 for settlement attestations
    - **Property P2.7: Settlement requires both attestations or moderator resolution**
    - **Validates: Requirements 12.11**

  - [~] 5.14 Implement server-authoritative Handshake transitions and single-winner acceptance
    - Wrap reducer effects in authenticated endpoints; compare-and-set `agreedHandshakeId`, set the gig to MATCHED, and decline all other live candidates atomically.
    - Add expiry processing, duplicate-attestation rejection, moderator-only resolution, and client-write-denying rules.
    - _Requirements: 12.8, 12.9, 12.11, 12.12, 12.14, 12.15; NFR-5.1_

  - [ ]* 5.15 Write property test P2.5 for concurrent accepts
    - **Property P2.5: Every concurrent accept interleaving leaves exactly one AGREED Handshake**
    - Drive scheduled request races against the Firebase emulator and verify the winning gig pointer and `GIG_TAKEN` losers.
    - **Validates: Requirements 12.9**

  - [~] 5.16 Build the Handshake/thread UI and migrate legacy claims
    - Pin the current offer card and collapsed offer history in each thread, expose legal counter/accept/decline actions, and provide addressable Handshake detail.
    - Convert `interestedUsers[]` to deterministic Handshakes, replay embedded proposals in sequence, and preserve the previously selected worker as the agreed pointer.
    - _Requirements: 12.16, 25.2, 31.6, 31.7_

  - [ ]* 5.17 Write claim and Handshake endpoint integration tests
    - Verify atomic rollback, retry idempotency, first-message uniqueness, claim-count correctness, state expiry, rules denial, legal UI actions, and legacy migration results.
    - _Requirements: 11.6, 11.7, 11.11, 11.12, 12.8, 12.14, 12.15, 12.16, 31.6, 31.7_

- [~] 6. Checkpoint — identity-gated claim and Handshake core
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 3 — append-only rep ledger, ranks, caps, pending grants, and unlocks
  - [~] 7.1 Define immutable rep, rank, unlock, review-freeze, and visibility contracts
    - Centralize event weights, rank thresholds/gates, demotion hysteresis, claim limits, unlock inheritance, pending/application event shapes, and recalibratable constants in shared pure TypeScript modules.
    - _Requirements: 15.3, 15.7, 15.8, 15.9, 15.12, 17.1, 17.2, 17.5, 17.7, 17.11, 17.12, 30.11_

  - [~] 7.2 Implement server-only grant, idempotency, ledger recompute, and rank evaluation
    - Validate settled-participant eligibility, micro-gig/self/phone-hash exclusions, pairwise diminishing returns, first-flare uniqueness, penalties, version increments, stored results, and auditable rank-change events/notifications.
    - Keep current rep equal to countable grant/application deltas floored at zero and heat independent from rank.
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 15.12, 16.1, 16.3, 16.4, 16.9, 17.1, 17.2, 17.5, 17.6, 17.11_

  - [~] 7.3 Implement pending grants, rolling caps, review freezes, and FIFO release applications
    - Persist every withheld grant immutably, exclude pending deltas forever, append one application event per release, release in original order within 200/day and 700/week capacity, and retain excess unchanged.
    - Thaw after one overdue review without changing any normal app capability.
    - _Requirements: 16.6, 19.7, 19.8, 19.9, 19.10; NFR-5.2_

  - [~] 7.4 Implement rank-derived access, visibility, and hood rank-gate caps
    - Derive cumulative unlocks, rank-floor redaction, 10-minute high-value head starts, query/rules enforcement, monotone visibility, 25% poster-gate cap, and explicit public-publish confirmation without mutating composer state.
    - _Requirements: 17.3, 17.4, 17.7, 17.8, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10_

  - [~] 7.5 Build rep ledger, rank track, redacted rewards, and reveal surfaces
    - Render owner-visible grant/application receipts, primary rep/rank identity, locked teaser labels, head-start countdowns, and reduced-motion-safe rank-04/rank-05 reveal takeovers.
    - _Requirements: 15.11, 17.9, 17.10, 18.2, 18.3, 24.5, 25.2_

  - [~] 7.6 Implement honest ratings, identity cards, Day Zero Pass, handles, and profiles
    - Create users with null/zero ratings, calculate NEW/EARLY/shrunk displays, issue verified-channel Day Zero matches with zero rep, render founder/non-founder identity cards, and assign unique URL-safe handles.
    - _Requirements: 15.9, 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9_

  - [~] 7.7 Extend migrations for ratings, rep replay, and progression state
    - Recompute ratings from reviews, replay settled gigs/reviews through the live rep engine, initialize versions/ranks/gates without special-case deltas, and make reruns idempotent.
    - _Requirements: 31.2, 31.8_

  - [ ]* 7.8 Write property test P1.1 for non-penalty monotonicity
    - **Property P1.1: Non-penalty events never decrease rep**
    - **Validates: Requirements 15.6**

  - [ ]* 7.9 Write property test P1.2 for ledger equality
    - **Property P1.2: Stored rep equals only countable ledger deltas**
    - **Validates: Requirements 15.3, 15.11**

  - [ ]* 7.10 Write property test P1.3 for grant idempotency
    - **Property P1.3: Replaying a grant key changes neither rep nor event count**
    - **Validates: Requirements 15.4**

  - [ ]* 7.11 Write property test P1.4 for progression non-forgeability
    - **Property P1.4: Client writes cannot change rep, rank, or verification**
    - **Validates: Requirements 15.2**

  - [ ]* 7.12 Write property test P1.5 for collusion resistance
    - **Property P1.5: Repeated pair settlements earn less than distinct-counterparty settlements**
    - **Validates: Requirements 16.2**

  - [ ]* 7.13 Write property test P1.6 for the zero floor
    - **Property P1.6: Any penalty sequence leaves rep non-negative**
    - **Validates: Requirements 15.11**

  - [ ]* 7.14 Write property test P1.7 for honest rating display
    - **Property P1.7: Zero reviews never show a fabricated number and all shown ratings stay in range**
    - **Validates: Requirements 24.2, 24.4**

  - [ ]* 7.15 Write property test P1.8 for immutable pending release
    - **Property P1.8: Every withheld grant remains immutable and releases at most once**
    - **Validates: Requirements 15.3, 15.4, 15.11, 16.6, 19.8, 19.9**

  - [ ]* 7.16 Write property test P1.9 for FIFO cap release
    - **Property P1.9: Thaw releases an original-order prefix within caps and retains all excess**
    - **Validates: Requirements 16.6, 19.9**

  - [ ]* 7.17 Write property test P1.10 for freeze capability neutrality
    - **Property P1.10: A rep freeze changes no route, chat, account, flare, claim, or live-gig eligibility**
    - **Validates: Requirements 19.10**

  - [ ]* 7.18 Write property test P6.1 for rank monotonicity
    - **Property P6.1: Higher rep never produces a lower rank when other gates match**
    - **Validates: Requirements 17.3**

  - [ ]* 7.19 Write property test P6.2 for rank gates
    - **Property P6.2: Evaluation never bypasses a rank's non-rep gates**
    - **Validates: Requirements 17.4**

  - [ ]* 7.20 Write property test P6.3 for cumulative unlocks
    - **Property P6.3: Higher ranks retain every lower-rank capability**
    - **Validates: Requirements 17.8**

  - [ ]* 7.21 Write property test P6.4 for temporal visibility
    - **Property P6.4: Open-gig visibility can only expand over time**
    - **Validates: Requirements 18.7**

  - [ ]* 7.22 Write property test P6.5 for the rank-03 head start
    - **Property P6.5: Rank 03+ sees a high-value gig before rank 01 at the opening instant**
    - **Validates: Requirements 18.8**

  - [ ]* 7.23 Write property test P6.6 for demotion hysteresis
    - **Property P6.6: Drops smaller than 75 rep cannot oscillate an otherwise eligible rank**
    - **Validates: Requirements 17.5**

  - [ ]* 7.24 Write property test P6.7 for rank-gate-cap rejection
    - **Property P6.7: Cap breach rejects only gating and never mutates, queues, or publishes the flare**
    - **Validates: Requirements 18.5, 18.9, 18.10**

- [~] 8. Checkpoint — auditable progression and real unlocks
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Phase 4 — trust, privacy, moderation, reviews, and direct-payment safety
  - [~] 9.1 Implement server-side location fuzzing and migrate exact coordinates
    - Generate keyed, area-uniform deterministic displacement with auditable seed versions and density-adjusted minimum radius; publish only fuzzed geo/geohash/area and move exact coordinates into private subdocuments.
    - Reverse-geocode/map existing gigs to hoods or quarantine unknowns, deleting public exact coordinates.
    - _Requirements: 10.11, 20.1, 20.2, 20.3, 20.4, 20.5, 20.7, 20.8, 31.3, 31.4; NFR-4.1_

  - [~] 9.2 Enforce private contact/location/payment access and state-aware reveal
    - Permit private reads only to the poster and agreed doer, reveal phone at AGREED and exact location only in allowed states, remove all public PII/payment fields, and round displayed distance no finer than privacy permits.
    - _Requirements: 13.8, 14.2, 14.3, 20.6, 21.1, 21.2, 21.3, 21.4; NFR-4.2, NFR-4.3, NFR-4.4_

  - [ ]* 9.3 Write property test P3.1 for public-document privacy
    - **Property P3.1: Public gigs never contain phone, email, exact coordinates, or payment address**
    - **Validates: Requirements 21.4**

  - [ ]* 9.4 Write property test P3.2 for fuzz bounds
    - **Property P3.2: Every displacement remains within the configured non-zero annulus**
    - **Validates: Requirements 20.2**

  - [ ]* 9.5 Write property test P3.3 for deterministic fuzzing
    - **Property P3.3: Repeated fuzzing cannot be averaged toward the exact point**
    - **Validates: Requirements 20.3**

  - [ ]* 9.6 Write property test P3.4 for exact-location state gating
    - **Property P3.4: The doer gains exact location only in AGREED-or-later allowed states**
    - **Validates: Requirements 21.3**

  - [ ]* 9.7 Write property test P3.5 for non-participant denial
    - **Property P3.5: Strangers can never read private contact or location in any state**
    - **Validates: Requirements 21.2**

  - [ ]* 9.8 Write property test P3.6 for display granularity
    - **Property P3.6: Displayed distance is never more precise than 50 metres**
    - **Validates: Requirements 20.6**

  - [~] 9.9 Implement double-blind reviews and the non-blocking Loop Flow
    - Enforce deterministic one-review IDs, delayed mutual/7-day release, rating/tag/optional-line input, reward windows, one 72-hour reminder, profile relocation, closed-loop streak display, and overdue freeze/thaw integration.
    - Never force navigation or restrict chat because of reviews.
    - _Requirements: 16.7, 16.8, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 19.12_

  - [~] 9.10 Implement reporting, blocking, disputes, and moderation consequences
    - Add report actions on all required targets, server-readable moderation queues, bidirectional content exclusion, hard-block flare screening, dispute cases, moderator-only resolution, upheld-report penalties, and community-guidelines consent.
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.8, 22.9_

  - [~] 9.11 Build live-gig coordination and first-pair safety experiences
    - Add the global live strip/countdown, lazy precision map and directions, phone reveal, ON MY WAY system message, safety/report strip, optional completion photo, and exactly-once public-meetup/share-plan interstitial.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [~] 9.12 Build the receipt and client-only UPI handoff
    - Render equal poster/doer totals and exact ₹0 platform take from agreed terms; construct an OS UPI intent addressed only to the doer; support cash, share sheet, clipboard fallback, and plain no-escrow copy.
    - Add no payment gateway, merchant order, callback, wallet, escrow, payout, or reconciliation route.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.9, 13.10; NFR-5.4_

  - [~] 9.13 Implement payment attestations and mismatch disputes
    - Store attestations as immutable Handshake records that alter no balance-like field, reveal payment address only to eligible counterparties, and open a dispute when the parties disagree.
    - _Requirements: 13.6, 13.7, 13.8_

  - [~] 9.14 Implement Hood Council moderation access
    - Grant rank-05 users scoped queue voting while retaining server/moderator control over final outcomes and penalties.
    - _Requirements: 17.7, 22.7_

  - [~] 9.15 Harden identity-document lifecycle and write rate limits
    - Store identity material only in private KYC, deny all client reads, delete source documents after approval while retaining approved metadata/last-four hash, and enforce 10 flare/20 claim/5 report daily limits server-side.
    - _Requirements: 21.9, 21.10; NFR-3.5, NFR-3.6_

  - [ ]* 9.16 Write trust-boundary integration tests
    - Verify reveal transitions, blocked-content filtering across Field/Board/search, dispute authorization, KYC deletion, rate limits, report secrecy, first-pair nudge uniqueness, and optional proof photos.
    - _Requirements: 14.2, 14.3, 14.6, 14.7, 21.1, 21.2, 21.9, 21.10, 22.2, 22.3, 22.5_

  - [ ]* 9.17 Write property test P8.1 for server payment-route absence
    - **Property P8.1: No server route accepts, holds, forwards, reconciles, or pays out money**
    - **Validates: Requirements 13.5**

  - [ ]* 9.18 Write property test P8.2 for UPI routing
    - **Property P8.2: Every UPI intent is client-side, exact-amount, and addressed only to the doer**
    - **Validates: Requirements 13.3, 13.4**

  - [ ]* 9.19 Write property test P8.3 for receipt equality
    - **Property P8.3: Poster payment equals doer receipt and platform take is always ₹0**
    - **Validates: Requirements 13.2**

  - [ ]* 9.20 Write property test P8.4 for attestation neutrality
    - **Property P8.4: Recording payment changes no balance-like field anywhere**
    - **Validates: Requirements 13.6**

  - [ ]* 9.21 Write direct-payment and live-runner integration tests
    - Verify agreed-term receipt mirroring, absent platform payment APIs, OS handoff generation, payment-address access, cash/UPI attestations, mismatch disputes, and live-route coordination.
    - _Requirements: 13.1, 13.3, 13.4, 13.7, 13.8, 14.1, 14.4, 14.5_

  - [ ]* 9.22 Write review-loop integration tests
    - Verify double-blind release, deterministic uniqueness, reward windows, exactly one reminder, freeze activation/thaw, pending-release interaction, non-blocking navigation/chat, and optional comments.
    - _Requirements: 16.7, 16.8, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.9, 19.10, 19.11_

  - [ ]* 9.23 Write moderation workflow integration tests
    - Verify report intake secrecy, bidirectional blocks, moderator-only resolve, penalty/upheld-count updates, rank-05 vote scope, and hard-block publication rejection.
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8_

  - [ ]* 9.24 Write privacy migration tests
    - Verify every migrated gig has private exact geo, deterministic fuzz/geohash/hood assignment, no public exact fields, quarantine behavior, and idempotent reruns.
    - _Requirements: 31.3, 31.4_

- [~] 10. Checkpoint — trust, reviews, safety, and direct-payment invariants
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Phase 5 — Night Board, rhythm, notifications, offline behavior, accessibility, performance, and polish
  - [~] 11.1 Implement automatic and manual Night Board surfaces
    - Compute auto mode from hood-centroid sunset through 06:00, persist `auto | paper | night`, honor URL override, remap every semantic token, gold-offset shadows, and reduced grain opacity.
    - _Requirements: 1.6, 1.7_

  - [~] 11.2 Implement reduced-motion orchestration and device texture budgets
    - Ensure animation sequences execute identical ordered effects with timing-only differences; disable grain/radar/marquee/pulses according to motion, data-saver, memory, core, and battery signals; mount grain once and pause off-screen pulses.
    - _Requirements: 27.12, 27.13, 27.14, 28.10, 28.11, 28.12, 28.13; NFR-2.4, NFR-2.6_

  - [ ]* 11.3 Write property test P9.1 for reduced-motion outcomes
    - **Property P9.1: Reduced motion changes timing but not ordered side effects**
    - **Validates: Requirements 27.13**

  - [ ]* 11.4 Write property test P9.2 for texture-budget safety
    - **Property P9.2: Reduced motion never permits radar, marquee, or node pulse**
    - **Validates: Requirements 28.11**

  - [~] 11.5 Implement pure day-rhythm aggregation
    - Produce real 8–23 history/live buckets, exclude flexible starts, normalize heat, identify real peak hour, and suppress charts below the 20-gig threshold.
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 30.11_

  - [~] 11.6 Build the URL-driven day-rhythm scrubber and no-result jump
    - Render all 16 hours with mood labels, historical/live totals, thin-history state, and one-tap jump to the hood's real peak hour.
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.8, 25.1_

  - [ ]* 11.7 Write property test P10.1 for bucket shape
    - **Property P10.1: Aggregation always returns exactly 16 ascending buckets for hours 8–23**
    - **Validates: Requirements 6.4**

  - [ ]* 11.8 Write property test P10.2 for flexible-start exclusion
    - **Property P10.2: Flexible gigs are never invented into an hour bucket**
    - **Validates: Requirements 6.5**

  - [ ]* 11.9 Write property test P10.3 for normalized heat
    - **Property P10.3: Heat remains in [0,1] with a non-empty peak exactly equal to 1**
    - **Validates: Requirements 6.7**

  - [ ]* 11.10 Write property test P10.4 for thin-history honesty
    - **Property P10.4: Fewer than 20 historical gigs can never render a chart**
    - **Validates: Requirements 6.6**

  - [~] 11.11 Implement deterministic notifications, batching, cadence, and hood-launch emission
    - Generate deterministic IDs, batch claims for five minutes, collapse pushes to one per 15 minutes/category, honor quiet hours, constrain email kinds, deep-link real routes, collapse losing-candidate notices, and notify each waitlist member once when a hood goes live.
    - _Requirements: 8.11, 17.6, 19.6, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8_

  - [~] 11.12 Build alerts, rank/Handshake notification UX, and deep-link handling
    - Render batched in-app alerts with typed copy, route-safe links, rank reveal entry points, and correct agreement delivery to both parties.
    - _Requirements: 17.6, 25.2, 26.3, 26.7, 26.8_

  - [ ]* 11.13 Write property test P7.1 for notification idempotency
    - **Property P7.1: Repeated logical emissions produce exactly one notification**
    - **Validates: Requirements 26.2**

  - [ ]* 11.14 Write property test P7.2 for deterministic notification IDs
    - **Property P7.2: IDs always equal `{kind}_{subjectId}_{uid}` and contain no random part**
    - **Validates: Requirements 26.1**

  - [ ]* 11.15 Write property test P7.3 for push cadence
    - **Property P7.3: A user receives no more than one push per 15 minutes**
    - **Validates: Requirements 26.4**

  - [ ]* 11.16 Write property test P7.4 for quiet hours
    - **Property P7.4: Quiet hours suppress everything except active-Handshake messages**
    - **Validates: Requirements 26.5**

  - [~] 11.17 Finish progression capabilities and marketplace polish
    - Build hood leaderboard placement, custom markers, weekly Signal Boost, Trust Vouch stake/return/forfeit flows, Hood Council/gold-chip presentation, photo unlock enforcement, saved scans, and profile highlight reel.
    - _Requirements: 17.7, 17.8, 17.9, 17.10, 22.7_

  - [~] 11.18 Implement offline drafts, queued idempotent flare publication, and degraded states
    - Persist compose drafts and exactly one queued create request, cache the last Field snapshot read-only, show staleness/offline banners, retryable coded errors, halftone loading nodes, and all-caught-up copy.
    - _Requirements: 10.12, 29.1, 29.2, 29.3, 29.4_

  - [~] 11.19 Complete automated accessibility behavior across all flows
    - Pair status/rank with text, verify redaction labels, preserve keyboard and screen-reader parity, enforce 44 px targets/focus/contrast, keep blink below 3 Hz, and confirm reduced-motion final states on Field, compose, Handshake, receipt, review, rank reveal, and moderation.
    - _Requirements: 1.8, 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9, 27.10, 27.11, 27.12, 27.13, 27.14; NFR-2.1, NFR-2.2, NFR-2.3, NFR-2.4, NFR-2.5, NFR-2.6_

  - [~] 11.20 Enforce production performance and payload budgets
    - Route-split Maps/motion/handwriting, enforce Field JavaScript/font budgets, remove unused code, retain zero layout reads in scan frames, measure 60-node pointer-to-paint and mount time, and add Lighthouse limits for LCP/INP/CLS.
    - _Requirements: 3.10, 4.8, 5.7, 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8, 28.9, 28.10, 28.12, 28.13, 28.14; NFR-1.1, NFR-1.2, NFR-1.3, NFR-1.4, NFR-1.5, NFR-1.6_

  - [ ]* 11.21 Write final automated end-to-end, visual, accessibility, offline, and performance suites
    - Exercise public hood browse through flare, identity-gated claim, concurrent Handshake acceptance, live coordination, direct receipt, reviews, rep/rank unlocks, moderation, notifications, offline replay, and browser-back/deep-link flows.
    - Capture paper/night and reduced-motion visuals at 360/768/1280; run axe and enforce all bundle, font, frame, mount, LCP, INP, and CLS budgets with one-shot commands.
    - _Requirements: 1.6, 1.7, 10.12, 12.9, 13.2, 19.10, 25.2, 27.12, 28.1, 28.4, 28.8, 28.9, 28.14, 29.1, 29.2, 29.3, 29.4, 30.1; NFR-1, NFR-2, NFR-3, NFR-4, NFR-5_

- [~] 12. Final checkpoint — complete implementation plan validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional automated-test tasks and may be skipped for a faster MVP; all unstarred implementation tasks remain required.
- Each design correctness property from §J is represented by exactly one dedicated property-based test task using `fast-check`.
- To preserve dependency-wave parallelism, each property task creates its own `P<n>.<n>` test file and consumes shared arbitraries/helpers established by the preceding implementation tasks; tasks in the same wave must not edit a shared test file.
- Property tests complement unit, rules, integration, visual, accessibility, and performance tests; they do not replace example and edge-case coverage.
- Every task uses TypeScript and the finalized stack; implementation agents should consult `requirements.md` and `design.md` for contracts rather than duplicating architecture decisions here.
- Checkpoints are validation pauses only; they introduce no deployment, manual acceptance, documentation, or other non-coding work.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "1.7"] },
    { "id": 3, "tasks": ["1.8", "1.9", "1.10"] },
    { "id": 4, "tasks": ["3.1", "3.3", "3.5", "3.6"] },
    { "id": 5, "tasks": ["3.2", "3.4", "3.7", "3.8", "3.15"] },
    { "id": 6, "tasks": ["3.9", "3.10", "3.11", "3.12", "3.13", "3.14", "3.16", "3.17", "3.18", "3.19", "3.20"] },
    { "id": 7, "tasks": ["3.21", "3.22", "3.24", "3.26"] },
    { "id": 8, "tasks": ["3.23", "3.25", "3.27", "3.28", "3.29"] },
    { "id": 9, "tasks": ["3.30"] },
    { "id": 10, "tasks": ["5.1", "5.2", "5.7"] },
    { "id": 11, "tasks": ["5.3", "5.4", "5.5", "5.8", "5.9", "5.10", "5.11", "5.12", "5.13"] },
    { "id": 12, "tasks": ["5.6", "5.14"] },
    { "id": 13, "tasks": ["5.15", "5.16"] },
    { "id": 14, "tasks": ["5.17"] },
    { "id": 15, "tasks": ["7.1"] },
    { "id": 16, "tasks": ["7.2", "7.4", "7.6"] },
    { "id": 17, "tasks": ["7.3", "7.5", "7.7"] },
    { "id": 18, "tasks": ["7.8", "7.9", "7.10", "7.11", "7.12", "7.13", "7.14", "7.15", "7.16", "7.17", "7.18", "7.19", "7.20", "7.21", "7.22", "7.23", "7.24"] },
    { "id": 19, "tasks": ["9.1", "9.9", "9.10", "9.12", "9.14", "9.15"] },
    { "id": 20, "tasks": ["9.2", "9.11", "9.13"] },
    { "id": 21, "tasks": ["9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.16", "9.17", "9.18", "9.19", "9.20", "9.21", "9.22", "9.23", "9.24"] },
    { "id": 22, "tasks": ["11.1", "11.2", "11.5", "11.11", "11.17", "11.18"] },
    { "id": 23, "tasks": ["11.3", "11.4", "11.6", "11.12", "11.19", "11.20"] },
    { "id": 24, "tasks": ["11.7", "11.8", "11.9", "11.10", "11.13", "11.14", "11.15", "11.16"] },
    { "id": 25, "tasks": ["11.21"] }
  ]
}
```
