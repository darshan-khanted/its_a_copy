// Identity, reputation and rank types. Source of truth: design §D.8, §G.4.

export type RankId = 'TAPPED_IN' | 'HUSTLER' | 'LEGEND' | 'MAX_CHARISMA' | 'MYTH';

/** Safe to embed anywhere. NO email, NO phone. */
export interface PublicIdentity {
  uid: string;
  handle: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl?: string;
  rank: RankId;
  rep: number;
  verified: boolean;
  gigsSettled: number;
  rating: number | null; // null until ratingCount >= 1
  ratingCount: number;
  dayZero?: { position: number };
  hoodId?: string;
}

export interface RepState {
  rep: number;
  repVersion: number;
  heat: number;
  rank: RankId;
  verified: boolean;
  distinctCounterparties: number;
  upheldReports: number;
  streakWeeks: number;
  medianFirstReplyMins: number | null;
}

export interface User extends PublicIdentity, RepState {
  bio?: string;
  homeHoodId: string;
  onboardedAt: number;
  verification: {
    status: 'none' | 'pending' | 'approved' | 'rejected';
    submittedAt?: number;
    reviewedAt?: number;
  };
  prefs: { surface: 'auto' | 'paper' | 'night'; pushOptIn: boolean; quietHours: boolean };
  blockedUids: string[];
  createdAt: number;
  schemaVersion: 2;
}

export type RepEventKind =
  | 'SETTLED'
  | 'FIRST_FLARE_IN_HOOD'
  | 'REVIEW_LEFT'
  | 'STREAK'
  | 'PENALTY'
  | 'DAY_ZERO';

export interface RepGrantEvent {
  id: string;
  eventType: 'GRANT';
  uid: string;
  kind: RepEventKind;
  delta: number;
  rawDelta: number;
  multiplier: number;
  status: 'APPLIED' | 'PENDING';
  pendingReason?: 'REVIEW_FREEZE' | 'DAY_CAP' | 'WEEK_CAP';
  reason: string;
  handshakeId?: string;
  counterpartyUid?: string;
  hoodId?: string;
  idempotencyKey: string;
  grantOrder: number;
  resultingRep: number;
  createdAt: number;
}

export interface RepApplicationEvent {
  id: string;
  eventType: 'APPLICATION';
  uid: string;
  pendingEventId: string;
  delta: number;
  idempotencyKey: string;
  resultingRep: number;
  createdAt: number;
}

export type RepEventRecord = RepGrantEvent | RepApplicationEvent;

export interface Unlocks {
  maxActiveClaims: number;
  headStartMins: number; // 0 or 10
  canBoost: boolean;
  canVouch: boolean;
  canCouncil: boolean;
  canAttachPhoto: boolean;
  customMarkerColor: boolean;
}
