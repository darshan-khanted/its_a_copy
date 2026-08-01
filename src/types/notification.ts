// Notifications. Deterministic id `{kind}_{subjectId}_{uid}` (design §G.5).

export type NotificationKind =
  | 'welcome'
  | 'claim'
  | 'handshake_agreed'
  | 'rank_up'
  | 'hood_live'
  | 'review_reminder'
  | 'urgent';

export interface AppNotification {
  id: string; // `{kind}_{subjectId}_{uid}`
  uid: string;
  kind: NotificationKind;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  route?: string; // deep link into the app
  relatedId?: string;
}
