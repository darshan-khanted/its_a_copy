/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Loading states are personality, not spinners (design §B.5, req 2.2).
 * Expressive lowercase; no default or absent copy.
 */
export const loading = {
  field: ['scanning your hood…', 'counting the neighbours…', 'triangulating vibes…'],
  posting: ['sending the flare…', 'waking up the block…'],
  handshake: ['locking it in…'],
  claim: ['sliding into their inbox…'],
  profile: ['pulling up the receipts…'],
  receipt: ['doing the maths…'],
} as const;

export type LoadingKey = keyof typeof loading;
