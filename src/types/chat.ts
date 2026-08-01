// Chat threads and messages. Kept from the current model but rekeyed to Firebase UID
// (design §G.8 migration #1: email-as-key leaks PII into document paths).

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  timestamp: number;
  read: boolean;
  isSystem?: boolean;
}

export interface ChatThread {
  id: string;
  gigId: string;
  gigTitle: string;
  participants: string[]; // uids
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessage: string;
  lastMessageSender: string;
  lastMessageTime: number;
  unreadCount: Record<string, number>;
  createdAt: number;
  pinnedBy?: Record<string, boolean>;
  typing?: Record<string, boolean>;
  disabled?: boolean;
}
