// Field signals: derived, never persisted. Source of truth: design §G.4.
import type { Gig } from './gig';
import type { Hood } from './hood';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RealFieldSignal {
  kind: 'REAL_GIG';
  id: string;
  fx: number;
  fy: number;
  distanceM: number;
  bearingDeg: number;
  price: number;
  title: string;
  tone: 'cobalt' | 'magenta' | 'lime' | 'cyan' | 'peach';
  urgent: boolean;
  ageMins: number;
  rot: number;
  locked: boolean;
  headStart: boolean;
}

export interface GhostFieldSignal {
  kind: 'WAITLIST_GHOST';
  id: string;
  fx: number;
  fy: number;
  price: 0;
  title: 'WAITING';
  claimable: false;
  detailRoute: null;
}

export interface RealFieldCluster {
  kind: 'REAL_GIG_CLUSTER';
  id: string;
  gigIds: string[];
  count: number;
  totalValue: number;
  fx: number;
  fy: number;
}

export type FieldSignal = RealFieldSignal | RealFieldCluster | GhostFieldSignal;

export interface WaitlistDemandIndicator {
  label: 'WAITLIST';
  count: number;
  progressTarget?: number;
}

export interface FieldContent {
  nodes: FieldSignal[];
  waitlistIndicator: WaitlistDemandIndicator | null;
}

/**
 * Ghost nodes are derived only when there are zero real open gigs. The full
 * projection/derivation implementation lands in Phase 1 (task 3.21/3.24); this
 * skeleton returns a structurally-correct empty derivation.
 */
export type DeriveFieldContent = (
  realOpenGigs: readonly Gig[],
  hood: Hood,
) => FieldContent;
