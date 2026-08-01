// Hood (a pincode-scoped area: the data partition and the social unit). Design §G.4.

export interface Hood {
  pincode: string; // doc id
  area: string;
  city: string;
  state: string;
  centroid: { lat: number; lng: number };
  adjacent: string[]; // <= 9
  status: 'waitlist' | 'live' | 'paused';
  /** Neighbours required before the hood flips to `live`. Server-owned; defaults applied client-side. */
  launchThreshold?: number;
  waitlistCount: number;
  activeMembers30d: number;
  gigCount: number;
  priceStats: Record<string, { p25: number; p50: number; p75: number; n: number }>;
  hourHistogram: number[]; // length 24
  resolvedAt: number;
  source: 'api' | 'fallback' | 'manual';
}
