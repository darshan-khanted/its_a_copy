export enum ActiveView {
  LANDING = 'LANDING',
  HOME = 'HOME',
  POST = 'POST',
  FEED = 'FEED',
  DETAILS = 'DETAILS',
  PUBLISHED = 'PUBLISHED',
  PROFILE = 'PROFILE',
  NOTIFICATIONS = 'NOTIFICATIONS',
  ONBOARDING = 'ONBOARDING',
  MESSAGES = 'MESSAGES',
  FEEDBACK = 'FEEDBACK',
  RESET_PASSWORD = 'RESET_PASSWORD'
}

export interface SavedAddress {
  id: string;
  name: string;
  fullAddress: string;
  suburb: string;
  doorNumber: string;
}

export interface User {
  fullName: string;
  email: string;
  phoneNumber: string;
  isVerified: boolean;
  avatar: string;
  gigsDone: number;
  gigsPosted: number;
  savedAddresses?: SavedAddress[];
  aadharUrl?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  bio?: string;
  rating?: number;
  ratingCount?: number;
  onboardingCompleted?: boolean;
  createdAt?: number;
}

export function getUserAvatarUrl(avatar: string | null | undefined, email?: string, name?: string): string {
  if (!avatar || typeof avatar !== 'string' || avatar.trim() === '' || avatar === 'null' || avatar === 'undefined' || avatar.includes('dicebear.com') || avatar.includes('lh3.googleusercontent.com/aida-public')) {
    const displayName = name || email || 'Guest';
    const initials = displayName
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'G';

    // Generate a consistent pastel gradient background based on the name/email
    let hash = 0;
    const str = displayName + (email || '');
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Choose nice, premium color combinations
    const gradients = [
      { from: '4F46E5', to: '06B6D4' }, // Indigo to Cyan
      { from: 'EC4899', to: '8B5CF6' }, // Pink to Violet
      { from: '10B981', to: '3B82F6' }, // Emerald to Blue
      { from: 'F59E0B', to: 'EF4444' }, // Amber to Red
      { from: '8B5CF6', to: 'EC4899' }, // Purple to Pink
      { from: '3B82F6', to: '10B981' }, // Blue to Emerald
      { from: '06B6D4', to: '3B82F6' }, // Cyan to Blue
      { from: '6366F1', to: 'EC4899' }  // Indigo to Pink
    ];
    
    const index = Math.abs(hash) % gradients.length;
    const grad = gradients[index];
    
    // Generate an inline SVG with dynamic gradient and centered initials
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <linearGradient id="grad-${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${grad.from};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#${grad.to};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad-${index})" />
      <text x="50" y="55" font-family="'Inter', -apple-system, sans-serif" font-size="38" font-weight="700" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle" letter-spacing="-1">${initials}</text>
    </svg>`;
    
    // Safely encode SVG to base64 to ensure 100% browser compatibility and avoid URL-encoding/hash-sign issues
    let base64 = "";
    try {
      base64 = btoa(encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } catch (e) {
      // Fallback if btoa fails or in non-browser environments
      base64 = typeof Buffer !== "undefined" 
        ? Buffer.from(svg).toString("base64") 
        : btoa(svg);
    }
    
    return `data:image/svg+xml;base64,${base64}`;
  }
  return avatar;
}

export type GigStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';

export interface InterestedUser {
  email: string;
  fullName: string;
  avatar: string;
  bio?: string;
  isVerified: boolean;
  proposedPrice?: number;
  phoneNumber?: string;
}

export interface Gig {
  id: string;
  title: string;
  description: string;
  price: number;
  date: string;
  startTime: string;
  imageUrl: string;
  locationName: string;
  suburb: string;
  distance?: number;
  lat?: number;
  lng?: number;
  city?: string;
  category: string;
  isClosed: boolean;
  posterPhone?: string;
  posterEmail?: string;
  posterId?: string;
  posterName?: string;
  isAccepted?: boolean;
  acceptedByPhone?: string;
  acceptedByName?: string;
  acceptedByEmail?: string;
  acceptedById?: string;
  urgent?: boolean;
  posterAvatar?: string;
  posterRating?: number;
  posterRatingCount?: number;
  posterGigsCount?: number;
  isVerifiedPoster?: boolean;
  createdAt?: number;
  status?: GigStatus;
  interestedUsers?: InterestedUser[];
  selectedWorker?: InterestedUser | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  type: 'welcome' | 'gig_posted' | 'gig_accepted' | 'urgent';
  relatedId?: string;
}

export interface Review {
  id: string;
  targetEmail: string;
  reviewerEmail: string;
  reviewerName: string;
  reviewerAvatar?: string;
  rating: number;
  comment: string;
  createdAt: number;
  relatedId?: string;
}

export interface ChatProposal {
  gigId: string;
  price: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface ChatMessage {
  id: string;
  senderEmail: string;
  senderName: string;
  text: string;
  timestamp: number;
  read: boolean;
  proposal?: ChatProposal;
  isSystem?: boolean;
}

export interface ChatThread {
  id: string;
  gigId: string;
  gigTitle: string;
  participants: string[];
  participantNames: { [email: string]: string };
  participantAvatars: { [email: string]: string };
  lastMessage: string;
  lastMessageSender: string;
  lastMessageTime: number;
  unreadCount: { [email: string]: number };
  createdAt: number;
  pinnedBy?: { [email: string]: boolean };
  typing?: { [email: string]: boolean };
  disabled?: boolean;
}

