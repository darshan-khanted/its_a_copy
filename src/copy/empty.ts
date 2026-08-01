/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Empty states (design §B.5, req 2.2). Expressive lowercase, encouraging,
 * never apologetic. The first-flare bonus line is stated next to the flare
 * action in both the zero-supply and sparse-board states (req 9.11).
 */
export const empty = {
  ghostTown: {
    title: 'your hood is quiet rn',
    body:
      'nobody has posted here yet. be the menace who goes first — first flare in a hood is worth double rep.',
  },
  sparseBoard: {
    title: 'just getting started here',
    body: 'a few flares are up. post one and you still catch the first-flare bonus.',
  },
  allCaughtUp: {
    title: 'you have seen everything',
    body: 'genuinely. touch grass, check back at 6.',
  },
  offline: {
    title: 'you are offline',
    body: 'showing the last scan we cached. we will refresh the moment you are back.',
  },
  noResults: {
    title: 'nothing here at this hour',
    body: 'try the peak hour — that is when your hood actually wakes up.',
  },
  noClaims: {
    title: 'no claims yet',
    body: 'nobody has raised a hand on this flare. give it a minute.',
  },
  preLaunch: {
    title: 'this hood is not live yet',
    body: 'we open one pincode at a time. pull your neighbours in and this hood switches on.',
    nearby: 'not live yet — peek at the hoods next door while you wait.',
  },
} as const;

/**
 * The single-step auth-sheet prompt, keyed by the preserved intent (design §E.1).
 * Expressive lowercase; each names the account-gated action the user just tried.
 */
export const authGate = {
  claim: 'you need a name on the board to claim this',
  flare: 'you need a name on the board to flare',
  chat: 'you need a name on the board to chat',
} as const;

/** In-voice confirmation for a freshly claimed hood (design §E.1 flag-planting payoff). */
export function hoodClaimedLine(area: string): string {
  return `${area} is on the field now`;
}

export type EmptyKey = keyof typeof empty;
