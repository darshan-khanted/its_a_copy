// Handshake (the negotiated agreement artefact). Source of truth: design §G.4.
import type { PublicIdentity } from './user';

export type HandshakeState =
  | 'NEGOTIATING'
  | 'AGREED'
  | 'LIVE'
  | 'DONE_PENDING'
  | 'SETTLED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

export interface Offer {
  seq: number;
  byUid: string;
  price: number;
  date: string;
  startTime: string;
  endTime?: string;
  note?: string; // max 140
  createdAt: number;
  status: 'live' | 'superseded' | 'accepted' | 'declined';
}

export interface Handshake {
  id: string; // `${gigId}_${doerUid}`
  gigId: string;
  hoodId: string;
  posterUid: string;
  doerUid: string;
  posterSnapshot: PublicIdentity;
  doerSnapshot: PublicIdentity;
  state: HandshakeState;
  offers: Offer[];
  latestSeq: number;
  agreed?: {
    price: number;
    date: string;
    startTime: string;
    endTime?: string;
    agreedAt: number;
    agreedOfferSeq: number;
  };
  attestations: { done: Record<string, number>; paid: Record<string, number> };
  paymentMethod?: 'upi' | 'cash';
  /**
   * Set by the RESOLVE action (design §H.6) when a moderator settles or voids a
   * DISPUTED handshake. Distinguishes a moderator-settled handshake from one
   * settled by two ordinary attestations, which is required to state design
   * §J.2's own property P2.7 ("SETTLED requires both attestations, OR when a
   * moderator resolves a dispute in favour of settlement" — requirement 12.11).
   * Flagged addition: not present in the original type; genuinely missing
   * because no existing field could express this distinction.
   */
  wasModeratorResolved?: boolean;
  meetupNudgeShown: boolean;
  threadId: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
}
