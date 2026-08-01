/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Safety, payment, dispute, and verification copy (design §K.2, req 2.6).
 *
 * These surfaces are expressed in plain, warm, non-humorous language. Humour is
 * restricted to validation, empty, loading, and marketing surfaces — never here.
 * The voice linter flags these records if they carry an emoji or a joke marker.
 */
export const safety = {
  meetInPublic: {
    title: 'meet somewhere public the first time',
    body: 'pick a spot with people around. tell a friend where you are going.',
  },
  reportStrip: {
    body: 'something feels off? you can report this in one tap.',
  },
  firstMeetup: {
    title: 'first time meeting this person',
    body: 'we suggest a public spot near the pin. you can share your plan with a friend.',
  },
  noEscrow: {
    title: 'money moves directly between you',
    body:
      'qwick gig never holds your payment. we take ₹0. that also means there is no platform refund if something goes wrong — agree terms and pay only when you are comfortable.',
  },
  paymentAttestation: {
    body: 'confirm once the money has actually moved. this is a record, not a transaction.',
  },
  paymentMismatch: {
    title: 'your records do not match',
    body: 'you each recorded something different. a moderator will take a look.',
  },
  verificationPending: {
    title: 'verification under review',
    body: 'we are checking your document. you can keep browsing while we do.',
  },
  verificationApproved: {
    title: 'you are verified',
    body: 'you can claim gigs now.',
  },
  verificationRequired: {
    title: 'verify to claim',
    body: 'verifying your identity keeps the neighbourhood safe. it takes a minute.',
  },
} as const;

export type SafetyKey = keyof typeof safety;
