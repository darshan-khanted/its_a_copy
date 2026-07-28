# Requirements Document

## Introduction

Qwick Gig is a hyperlocal, zero-commission, peer-to-peer task board for Indian Gen-Z. Its landing page sells a live neighbourhood with a scoreboard; the shipped app delivers a generic indigo SaaS job board built around a classifieds form. The gap is structural, not cosmetic: browse is a city-string comparison rather than a distance, rep does not exist (a `4.8★ / 5 reviews` default is fabricated for every new account), and the ₹0-fee promise never appears in the product at all.

This redesign turns the landing page's three claims into the three mechanics the app runs on:

- **The Field** — proximity is the browse interface, partitioned by pincode.
- **Rep** — a server-authoritative ledger that gates real capability.
- **The Handshake** — two humans agree, money moves directly between them, the platform is never in the path.

It also repairs three defects that block everything else: the repository as pushed cannot build, `index.css` binds styling to DOM sibling positions, and the deployed security rules are `allow read, write: if true`.

Requirements below are derived from the approved design document (`design.md`, sections A–K) and are traceable to it. Section references in each requirement point at the design decision the requirement exists to protect. Where the design leaves a decision open, it is recorded in *Assumptions and Open Questions* rather than silently resolved here.

## Glossary

**Product vocabulary**

- **the Field**: The proximity browse surface at `/hood/:pincode` — a custom SVG/DOM radar showing a hood's live gigs projected from real coordinates onto a disc of a given radius. The default authenticated route. Deliberately not a Google Maps basemap (design §C.1).
- **signal**: A gig, as rendered on the Field.
- **flare**: The act of posting a gig — broadcasting a signal.
- **hood**: A pincode-scoped area. Simultaneously the data partition key (`hoodId = pincode`), the social unit, and the launch switch.
- **the Board**: The list view of a hood, at `/hood/:pincode/board`. A first-class alternative to the Field, not a fallback.
- **handshake**: The negotiated agreement artefact between a poster and one doer, holding an append-only offer history, a state machine, and the agreed terms.
- **rep**: The progression currency. A server-written integer equal to the sum of a user's rep ledger events.
- **rank**: One of five named tiers derived from rep plus non-rep gates: TAPPED_IN (01), HUSTLER (02), NEIGHBOURHOOD LEGEND (03), MAX CHARISMA (04), MYTH (05).
- **unlock**: A capability granted by reaching a rank (active-claim limit, head start, photo attachment, Signal Boost, Trust Vouch, Hood Council).
- **head start**: The rank-03+ privilege of seeing signals priced at or above ₹500 for 10 minutes before the rest of the hood.
- **attestation**: A party's on-record statement that something happened — work done, or money settled. A record, never a transaction.
- **fuzzing**: Deterministic displacement of a gig's exact coordinates before they are published, seeded once per gig and never re-rolled.
- **ghost signal**: A hollow, dashed node on the Field representing a waitlist member in a pre-launch hood. Carries `price: 0` and the title `WAITING`, so it cannot be mistaken for a real gig.
- **Day Zero Pass**: The founder identity card carried forward from the landing-page waitlist into the app, bearing a position number, a founder marker, and live rank/rep.
- **Night Board**: The dark surface set (`data-surface="night"`) derived from the Day Zero Pass palette, for the 17:00–23:00 liquidity peak.

**System names used in acceptance criteria**

- **THE App Shell**: Router, providers, layout chrome, and global state ownership.
- **THE Field Surface**: The Field route and its rendering, interaction, and clustering layers.
- **THE Projection Module**: The pure geo↔field-space transform (design §H.1).
- **THE Scan Module**: The proximity nearest-signal detector and its rAF scheduler (design §H.2).
- **THE Hood Service**: Pincode resolution, caching, adjacency, launch status, and hood statistics.
- **THE Compose Flow**: The three-beat flare composer and its publish path.
- **THE Claim Flow**: The claim ritual sheet and candidate comparison surfaces.
- **THE Handshake Engine**: The pure state-machine reducer plus its server-authoritative transition endpoints.
- **THE Receipt Surface**: The money-moment screen, UPI intent builder, and payment attestation UI.
- **THE Rep Engine**: The server-only rep grant, ledger, and rank evaluation service.
- **THE Loop Flow**: The post-settlement review experience.
- **THE Safety Service**: Fuzzing, contact/location reveal gating, reporting, blocking, and disputes.
- **THE Identity Surface**: Identity card, Day Zero Pass, public profile, verification badge.
- **THE Notification Service**: Notification creation, batching, cadence control, and deep links.
- **THE Copy Module**: The typed `src/copy/*` records holding every user-facing string.
- **THE Design System**: The token set, ink utilities, and `components/ink/` primitives.
- **THE Security Rules**: The deployed Firestore and Storage rules.
- **THE Build Configuration**: Vite, TypeScript, and directory structure.
- **THE Migration Suite**: The one-off scripts that move existing data to schema version 2.

---

## Requirements

### Requirement 1: Design system and visual identity

**User Story:** As a user arriving from the zine-styled landing page, I want the app to look and feel like the same product, so that the brand promise is credible from the first screen.

#### Acceptance Criteria

1. THE Design System SHALL define all colour, type, stroke, shadow, radius, spacing, motion, and z-index values as `@theme` tokens in a single token file, with no colour, stroke width, or shadow offset literal appearing in component code (§B.1).
2. THE Design System SHALL expose the ink surface language as reusable primitives — `.ink-box` at 2.5 px border and `6px 6px 0` shadow, `.ink-box-sm` at 2 px and `4px 4px 0`, `.ink-box-lg` at 3 px and `10px 10px 0` (§B.2).
3. WHEN a user presses any interactive control THEN THE Design System SHALL apply the `.ink-press` transform grammar — hover `translate(2px,2px)` with shadow reduced to 3 px, active `translate(5px,5px)` with shadow reduced to 1 px, over 80 ms — so that no interactive state is signalled by colour change alone (§B.2, §I.2).
4. WHEN a card renders with a tilt THEN THE Design System SHALL derive the rotation deterministically from the card's identifier within ±2.2 degrees, and the rotation SHALL be identical on every render and every device for the same identifier (§B.2, §H.8).
5. WHERE a list context is rendered below 480 px viewport width, THE Design System SHALL render cards in the `flat` variant — ink border with no hard shadow and tilt disabled (§K.2).
6. THE Design System SHALL provide a `data-surface="night"` variant that remaps every semantic surface, text, line, and accent token, with hard shadows rendered as a 1 px gold-tinted border at 6 px offset and grain opacity reduced from 0.16 to 0.09 (§B.3).
7. WHEN the surface mode is `auto` THEN THE App Shell SHALL select the Night Board from local sunset — computed from the hood centroid latitude — until 06:00, and SHALL honour a manual `auto | paper | night` override persisted in `localStorage` and expressible as a `?surface=` URL parameter (§B.3).
8. THE Design System SHALL render every interactive target at a minimum of 44 × 44 px, including clustered Field nodes (§B.1, §I.7).
9. THE Design System SHALL replace the eight-gradient initial-avatar generator with a palette-locked zine avatar — a flat fill drawn from lime, magenta, cobalt, cyan, or peach, an ink border, a halftone corner, and initials — selected deterministically from the user identifier (§B.4).
10. THE Design System SHALL use the official brand artwork from `brand/` at its stated minimum sizes — mark at or above 20 px, horizontal lockup at or above 90 px wide — with clear space of at least the ring radius, and SHALL NOT re-typeset the wordmark (§K.8).

### Requirement 2: Voice and copy

**User Story:** As a user, I want the app to talk like the landing page rather than like enterprise software, so that the product has one personality.

#### Acceptance Criteria

1. THE Copy Module SHALL hold every user-facing string as a typed record under `src/copy/`, and no user-facing string SHALL be written inline in a component (§B.5).
2. THE Copy Module SHALL provide in-voice strings for every validation error, loading state, and empty state, so that no error, loading, or empty surface ships with default or absent copy (§B.5, §E.9).
3. THE Copy Module SHALL render expressive text — headlines, empty states, errors, user-authored titles — in lowercase, and functional text — labels, statuses, metadata, navigation — in uppercase mono with 0.14 em tracking (§B.5, §K.2).
4. WHEN a monetary amount is displayed THEN the App Shell SHALL prefix it with `₹` and format it with `toLocaleString('en-IN')` so that one hundred thousand renders as `1,00,000` (§B.5).
5. THE Copy Module SHALL contain at most one emoji per string, positioned at the end of the string, and SHALL contain no emoji in any uppercase mono label (§B.5).
6. THE Copy Module SHALL express safety, payment, dispute, and verification copy in plain, warm, non-humorous language, and SHALL restrict humour to validation, empty, loading, and marketing surfaces (§K.2).
7. THE Copy Module SHALL contain no apologetic error strings — specifically no "Oops", "Sorry", or "Something went wrong" — and every error string SHALL name a next action (§B.5, §E.9).
8. WHERE a placeholder references a location, THE Copy Module SHALL use a real Indian hood name (§B.5).

### Requirement 3: The Field as the primary browse surface

**User Story:** As a doer, I want to see what work is near me right now on a spatial surface, so that "your next ₹400 is 312 metres away" is something I can act on rather than a slogan.

#### Acceptance Criteria

1. THE App Shell SHALL resolve `/hood/:pincode` to the Field and SHALL make it the default landing surface for an authenticated user (§C, §F.2).
2. THE Field Surface SHALL render signals from each gig's stored coordinates via the Projection Module, and SHALL NOT position signals from hardcoded or hash-generated values (§C, §H.1).
3. THE Field Surface SHALL represent a disc of radius 2000 m by default, centred on the hood centroid, and SHALL render distance rings at 250 m, 500 m, 1000 m, and 2000 m with mono labels (§C.2, §C.3).
4. THE Field Surface SHALL anchor on the hood centroid without requesting any location permission, and WHERE the user opts in to precise location THE Field Surface SHALL re-anchor to the live point and mark the surface as `PRECISION: ON` (§C.2).
5. WHEN a point lies beyond the Field radius THEN THE Projection Module SHALL clamp it to the disc boundary and SHALL NOT drop it (§H.1).
6. FOR ALL pairs of points within the radius, IF one is closer to the anchor than the other THEN THE Projection Module SHALL place it at a strictly smaller radial distance in field space, under both the linear and the square-root warp (§C.2, §H.1, §J.4).
7. FOR ALL points within the radius, THE Projection Module SHALL satisfy `haversine(p, unproject(project(p))) <= max(1 m, radius × 1e-6)` and SHALL map the anchor exactly to the field centre (§H.1, §J.4).
8. THE Projection Module SHALL preserve bearing exactly under both warps, within 0.5 degrees of the geodesic bearing (§H.1, §J.4).
9. THE Field Surface SHALL display a live chrome line carrying a blinking status dot, the hood name, a ticking clock, the count of signals in range, the total rupee value on the board, and the hood centroid to four decimal places (§C.3).
10. THE Field Surface SHALL NOT load the Google Maps JavaScript API, and THE App Shell SHALL load it only on the flare address-picking route and the live-gig route (§C.1, §I.6).

### Requirement 4: Field interaction across every input modality

**User Story:** As a user on a phone — or on a keyboard, or with a screen reader — I want the proximity mechanic to work with the input I actually have, so that the best idea in the product is not desktop-only.

#### Acceptance Criteria

1. WHEN a pointer moves over the Field THEN THE Scan Module SHALL move the spotlight to the pointer position and SHALL mark the nearest signal within 88 px as active (§C.4).
2. WHEN a finger is pressed and dragged on the Field THEN THE Scan Module SHALL track the spotlight to the finger and SHALL preview the nearest signal in a peek bar rendered above the 168 px thumb zone, never beneath the finger (§C.4, §I.7).
3. IF a touch is released within 200 ms and with less than 8 px of movement THEN THE Field Surface SHALL open the signal drawer for the previewed signal (§C.4).
4. WHEN the Field has keyboard focus THEN THE Field Surface SHALL traverse signals by geography — right for the next signal clockwise by bearing, up for the next signal closer to the anchor, down for the next signal further away — and SHALL open the focused signal on Enter (§C.4).
5. WHEN Escape is pressed within the Field THEN THE Field Surface SHALL close any open drawer and return focus to the previously focused signal, and SHALL release arrow-key capture (§C.4, §I.3).
6. THE Field Surface SHALL expose a `SWITCH TO LIST` control as the first focusable element inside the Field region (§I.3).
7. THE Scan Module SHALL perform at most one nearest-signal search and at most one active-signal change per animation frame regardless of input event rate (§H.2, §J.5).
8. THE Scan Module SHALL read no layout geometry inside its per-frame work, SHALL cache signal positions at projection time, and SHALL refresh cached bounds only on resize or scroll (§C.6, §H.2).
9. THE Scan Module SHALL write the spotlight position as CSS custom properties directly on the Field element without triggering a React render (§G.3, §H.2).
10. FOR ALL identical inputs, THE Scan Module SHALL return the same nearest-signal index, breaking ties by lowest index (§H.2, §J.5).
11. THE Scan Module SHALL never return a signal whose distance from the query point exceeds the search radius, and SHALL agree with an exhaustive search over the same points (§H.2, §J.5).

### Requirement 5: Field density — clustering and node budget

**User Story:** As a doer in a busy hood at peak hour, I want the Field to stay readable and smooth, so that a live board does not become an unusable smear of overlapping pins.

#### Acceptance Criteria

1. THE Field Surface SHALL render at most 60 signal DOM nodes at any time (§C.5).
2. WHEN a field-space grid cell of 48 px contains two or more signals THEN THE Field Surface SHALL render one cluster node showing the signal count and the summed rupee value (§C.5).
3. WHEN a cluster node is activated THEN THE Field Surface SHALL open a cluster sheet listing the contained signals as Board rows, and SHALL NOT zoom the Field (§C.5).
4. IF the number of visible signals exceeds the node budget THEN THE Field Surface SHALL rank signals by recency, price, proximity, and urgency, SHALL keep every excluded signal reachable through a cluster sheet or the Board, and SHALL state the truncation as `SHOWING 60 OF N · OPEN BOARD FOR ALL` (§C.5).
5. THE Field Surface SHALL separate overlapping nodes by at most three repulsion iterations to a minimum separation of 22 px, and SHALL NOT move any node across a distance ring (§C.5).
6. THE Field Surface SHALL subscribe only to the current hood and, where enabled, its adjacent hoods, and THE App Shell SHALL contain no whole-collection listener on `gigs` or `users` (§C.6, §G.3).
7. THE Field Surface SHALL re-derive the projection transform only when the anchor, the radius, or the viewport size changes (§C.6).

### Requirement 6: The day-rhythm scrubber

**User Story:** As a new user, I want to learn when my hood is actually busy, so that I know whether to come back at 18:00 instead of concluding the app is dead.

#### Acceptance Criteria

1. THE Field Surface SHALL render an hour scrubber covering hours 8 through 23 with the hood's mood label for the selected hour (§C.9, §H.7).
2. WHEN the scrubber is set to an hour at or before the current hour THEN THE Field Surface SHALL show real gigs from the last 7 days in that hood bucketed by hour, reporting signal count and total value (§C.9).
3. WHEN the scrubber is set to an hour after the current hour THEN THE Field Surface SHALL filter the live board to gigs whose start time falls in that hour (§C.9).
4. THE Field Surface SHALL return exactly 16 buckets in ascending hour order for hours 8 through 23 (§H.7, §J.10).
5. THE Field Surface SHALL exclude gigs with a flexible start time from all hour buckets, so that the sum of bucket counts never exceeds the number of gigs with a concrete start hour (§H.7, §J.10).
6. IF a hood has fewer than 20 gigs in the trailing 7 days THEN THE Field Surface SHALL render the mood label and the line `NOT ENOUGH HISTORY YET · CHECK BACK`, and SHALL NOT render a histogram (§C.9, §J.10).
7. THE Field Surface SHALL normalise the hourly heat values to the range 0 to 1 with the peak hour equal to exactly 1 (§H.7, §J.10).
8. WHEN a filter or scrubber setting yields no signals THEN THE Field Surface SHALL state the hood's real peak hour and offer a one-tap jump to it (§E.9).

### Requirement 7: The Board and the Field⇄Board toggle

**User Story:** As a user who prefers scanning a list — or who needs a standard document to navigate — I want a first-class list view of my hood, so that the spatial surface is a choice and not a requirement.

#### Acceptance Criteria

1. THE App Shell SHALL resolve `/hood/:pincode/board` to the Board as a standard document-structured page with no `role="application"` region (§C.8, §I.3).
2. THE Board SHALL support sorting by recency, price, distance, and required rank, and SHALL support a filter sheet (§C.8).
3. THE Field Surface SHALL present a `FIELD ⇄ BOARD` control that switches mode in one action, and THE App Shell SHALL reflect the selected mode in the URL (§C.8).
4. THE App Shell SHALL persist the user's last selected mode and restore it on return (§C.8).
5. THE Board SHALL provide full-text search over the hood's signals, and THE Board SHALL NOT present a category taxonomy (§E.2, §K.2).

### Requirement 8: Hoods replace the city string

**User Story:** As an operator launching a new area, I want the pincode to be the actual data partition and launch switch, so that "we're opening pincode by pincode" is the literal shape of the system.

#### Acceptance Criteria

1. THE Hood Service SHALL accept a 6-digit pincode matching `^[1-9][0-9]{5}$` and SHALL reject any other input with the in-voice pincode error (§C.7).
2. WHEN a pincode has not been resolved before THEN THE Hood Service SHALL resolve it server-side against the postal pincode API, select a usable post-office name, and cache the result in `hoods/{pincode}` (§C.7, §G.7).
3. WHEN a pincode has already been cached THEN THE Hood Service SHALL serve the cached hood without calling the external API (§C.7).
4. IF the external resolution fails and the pincode is present in the static fallback table THEN THE Hood Service SHALL serve the fallback entry and record the source as `fallback` (§C.7).
5. IF the external resolution fails and no fallback exists THEN THE Hood Service SHALL present `NOT FOUND — YOU CAN STILL TYPE YOUR AREA` and allow the user to continue with a manually entered area name (§C.7).
6. THE App Shell SHALL store `hoodId` equal to the pincode on every gig and SHALL query the board by `hoodId`, and SHALL NOT filter browse results by a city name comparison (§C.7, §G.4).
7. THE Hood Service SHALL compute each hood's adjacency list from centroid distances of at most 3 km, capped at 9 entries (§C.7).
8. THE App Shell SHALL store a 7-character geohash on every gig as a secondary radius index (§C.7, §G.4).
9. WHEN the user changes hood THEN THE App Shell SHALL change the URL path so that the hood is shareable, deep-linkable, and reachable by the browser back button (§C.7, §F.1).
10. WHERE `hoods/{pincode}.status` is not `live`, THE App Shell SHALL withhold flaring and claiming in that hood and SHALL present the pre-launch hood experience (§C.7, §K.1).
11. WHEN an operator sets a hood's status to `live` THEN THE Notification Service SHALL notify that hood's waitlist members exactly once (§E.8, §K.1).

### Requirement 9: Cold start — the ghost town that never fabricates supply

**User Story:** As a brand-new user in a hood with no gigs, I want an honest and encouraging first impression, so that I understand the board is early rather than broken — and I am never shown work that does not exist.

#### Acceptance Criteria

1. WHEN a hood has no open signals THEN THE Field Surface SHALL render ghost signals derived from that hood's real waitlist count as hollow dashed nodes labelled `WAITING` (§E.9, §K.4).
2. THE Field Surface SHALL generate every ghost signal with `price: 0` and the title `WAITING`, so that a ghost signal is structurally distinguishable from a gig (§H.8, §K.4).
3. THE Field Surface SHALL NOT generate, hash, or otherwise synthesise any signal that represents a gig (§C.9, §K.4).
4. WHEN a hood is below its launch threshold THEN THE Field Surface SHALL display the hood progress meter in the form `N / M NEIGHBOURS · OPENS AT M` and a share action to recruit more members (§E.9, §K.4).
5. THE Field Surface SHALL offer a `BE FIRST` action in the empty state that states the first-flare rep bonus, and a `LOOK AT NEARBY HOODS` action that widens to the adjacency list with results labelled as further away (§E.9, §K.4).
6. WHERE a gig was posted by the operating team, THE App Shell SHALL mark it with a `QG TEAM` marker rather than presenting it as an ordinary user's gig (§K.4).
7. WHEN ghost signals are placed THEN THE Field Surface SHALL place them deterministically from the hood identifier so that positions do not move between renders (§H.8).

### Requirement 10: Flaring a gig

**User Story:** As a poster, I want posting to feel like broadcasting to my neighbourhood with visible reach, so that I know something happened instead of filing a 13-field form and hoping.

#### Acceptance Criteria

1. THE Compose Flow SHALL collect a flare in three beats — what is needed, what it is worth, where and when — presenting one primary question per beat (§E.2).
2. WHILE the composer is open, THE Compose Flow SHALL render a live signal-card preview of the flare as it will appear on the Field, updating as the user types (§E.2).
3. WHILE the on-screen keyboard is open, THE Compose Flow SHALL keep the live preview visible using visual-viewport resize information (§I.7).
4. WHEN the price beat is reached THEN THE Compose Flow SHALL show the hood's real price guidance as a 25th-to-75th-percentile range with a tap-to-fill median chip, derived from that hood's stored price statistics (§E.2).
5. THE Compose Flow SHALL accept optional freeform tags and SHALL NOT present a category selector, and THE App Shell SHALL NOT store a category field on a gig (§E.2, §G.4).
6. WHERE a server-side classifier is applied to flare text, THE App Shell SHALL use its output only for ranking, analytics, and safety screening, and SHALL NOT surface it to users as a taxonomy (§E.2, §K.2).
7. WHEN a flare is published THEN THE Compose Flow SHALL play the broadcast — the composed card landing as a signal node with radiating rings — and SHALL state the reach using the hood's real 30-day active member count (§E.2).
8. THE Compose Flow SHALL prefill hood from the claimed hood, offer `TODAY / TOMORROW / THIS WEEK` date chips, and default the start time to the next mood window from the hood's rhythm data (§E.2).
9. WHEN a poster marks a flare urgent THEN THE App Shell SHALL render the signal with the urgent treatment and SHALL expire the gig 6 hours after publication (§E.2).
10. WHERE the poster's rank does not include the photo-attachment unlock, THE Compose Flow SHALL withhold photo attachment (§D.5).
11. WHEN a flare is published THEN THE App Shell SHALL write exact coordinates only to the gig's private location subdocument and SHALL publish only the fuzzed coordinates, the geohash, the hood identifier, and a human area label (§E.7, §H.3).
12. IF the user is offline while composing THEN THE Compose Flow SHALL persist the draft and queue the flare for publication when connectivity returns (§E.9).

### Requirement 11: Claiming — the claim ritual

**User Story:** As a poster comparing three candidates, I want to read what each person actually said and what they actually want to be paid, so that I can choose a human instead of deleting three identical robot paragraphs.

#### Acceptance Criteria

1. THE Claim Flow SHALL NOT generate, prefill, or send any templated opening message on a user's behalf (§E.3).
2. THE Claim Flow SHALL require a human one-liner of at least 10 and at most 140 characters before a claim can be submitted (§E.3).
3. THE Claim Flow SHALL prefill the offer price with the asking price and SHALL adjust it in ₹25 increments (§E.3).
4. WHEN the submitted price differs from the asking price THEN THE Claim Flow SHALL record the claim as a counter-offer, without a separate negotiate mode (§E.3).
5. THE Claim Flow SHALL collect the doer's availability response for the requested time (§E.3).
6. WHEN a claim is submitted THEN THE Handshake Engine SHALL create a handshake keyed `{gigId}_{doerUid}` and THE App Shell SHALL create the chat thread with the handshake card as its first item and the doer's own one-liner as the first human message (§E.3, §G.4).
7. WHEN the same doer submits a claim on the same gig again THEN THE Handshake Engine SHALL return the existing handshake rather than creating a second one (§E.4, §G.7).
8. THE Claim Flow SHALL present the poster's candidate list showing each candidate's rank chip, rep, one-liner, offered price, and distance (§E.3).
9. THE Field Surface SHALL display the claim count on a signal node (§E.3).
10. IF the number of the doer's active claims has reached the limit granted by their rank THEN THE Claim Flow SHALL refuse the claim and state the limit and the rank that raises it (§D.5).
11. IF the doer is not identity-verified THEN THE Claim Flow SHALL refuse the claim and route the user to verification (§E.7).

### Requirement 12: The Handshake state machine

**User Story:** As either party to an agreement, I want exactly one binding record of what we agreed and who moved last, so that there is never a question of whose price won or whether the gig is already taken.

#### Acceptance Criteria

1. THE Handshake Engine SHALL implement transitions as a pure reducer over `(handshake, action, now)` with no I/O and no ambient clock, so that identical inputs always produce identical results (§H.6, §J.2).
2. IF an action is not listed as legal for the handshake's current state THEN THE Handshake Engine SHALL reject it with `ILLEGAL_STATE` and SHALL leave the handshake unchanged (§H.6, §J.2).
3. THE Handshake Engine SHALL treat SETTLED, DECLINED, WITHDRAWN, EXPIRED, and CANCELLED as absorbing states from which no action succeeds (§H.6, §J.2).
4. IF the party attempting to accept or counter authored the latest offer THEN THE Handshake Engine SHALL reject the action (§E.4, §H.6, §J.2).
5. IF an accept references a sequence number other than the latest offer's THEN THE Handshake Engine SHALL reject it with `STALE_OFFER` (§E.4, §H.6, §J.2).
6. IF the actor is neither the poster nor the doer of the handshake THEN THE Handshake Engine SHALL reject the action with `NOT_PARTICIPANT` (§H.6).
7. THE Handshake Engine SHALL append offers with contiguous sequence numbers starting at 0, SHALL never mutate or delete a prior offer beyond marking it superseded, accepted, or declined, and SHALL hold at most one offer with status `accepted` (§H.6, §J.2).
8. WHEN a handshake reaches AGREED THEN THE Handshake Engine SHALL, in a single transaction, set the gig's agreed handshake identifier by compare-and-set from empty, move the gig to MATCHED, and decline every other live handshake on that gig (§E.4, §H.6).
9. FOR ALL sets of concurrent accepts on one gig, THE Handshake Engine SHALL leave exactly one handshake in AGREED and SHALL reject the others with `GIG_TAKEN` (§E.4, §J.2).
10. WHEN a handshake reaches AGREED THEN THE Handshake Engine SHALL record the agreed price, date, start time, end time, and the accepted offer's sequence number as an exact mirror of that offer (§E.4, §H.6).
11. THE Handshake Engine SHALL transition to SETTLED only when both parties have recorded a completion attestation, or when a moderator resolves a dispute in favour of settlement (§E.4, §J.2).
12. IF a party attempts a second completion attestation THEN THE Handshake Engine SHALL reject it with `ALREADY_ATTESTED` (§H.6).
13. THE Handshake Engine SHALL reject any offer price at or below ₹0 or above ₹1,00,000 with `PRICE_OUT_OF_RANGE` (§H.6).
14. THE Handshake Engine SHALL expire a NEGOTIATING handshake after 48 hours of inactivity or when the gig's start time passes (§E.4, §G.7).
15. THE Security Rules SHALL deny all client writes to `handshakes/{id}`, so that every transition passes through the server transition endpoints (§G.6).
16. THE App Shell SHALL pin the handshake card to the top of the thread showing the current offer, who moved last, and the delta from the asking price, and SHALL render superseded offers as a collapsed history strip (§E.4).

### Requirement 13: The money moment

**User Story:** As a poster paying a doer, I want a receipt that proves the platform took nothing and never touched the money, so that the central brand claim becomes something I have actually seen.

#### Acceptance Criteria

1. WHEN a handshake reaches SETTLED THEN THE Receipt Surface SHALL render a receipt generated from the agreed price showing what the poster pays, what the doer receives, and the platform's take (§E.5).
2. THE Receipt Surface SHALL show the platform's take as exactly ₹0 and SHALL show the poster's payment and the doer's receipt as equal to the agreed price (§E.5, §J.8).
3. WHEN the user chooses UPI payment THEN THE Receipt Surface SHALL construct a `upi://pay` intent addressed to the doer's payment address with the agreed amount and hand it to the operating system (§E.5).
4. THE Receipt Surface SHALL NOT address a UPI intent to any platform-controlled payment address, SHALL NOT generate a merchant order identifier, and SHALL NOT register a payment callback (§E.5, §J.8).
5. THE App Shell SHALL contain no server route that accepts, holds, forwards, or reconciles a payment amount, and no payment-gateway, escrow, wallet, or payout integration (§E.5, §G.1, §J.8).
6. WHEN a party records a payment attestation THEN THE Receipt Surface SHALL store it as a record against the handshake and SHALL change no balance-like field anywhere in the system (§E.5, §J.8).
7. IF the two parties' payment attestations disagree THEN THE Handshake Engine SHALL open a dispute rather than resolving the mismatch silently (§E.5).
8. THE App Shell SHALL reveal the doer's payment address only to the counterparty of a handshake in AGREED or later (§E.5, §G.5).
9. THE Receipt Surface SHALL offer to share the receipt through the platform share sheet with a clipboard fallback (§E.5).
10. THE App Shell SHALL state the absence of escrow plainly in the FAQ and in the receipt footer, and SHALL NOT imply platform-backed recourse for non-payment (§E.5, §K.1).

### Requirement 14: Running a live gig

**User Story:** As a doer standing outside a stranger's building, I want the address, the phone number, and a way to say I have arrived, so that the coordination happens in the app instead of collapsing into confusion.

#### Acceptance Criteria

1. WHILE a handshake is in LIVE, THE App Shell SHALL pin a live strip to every screen showing the gig title, the agreed price, and a countdown (§E.5).
2. WHEN a handshake enters LIVE THEN THE Safety Service SHALL reveal the exact address to both parties, with a precision map and a directions action (§E.5, §E.7).
3. WHEN a handshake reaches AGREED THEN THE Safety Service SHALL reveal each party's phone number to the other from the gig's private contact subdocument (§E.5, §E.7).
4. THE App Shell SHALL provide a one-tap `ON MY WAY` action that posts a system message with an estimated arrival time (§E.5).
5. WHILE a handshake is in LIVE, THE App Shell SHALL display the safety strip advising a first meeting in public with a report action reachable in one tap (§E.5, §E.7).
6. THE App Shell SHALL accept an optional completion photo and SHALL NOT require a photo to record a completion attestation (§E.5).
7. WHEN the first AGREED handshake between two identities is created THEN THE Safety Service SHALL present the public-meetup interstitial with suggested public meeting points near the fuzzed location and a one-tap plan-share action, exactly once for that pair (§E.7).

### Requirement 15: Rep as a server-authoritative ledger

**User Story:** As a user building a reputation, I want my rep to be an auditable record of things that actually happened, so that it means something to me and to the people deciding whether to work with me.

#### Acceptance Criteria

1. THE Rep Engine SHALL be the only writer of rep, rep version, rank, heat, distinct-counterparty count, upheld-report count, and streak fields (§D.2, §G.6).
2. THE Security Rules SHALL deny every client write to those fields and to `repEvents`, and SHALL deny client writes to `verified` and verification status (§D.4, §G.6, §J.1).
3. THE Rep Engine SHALL append an immutable ledger event for every grant, and a user's rep SHALL always equal the sum of that user's non-deferred ledger events, floored at 0 (§D.2, §H.4, §J.1).
4. WHEN a grant request repeats an idempotency key that has already been applied THEN THE Rep Engine SHALL apply no change and SHALL report the same resulting rep as the original grant (§D.2, §H.4, §J.1).
5. THE Rep Engine SHALL increment the rep version strictly monotonically on each applied grant (§D.2, §H.4).
6. FOR ALL non-penalty event kinds, THE Rep Engine SHALL never decrease a user's rep (§D.3, §J.1).
7. THE Rep Engine SHALL grant +40 for completion as doer, +18 for completion as poster, `(rating − 3) × 8` for a received rating, +15 for a review given within 24 hours, +6 for a review given within the 72-hour grace window, up to +10 for response speed, +60 for identity verification, +15 for phone verification, +10 for claiming a hood once ever, +50 for a first flare in a hood, and +25 per streak week (§D.3).
8. THE Rep Engine SHALL apply −150 for an upheld report, −80 for a confirmed no-show, and −20 for an abandoned handshake (§D.3).
9. THE Rep Engine SHALL grant exactly 0 rep for holding a Day Zero Pass (§D.3).
10. THE Rep Engine SHALL grant rep for a handshake-derived event only when that handshake is SETTLED and the recipient is one of its two distinct participants (§H.4).
11. THE Rep Engine SHALL provide a recompute-from-ledger operation whose result equals the stored rep, and THE App Shell SHALL render every ledger event to its owner as an auditable receipt line at `/me/rep` (§D.2, §D.8).
12. THE Rep Engine SHALL maintain heat as a separately decaying 90-day activity score used only for display and activity surfaces, and SHALL NOT use heat to determine rank (§D.3).

### Requirement 16: Rep anti-gaming

**User Story:** As an honest user, I want rep to be hard to farm, so that a rank chip signals real work rather than an afternoon of fake gigs between two friends.

#### Acceptance Criteria

1. WHEN a positive grant involves a counterparty THEN THE Rep Engine SHALL multiply the base delta by `1 / (1 + max(0, n − 2))`, where `n` is the number of prior settlements between the same two identities (§D.4).
2. FOR ALL counts `k` of at least 3, THE Rep Engine SHALL award strictly less rep for `k` settlements with one counterparty than for `k` settlements with `k` distinct counterparties (§D.4, §J.1).
3. THE Rep Engine SHALL refuse rep for a settled handshake whose agreed price is below ₹50 or whose elapsed time from start to settlement is below 8 minutes (§D.4, §H.4).
4. THE Rep Engine SHALL refuse rep where the two parties are the same identity or share a phone hash (§D.4, §H.4).
5. THE App Shell SHALL enforce phone uniqueness through a create-once `phoneIndex/{phoneHash}` document rather than a client-side existence query (§D.4, §G.5).
6. THE Rep Engine SHALL withhold new positive grants beyond 200 rep per rolling day or 700 rep per rolling week, SHALL record the excess as a deferred ledger event, and SHALL apply it in a later window rather than discarding it (§D.4, §H.4).
7. THE App Shell SHALL withhold each party's review from the other until both parties have submitted or 7 days have passed (§D.4, §E.6).
8. THE App Shell SHALL accept at most one review per party per settled handshake, enforced by the deterministic review identifier `{handshakeId}_{reviewerUid}` (§D.4, §G.6).
9. THE Rep Engine SHALL grant the first-flare-in-hood bonus only while that hood's gig count is below 10 and only once per user per hood (§D.3, §H.4).

### Requirement 17: Ranks, unlocks, and the reveal

**User Story:** As an established rank-03+ user, I want my rank to grant visible capability, so that the ladder the landing page advertised is a real reward rather than a badge.

#### Acceptance Criteria

1. THE Rep Engine SHALL define five ranks with rep thresholds of 0, 100, 400, 1200, and 3000 (§D.5).
2. THE Rep Engine SHALL additionally require identity verification for rank 02, at least 8 distinct counterparties for rank 03, at least 20 distinct counterparties for rank 04, and zero upheld reports for rank 05 (§D.5).
3. FOR ALL pairs of rep values with all other gates equal, THE Rep Engine SHALL never assign a lower rank to the higher rep value (§H.5, §J.6).
4. THE Rep Engine SHALL never assign a rank whose non-rep gates are unmet (§H.5, §J.6).
5. WHEN a user's rep falls THEN THE Rep Engine SHALL demote only once rep drops below the current rank's threshold by more than 75 (§D.7, §H.5, §J.6).
6. WHEN a user's rank changes THEN THE Rep Engine SHALL append a ledger event and THE Notification Service SHALL notify the user, so that no rank change is silent (§D.7).
7. THE Rep Engine SHALL grant active-claim limits of 1, 3, 5, 5, and 5 by rank, the photo-attachment unlock from rank 02, the 10-minute head start and leaderboard placement and custom marker colour from rank 03, Signal Boost and Trust Vouch at rank 04, and Hood Council and the gold chip at rank 05 (§D.5).
8. FOR ALL rank pairs, THE Rep Engine SHALL grant the higher rank at least every capability granted to the lower rank (§H.5, §J.6).
9. WHILE a rank is unreached, THE Identity Surface SHALL render its reward as redacted with its teaser line (§D.5).
10. WHEN a user crosses into rank 04 or rank 05 THEN THE Identity Surface SHALL play the reveal takeover that lifts the redaction, decodes the reward names, and stamps the new rank chip (§D.5).
11. THE Rep Engine SHALL never revoke a rank for inactivity (§D.3, §D.7).

### Requirement 18: Rep gates real access to signals

**User Story:** As a rank-03+ user, I want a genuine head start on high-value gigs, so that "some gigs only unlock at higher rep" is true; and as a new user, I want the board to still be mostly open to me.

#### Acceptance Criteria

1. WHEN a gig is created with a price of ₹500 or more THEN THE App Shell SHALL set its visibility so that rank 03 and above may see it immediately and everyone else 10 minutes later (§D.6).
2. WHEN a rank-03-or-above user views a gig inside its head-start window THEN THE Field Surface SHALL mark the signal with an early label and a countdown (§D.6).
3. WHERE a poster sets a minimum rank on a flare, THE Field Surface SHALL render that signal as redacted to users below the floor, stating the rank that unlocks it (§D.6).
4. THE Compose Flow SHALL cap a poster-set minimum rank at rank 03 (§D.6).
5. THE App Shell SHALL cap rank-gated gigs at 25% of a hood's open board (§D.6).
6. THE App Shell SHALL enforce rank-based visibility in both the query filter and the security rules, so that a gated gig's full document is unreadable to an ineligible user (§D.6).
7. FOR ALL open gigs, viewers, and times, IF a signal is visible to a viewer at one time THEN it SHALL remain visible to that viewer at every later time while the gig stays open (§H.5, §J.6).
8. WHEN a rank-03-or-above user and a rank-01 user are compared at the head-start opening instant THEN THE App Shell SHALL show the signal to the former and withhold it from the latter (§D.6, §J.6).

### Requirement 19: Closing the loop without holding the account hostage

**User Story:** As a doer who has not yet rated last week's gig, I want to open my inbox and message the person whose door I am standing outside, so that a review prompt never locks me out of a working app.

#### Acceptance Criteria

1. THE App Shell SHALL NOT restrict navigation to any route on the basis of an unsubmitted review (§E.6).
2. THE App Shell SHALL NOT restrict access to any chat thread on the basis of an unsubmitted review (§E.6).
3. THE App Shell SHALL NOT force-navigate a user to a review surface (§E.6).
4. WHEN a handshake settles THEN THE Loop Flow SHALL present a dismissible review card at the top of the feed stating the reward for reviewing within 24 hours (§E.6).
5. WHILE a review remains unsubmitted between 24 and 72 hours after settlement, THE Loop Flow SHALL keep the card available at the reduced reward (§E.6).
6. WHEN 72 hours have passed without a review THEN THE Notification Service SHALL send exactly one reminder and THE Loop Flow SHALL move the card to the user's profile (§E.6).
7. IF more than 7 days have passed and the user has 3 or more unreviewed settled handshakes THEN THE Rep Engine SHALL stop accruing new rep for that user until one review is submitted, and THE App Shell SHALL state the freeze and its remedy (§E.6).
8. THE Rep Engine SHALL treat rep freeze as the only consequence of unclosed loops (§E.6).
9. THE Loop Flow SHALL accept a review as a rating, an optional tag from the fixed set, and an optional line, and SHALL NOT require a written comment (§E.6).
10. THE Identity Surface SHALL display the user's closed-loop streak (§E.6).

### Requirement 20: Location privacy

**User Story:** As a poster asking for help moving a sofa, I want my home address kept out of public data, so that publishing a gig does not publish where I live.

#### Acceptance Criteria

1. THE App Shell SHALL publish only fuzzed coordinates on a public gig document, and SHALL store exact coordinates in the gig's private location subdocument (§E.7, §G.4).
2. FOR ALL gigs, THE Safety Service SHALL displace the published coordinates from the exact coordinates by a distance within [120 m, 250 m], never by zero (§H.3, §J.3).
3. FOR ALL repeated computations with the same gig identifier and seed version, THE Safety Service SHALL produce identical fuzzed coordinates, so that averaging repeated reads cannot recover the exact point (§H.3, §J.3).
4. THE Safety Service SHALL compute fuzzing server-side from a keyed secret of at least 32 characters, and SHALL NOT expose that secret to the client (§H.3).
5. THE Safety Service SHALL sample the fuzz displacement uniformly by area over the annulus and uniformly in bearing (§H.3).
6. WHEN a distance is displayed THEN THE App Shell SHALL round it to a granularity of at least 50 m — nearest 50 m below 500 m, nearest 100 m from 500 m to 999 m, one decimal kilometre at or above 1 km — so that the displayed number is never more precise than the fuzz (§H.3, §J.3).
7. THE App Shell SHALL record a fuzz seed version on each gig so that an intentional re-fuzz is auditable (§G.4).
8. WHERE a hood's 30-day active membership is low, THE Safety Service SHALL increase the minimum fuzz radius (§K.1).
9. THE Field Surface SHALL render no street basemap, so that a fuzzed node cannot be resolved against recognisable streets (§C.1, §E.7).

### Requirement 21: Contact and data access control

**User Story:** As any user, I want private data reachable only by the people who need it at the moment they need it, so that being signed in does not mean being able to read everyone's phone number.

#### Acceptance Criteria

1. THE Security Rules SHALL permit reads of a gig's private contact and private location subdocuments only by the poster and by the doer of that gig's agreed handshake (§E.7, §G.6).
2. FOR ALL non-participants and all handshake states, THE Security Rules SHALL deny reads of a gig's private contact and private location subdocuments (§G.6, §J.3).
3. FOR ALL handshake states, THE Safety Service SHALL permit the doer to read the exact location only in AGREED, LIVE, DONE_PENDING, SETTLED, or DISPUTED (§E.7, §J.3).
4. THE App Shell SHALL publish no phone number, email address, or payment address on any public gig or public user document (§G.4, §J.3).
5. THE Security Rules SHALL permit a gig update or delete only by the gig's poster (§A.4, §G.6).
6. THE Security Rules SHALL restrict a poster's gig updates to title, body, ask price, tags, urgency, start date, start time, expiry, and photo, and only while the gig is OPEN (§G.6).
7. THE Security Rules SHALL deny all client writes to server-owned fields including gig state, agreed handshake identifier, claim count, visibility window, fuzzed coordinates, geohash, and poster snapshot (§G.6).
8. THE Security Rules SHALL default to deny for every path not explicitly allowed, and THE App Shell SHALL ship them as the deployed rules (§G.6).
9. THE App Shell SHALL store an uploaded identity document only under the user's private KYC subdocument with all client reads denied, and after approval SHALL retain only an approval flag, a timestamp, and a last-four hash (§K.1).
10. THE App Shell SHALL enforce rate limits of 10 flares, 20 claims, and 5 reports per user per day (§G.6).

### Requirement 22: Report, block, dispute, and moderation

**User Story:** As a moderator, I want reports and disputes to arrive in a queue with the evidence attached, so that a platform with no escrow still has a working consequence system.

#### Acceptance Criteria

1. THE App Shell SHALL offer a report action on a signal, a profile, a message, and a handshake (§E.7).
2. WHEN a report is submitted THEN THE Safety Service SHALL write it to the moderation queue, and THE Security Rules SHALL deny client reads of reports (§E.7, §G.5).
3. WHEN a user blocks another user THEN THE App Shell SHALL apply the block in both directions and SHALL exclude blocked users' content from the Field, the Board, and search (§E.7).
4. WHEN either party opens a dispute THEN THE Handshake Engine SHALL move the handshake to DISPUTED and open a moderation case (§E.4, §E.7).
5. WHEN a moderator resolves a dispute THEN THE Handshake Engine SHALL move the handshake to SETTLED or CANCELLED according to the outcome, and SHALL accept the resolve action only from a moderator (§H.6).
6. WHEN a report is upheld THEN THE Rep Engine SHALL apply the upheld-report penalty and increment the user's upheld-report count (§D.3, §D.5).
7. WHERE a user holds rank 05, THE App Shell SHALL grant that user a vote in the moderation queue (§D.5, §K.1).
8. THE App Shell SHALL screen flare text server-side against a hard-block list before publication (§K.1).
9. THE App Shell SHALL present the community guidelines under the landing page's existing consent heading (§E.7).

### Requirement 23: First run — value before identity

**User Story:** As a brand-new user arriving from the landing page, I want to see real gigs in my hood before anyone asks me for a government ID, so that I can judge whether the product is worth an account.

#### Acceptance Criteria

1. THE App Shell SHALL allow an unauthenticated user to claim a hood, browse the Field and the Board, and open signal detail (§E.1).
2. THE App Shell SHALL require authentication for claiming a gig, flaring a gig, and chatting (§E.1).
3. WHEN an unauthenticated user triggers an action that requires an account THEN THE App Shell SHALL record the intended action, present a single-step auth sheet, and complete the original action after authentication (§E.1).
4. THE App Shell SHALL NOT require identity-document upload during first run, and SHALL request it at the rank-02 gate framed as an earned badge with its stated rep reward (§E.1).
5. WHILE identity verification is pending, THE Identity Surface SHALL render the verified chip as redacted with an `UNDER REVIEW` status rather than showing nothing (§E.1).
6. WHEN a hood is claimed successfully THEN THE App Shell SHALL play the flag-planting sequence and confirm the claim in voice (§E.1).
7. THE App Shell SHALL NOT gate navigation on incomplete onboarding (§E.1).
8. THE App Shell SHALL authenticate every session through Firebase Auth, and SHALL NOT accept any authentication path conditioned on the request hostname (§E.1, §G.7).
9. WHERE local development requires it, THE Build Configuration SHALL use the Firebase Auth emulator selected by an explicit environment variable (§E.1).
10. IF a legacy-credential migration attempt fails THEN THE App Shell SHALL return an invalid-credentials result and SHALL NOT fall back to accepting the login on the existence of a user document (§E.1).

### Requirement 24: Identity, the Day Zero Pass, and honest ratings

**User Story:** As a waitlist member who claimed a Day Zero Pass, I want it to become my in-app identity; and as any user, I want the ratings I see to be earned rather than manufactured.

#### Acceptance Criteria

1. THE App Shell SHALL create every new user with a null rating and a rating count of 0, and SHALL NOT write any default rating or rating count (§D.1, §G.8).
2. WHEN a user has 0 ratings THEN THE Identity Surface SHALL render a `NEW` rank chip and SHALL NOT render a numeric rating (§D.1, §H.10, §J.1).
3. WHEN a user has 1 or 2 ratings THEN THE Identity Surface SHALL render the raw mean labelled `EARLY` with the rating count (§D.1, §H.10).
4. WHEN a user has 3 or more ratings THEN THE Identity Surface SHALL render a shrunk rating computed from the stated prior, rounded to one decimal, always within 1 to 5 and monotone in the rating sum (§H.10).
5. THE Identity Surface SHALL present rep and rank as the primary trust surface and star ratings as a secondary profile detail (§D.1).
6. WHEN a user first authenticates THEN THE Identity Surface SHALL attempt a Day Zero Pass match against the waitlist and, on a verified match, SHALL store the position and issue hood on the user record (§E.1).
7. WHERE a user holds a Day Zero Pass, THE Identity Surface SHALL render the founder marker and the `ACCESS, NOT REP` line on the identity card (§E.1, §D.3).
8. THE Identity Surface SHALL render the identity card carrying live rank, rep, and settled-gig count for every user, with the founder marker present only for Pass holders and no scarcity messaging for non-holders (§E.1).
9. THE App Shell SHALL assign every user a unique URL-safe handle and SHALL serve a public profile at `/u/:handle` (§G.4, §F.2).

### Requirement 25: Navigation, URLs, and deep links

**User Story:** As a user who was sent a link to a gig — or who pressed the back button — I want the app to behave like the web, so that every surface is addressable and reversible.

#### Acceptance Criteria

1. THE App Shell SHALL use a router with the URL as the single source of truth for route, hood, Field/Board mode, scrubber hour, filters, and surface mode (§F.1).
2. THE App Shell SHALL provide an addressable route for every screen listed in the design's route map, including signal detail, thread, handshake, live gig, receipt, review, rep ledger, and leaderboard (§F.2).
3. WHEN a modal is opened THEN THE App Shell SHALL render it over a background location so that the browser back gesture closes the modal and returns to the underlying screen (§F.1, §F.2).
4. WHEN the browser back gesture is used on any screen other than the entry screen THEN THE App Shell SHALL return to the previously viewed screen and SHALL NOT exit the application (§F.1).
5. THE App Shell SHALL NOT hold the active screen, active thread, or open-modal state in component state as the source of truth (§F.1, §G.3).
6. THE App Shell SHALL merge the former home and feed screens into the single hood surface with two modes, SHALL remove the in-app landing screen, and SHALL split the profile screen into the identity, rep, flares, claims, and verification routes (§F.3).
7. THE App Shell SHALL present a five-slot bottom navigation with the flare action in the centre slot, offset by the device safe-area inset (§F.4).
8. THE App Shell SHALL keep search on the Board rather than in the global header (§F.4).
9. WHERE the viewport is at least 1024 px wide, THE App Shell SHALL present the two-pane layout with a persistent Field and a detail pane (§I.7).

### Requirement 26: Notifications

**User Story:** As a user on a phone, I want notifications that are batched, quiet at night, and land on the right screen, so that the app is informative rather than noisy.

#### Acceptance Criteria

1. THE Notification Service SHALL generate every notification identifier deterministically as `{kind}_{subjectId}_{uid}`, and SHALL NOT include any random component (§E.8, §J.7).
2. FOR ALL repeated emissions of the same logical event, THE Notification Service SHALL produce exactly one notification (§E.8, §J.7).
3. WHEN multiple claims arrive on one flare THEN THE Notification Service SHALL batch them over a 5-minute window into a single in-app notification (§E.8).
4. THE Notification Service SHALL send at most one push notification per user per 15 minutes, collapsing by category (§E.8, §J.7).
5. WHILE the local time is between 23:00 and 07:00, THE Notification Service SHALL suppress all notifications except messages on an active handshake (§E.8, §J.7).
6. THE Notification Service SHALL reserve email for handshake agreement, hood launch, and verification outcome (§E.8).
7. THE Notification Service SHALL attach a deep link to a real route on every notification (§E.8).
8. WHEN a handshake is accepted THEN THE Notification Service SHALL notify both parties, and SHALL NOT fan out an individual message to every losing candidate beyond a single collapsed notification each (§E.8).

### Requirement 27: Accessibility

**User Story:** As a screen-reader or keyboard-only user, I want the radar's information without the radar, so that a spatial interface is not a locked door.

#### Acceptance Criteria

1. THE Design System SHALL render text on the paper surface only in ink, ink-mute, magenta-deep, or cobalt-deep, and SHALL NOT render text in lime, magenta, cobalt, cyan, or peach on paper (§I.1).
2. THE Design System SHALL render text on the night surface only in night-text, night-mute, lime, cyan, gold, or peach (§I.1).
3. THE Design System SHALL render prices in cobalt-deep on paper and lime on night (§I.1).
4. THE Design System SHALL pair every status and rank indicator with a text label, and SHALL NOT convey status by colour alone (§I.1).
5. THE Design System SHALL render a visible focus indicator on `:focus-visible` using a 3 px ink outline on paper and a 3 px lime outline on night, with the magenta hard shadow as decoration only (§I.2).
6. THE Field Surface SHALL render a visually hidden ordered list of every visible signal as real links, ordered nearest first, from the same data as the visual nodes (§I.3).
7. THE Field Surface SHALL give every signal an accessible name stating title, price, distance in the displayed granularity, compass octant, age, poster rank and verification, and claim count (§I.3).
8. WHEN a signal is reached by keyboard traversal THEN THE Field Surface SHALL announce the movement and the newly focused signal in a polite live region, debounced to at most one announcement per 1.5 seconds (§I.3).
9. THE Field Surface SHALL mark pointer-driven previews as hidden from assistive technology, and SHALL mark the radar sweep and node pulses as decorative (§I.3).
10. WHEN the Field region receives focus THEN THE Field Surface SHALL announce its key bindings and the available escape (§I.3).
11. THE Design System SHALL give every redacted element an accessible label stating what is hidden and what unlocks it (§I.1).
12. WHILE reduced motion is preferred, THE Design System SHALL disable the marquee, float, wiggle, spin, blink, radar, node-pulse, and flare animations and SHALL render reveals in their final state (§B.2, §I.3).
13. FOR ALL animation sequences, THE App Shell SHALL execute the same set of side effects in the same order with and without reduced motion, differing only in timing (§H.9, §J.9).
14. THE Design System SHALL keep any blinking indicator below 3 Hz (§I.3).

### Requirement 28: Performance on the target device

**User Story:** As a user on a budget Android on patchy 3G, I want the app to load and the Field to stay smooth, so that the product works on the device this audience actually owns.

#### Acceptance Criteria

1. THE Build Configuration SHALL keep initial gzipped JavaScript for the Field route at or below 190 KB (§I.6).
2. THE Build Configuration SHALL import Firebase modularly and SHALL NOT import the umbrella package (§I.6).
3. THE Build Configuration SHALL remove `d3`, `@types/d3`, the client-side generative-AI SDK, and the redundant Google OAuth library from the dependency set (§I.6, §K.8).
4. THE App Shell SHALL self-host the four font families as subset variable woff2 files, preload the display and body families, and keep the preloaded font payload at or below 64 KB and the total pre-handwriting font payload at or below 88 KB (§I.4).
5. THE App Shell SHALL load the handwriting family lazily on first intersection of an element that uses it, and SHALL degrade gracefully if it never loads (§I.4).
6. THE App Shell SHALL declare metric-adjusted local fallback faces for each family so that font swap does not reflow layout (§I.4).
7. THE App Shell SHALL NOT load fonts through a CSS `@import` in the main stylesheet (§I.4).
8. THE Field Surface SHALL complete pointer-to-paint work within the 16.6 ms frame budget with 60 rendered nodes (§C.6, §I.6).
9. THE Field Surface SHALL mount within 120 ms on a mid-range Android device (§C.6).
10. IF the device reports data saver, 4 GB or less of memory, 4 or fewer logical cores, or battery below 20% and not charging THEN THE Design System SHALL disable the grain layer, the radar sweep, and marquees (§I.5, §H.9).
11. WHILE reduced motion is preferred, THE Design System SHALL disable the radar, marquee, and node pulses regardless of the device texture budget (§H.9, §J.9).
12. THE Design System SHALL mount the grain layer at most once per document as a single fixed pseudo-element, and SHALL NOT mount it per component (§I.5).
13. THE Field Surface SHALL pause node pulse animations for off-screen nodes (§I.5).
14. THE App Shell SHALL meet largest-contentful-paint of 2.0 s or less, interaction-to-next-paint of 200 ms or less, and cumulative layout shift of 0.05 or less on a mid-range Android device over 4G (§I.6).

### Requirement 29: Degraded and transitional states

**User Story:** As a user with a flaky connection, I want the app to tell me what it knows and what it does not, so that I am never staring at a blank screen or stale data I believe is live.

#### Acceptance Criteria

1. WHILE the Field is loading, THE Field Surface SHALL render halftone-shimmer placeholder nodes and a cycling in-voice status line, and SHALL NOT render an undecorated grey placeholder (§E.9).
2. IF a data read fails THEN THE App Shell SHALL render the in-voice error state with a retry action and a support error code (§E.9).
3. WHEN the device reports being offline or a write fails for connectivity THEN THE App Shell SHALL show the offline banner and render the last cached Field snapshot read-only with a staleness label stating its age (§E.9).
4. WHEN there is nothing new to show THEN THE App Shell SHALL render the all-caught-up state rather than an empty list (§E.9).

### Requirement 30: Project structure and buildability

**User Story:** As a developer joining this codebase, I want the repository to build and the CSS to survive a JSX reorder, so that I can change the product without breaking it by accident.

#### Acceptance Criteria

1. THE Build Configuration SHALL produce a successful production build and a clean type-check from a fresh checkout (§A.4, §G.2).
2. THE Build Configuration SHALL place source under `src/` with the feature, primitive, provider, library, copy, and type folders described in the design, and SHALL resolve every import correctly (§G.2).
3. THE Build Configuration SHALL declare the `@/` path alias in both the bundler configuration and the TypeScript configuration so that type-check and build agree (§G.2).
4. THE App Shell SHALL contain no CSS selector that depends on a DOM sibling position, and SHALL contain no `!important` declaration other than the reduced-motion reset (§A.4).
5. THE App Shell SHALL reduce the root application component to providers, router, grain, and toast host, under 150 lines (§G.3).
6. THE App Shell SHALL mount each domain subscription in its owning feature hook, scoped by hood or participant and mounted by its route (§G.3).
7. THE App Shell SHALL derive poster identity on a gig from a denormalised poster snapshot, and SHALL NOT subscribe to the users collection to build a lookup map (§G.3).
8. THE App Shell SHALL keep only ephemeral UI state — drawer, active signal, scrubber hour, compose draft, mode — in the client store, and SHALL NOT store server data there (§G.3).
9. THE Build Configuration SHALL split the server entry point into route, service, and middleware modules, and SHALL verify the caller's identity token on every mutating route (§G.2, §G.7).
10. THE Build Configuration SHALL declare the composite indexes required by every hood, scrubber, visibility, handshake, ledger, and review query (§G.5).
11. THE Build Configuration SHALL keep the pure modules — projection, spatial hash, handshake reducer, ranks, day rhythm, seeded randomness, and rating display — free of I/O so that they are directly testable (§J, §K.6).

### Requirement 31: Migration of existing data

**User Story:** As an operator, I want existing users and gigs carried into the new model without fabricated trust or leaked addresses, so that launch does not inherit the old system's defects.

#### Acceptance Criteria

1. THE Migration Suite SHALL deploy the hardened security rules and the composite indexes before any data migration step (§G.8).
2. THE Migration Suite SHALL recompute every existing user's rating from the reviews collection, and SHALL set rating to null and rating count to 0 for users with no reviews (§D.1, §G.8).
3. THE Migration Suite SHALL write each existing gig's exact coordinates to its private location subdocument, compute the fuzzed coordinates and geohash, and remove the exact coordinates from the public document (§G.8).
4. THE Migration Suite SHALL assign a `hoodId` to every existing gig by reverse-geocoding coordinates where present, else by mapping the stored suburb or location name, else by quarantining the gig as unknown and hiding it (§G.8).
5. THE Migration Suite SHALL rekey user documents from email to Firebase UID, retain an email-hash index for lookup, and leave the former documents read-only for one release (§G.8).
6. THE Migration Suite SHALL convert each interested-user entry into a handshake — negotiating, or agreed where it matches the previously selected worker — and set the gig's agreed handshake identifier accordingly (§G.8).
7. THE Migration Suite SHALL replay embedded chat proposals as offers in sequence order on the matching handshake (§G.8).
8. THE Migration Suite SHALL seed rep for existing users by replaying settled gigs and existing reviews through the live rep engine code path, so that the ledger remains replayable (§G.8).
9. THE Migration Suite SHALL backfill the renamed price and body fields and support dual reads for one release, keyed by schema version (§G.8).
10. THE Migration Suite SHALL remove every positional selector rule from the stylesheet (§G.8, §A.4).

---

## Non-Functional Requirements

### NFR-1 Performance

1. Initial gzipped JavaScript on the Field route: ≤ 190 KB; Google Maps JavaScript on the Field route: 0 KB (§I.6).
2. Preloaded font payload ≤ 64 KB; total font payload before the handwriting family ≤ 88 KB (§I.4).
3. Largest contentful paint ≤ 2.0 s, interaction to next paint ≤ 200 ms, cumulative layout shift ≤ 0.05, measured on a mid-range Android device over 4G (§I.6).
4. Field pointer-to-paint work ≤ 16.6 ms per frame at the 60-node budget; Field mount ≤ 120 ms on a mid-range Android device (§C.6).
5. Zero forced layout reads inside per-frame Field work (§H.2).
6. Firestore read volume bounded by hood-scoped, route-mounted subscriptions; no whole-collection listeners (§G.3, §K.1).

### NFR-2 Accessibility

1. Text/background contrast: ≥ 4.5:1 for body text and ≥ 3:1 for large text, per the design's computed audit; the enumerated failing pairs are prohibited as text (§I.1).
2. Every interactive target ≥ 44 × 44 px (§I.7).
3. Every Field capability reachable by keyboard and by screen reader, with a parallel semantic list and spatial narration in words (§I.3).
4. Reduced motion preserves all outcomes and all information; only timing changes (§H.9).
5. No information conveyed by colour alone; no information conveyed by hover alone (§I.1, §I.7).
6. Blinking indicators below 3 Hz (§I.3).

### NFR-3 Security

1. Default-deny security rules deployed; no path permits unauthenticated or unscoped write (§G.6).
2. Rep, rank, verification status, and all derived progression fields are server-write-only (§D.2, §G.6).
3. Handshake transitions are server-only and transactional (§G.6).
4. No authentication decision depends on the request hostname or on the existence of a database document (§E.1).
5. Identity-token verification on every mutating server route; per-user write rate limits enforced server-side (§G.6, §G.7).
6. Identity documents stored with all client reads denied and deleted after approval, retaining only an approval flag, a timestamp, and a last-four hash (§K.1).

### NFR-4 Privacy

1. Published coordinates always displaced by 120–250 m, deterministically per gig (§H.3).
2. Displayed distances rounded to at least 50 m granularity (§H.3).
3. No phone number, email address, or payment address on any public document (§G.4).
4. Exact location and contact details reachable only by the poster and the agreed doer (§G.6).
5. No street basemap on the primary browse surface (§C.1).

### NFR-5 Reliability and integrity

1. Exactly one AGREED handshake per gig under any interleaving of concurrent accepts (§E.4, §J.2).
2. Rep equals the sum of a user's non-deferred ledger events at all times; every grant is idempotent by key (§D.2, §J.1).
3. Notification emission is idempotent by deterministic identifier (§E.8, §J.7).
4. Platform take is always exactly ₹0; no server route holds, forwards, or reconciles funds (§E.5, §J.8).
5. Projection preserves distance ordering and bearing; round-trip error within 1 m or one part per million of the radius (§H.1, §J.4).
6. Proximity detection is deterministic and agrees with exhaustive search (§H.2, §J.5).
7. Signal visibility is monotone in time while a gig stays open (§H.5, §J.6).
8. Deterministic seeded values — tilt, avatar palette, ghost-signal placement — are stable across renders and devices (§H.8, §J.9).

---

## Assumptions and Open Questions

These are recorded rather than resolved, per design §K.5. Each affects requirements above and should be closed before or during the phase noted.

1. **Rep calibration (§D.3, §K.5.1).** The rep weights and rank thresholds in Requirements 15 and 17 are a first-pass calibration, not a final one. Assumption: the values are implemented as named constants in one shared module so recalibration after the first hood does not require touching call sites.
2. **The contents behind the redacted ranks (§D.5, §K.5.2).** Requirement 17.7 encodes Signal Boost, Trust Vouch, and Hood Council as the design's proposal. Trust Vouch in particular carries an unresolved abuse and social-pressure question. Assumption: the reveal mechanism (17.9, 17.10) is independent of the specific rewards, so the rewards can change without reworking the reveal.
3. **Age policy (§K.5.3).** The existing prototype enforces 16+. Whether doers must be 18+ while posters may be 16+ is unresolved. No requirement above fixes an age threshold.
4. **Identity verification mechanism (§K.5.4).** Requirements 21.9 and 23.4 are written to be satisfied by either document upload with post-approval deletion or a DigiLocker / offline-XML flow that never holds the image. The design recommends migrating to the latter; the choice is open.
5. **Head-start direction (§D.6, §K.5.5).** Requirement 18 encodes the head start as a rank-03+ privilege. Whether it should invert into a rookie window for a user's first gigs is an open product question that would change 18.1, 18.2, and 18.8.
6. **UI language (§I.4, §K.5.6).** All copy requirements assume an English-with-Hindi-inflection voice and a latin font subset. Whether Hindi, Kannada, Tamil, or Bengali UI is needed is open, and the answer changes the font-subsetting requirements in 28.4.
7. **Whether the Board survives (§K.5.7).** Requirement 7 treats the Board as first-class. If Field usage dominates after launch, the Board may be demoted to an accessibility-and-search surface. Both surfaces are instrumented from day one.
8. **Day Zero Pass matching (§K.5.8).** Requirement 24.6 requires a verified match. Which channel counts as verified when a Google account email differs from the waitlist email is unresolved.
9. **Serious-harm escalation path (§K.1).** Community moderation (22.7) is the affordable model, but the escalation route for genuinely serious incidents is a policy decision that is not settled here.
10. **Distinct-counterparty gates in small hoods (§K.1).** The design notes that 8 distinct counterparties may be most of a 40-person hood and proposes scaling the gate with hood size. Requirement 17.2 states the fixed thresholds; the scaling rule is an open calibration.

---

## Out of Scope

The following are explicitly not covered by this spec.

1. **Escrow, wallets, custody, or any handling of funds.** Deliberately excluded — holding money would require a commission, which would destroy the ₹0 positioning that the product is built on (§E.5, §K.3.3). Requirement 13 exists in part to make this exclusion structurally enforced rather than merely intended. The consequence — no platform recourse for non-payment — is accepted and disclosed, not mitigated by a payments feature.
2. **The landing page and its waitlist backend.** A separately deployed artefact, owned outside this spec. This spec consumes the waitlist collection read-only for Day Zero Pass matching and ghost-signal counts, and removes the redundant in-app landing screen (§F.3).
3. **Native mobile applications.** The target is a mobile-first web application. No iOS or Android client, no app-store packaging, no native push SDK integration beyond web push.
4. **Multi-language UI.** Flagged as an open question (§K.5.6). Only the latin font subset and English-with-Hindi-inflection copy are in scope; localisation infrastructure is not.
5. **The generative-AI / image-generation feature.** The generative-AI SDK is currently a dependency with no user-facing feature. It is removed from the client bundle rather than redesigned (§G.7, §I.6, §K.8).
6. **Google Maps as a browse surface.** Retained only as a precision layer on the flare address-picking route and the live-gig route (§C.1). Styling a basemap to match the zine identity is out of scope and explicitly rejected.
7. **Payment reconciliation, invoicing, tax reporting, and dispute-linked refunds.** Follow directly from the no-custody decision.
8. **Operational seeding of demand.** Team-posted gigs in launch hoods are an operational activity (§K.4.6); this spec covers only the requirement that such gigs are marked honestly.
