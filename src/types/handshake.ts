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
  meetupNudgeShown: boolean;
  threadId: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
}
