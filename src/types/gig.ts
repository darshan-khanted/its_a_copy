// Gig (the "signal"). Source of truth: design §G.4.
import type { PublicIdentity, RankId } from './user';

export type GigState = 'OPEN' | 'MATCHED' | 'LIVE' | 'DONE' | 'CLOSED' | 'CANCELLED' | 'EXPIRED';

export interface Gig {
  id: string;
  title: string;
  body: string;
  askPrice: number;
  tags: string[];
  urgent: boolean;
  photoUrl?: string;

  // geography: fuzzed only on the public doc
  hoodId: string;
  areaLabel: string;
  geoFuzzed: { lat: number; lng: number };
  geohash7: string;
  fuzzSeedVersion: number;

  // time
  startDate: string;
  startTime: string; // "18:00" | "FLEXIBLE"
  startHour: number | null;
  expiresAt: number;

  // state
  state: GigState;
  agreedHandshakeId: string | null;
  claimCount: number;
  posterUid: string;
  posterSnapshot: PublicIdentity;

  // rep gating
  minRank: RankId | null;
  visibleFrom: { legend: number; all: number };

  createdAt: number;
  schemaVersion: 2;
}
