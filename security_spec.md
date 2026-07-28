# Security Specification

## 1. Data Invariants
- **Identity Invariance**: A user can only register, modify, or delete their own profile (`users/{userId}` where `userId` matches their lowercase authenticated email or UID).
- **Immutable Status**: The `isVerified` status of a user's profile can only be set or modified via administrative/server interfaces (bypassing rules in Firebase Console) and never through client updates.
- **Immutable Gig Poster Status**: A user posting a gig cannot set `isVerifiedPoster` to `true`.
- **Immutable Gig Interested User Status**: A user joining the `interestedUsers` array of a gig cannot set `isVerified` to `true` on their entry.
- **Secure Relational Ownership**: A user can only perform read/write actions on chats where they are listed in the `participants` list.

---

## 2. The "Dirty Dozen" Attack Payloads (All Denied)

### Payload 1: Self-Verification Profile Hijack
- **Target**: `users/attacker_email_com`
- **Action**: Update `isVerified` to `true`
- **Result**: `PERMISSION_DENIED`

### Payload 2: Hostile Takeover profile modification
- **Target**: `users/victim_email_com`
- **Action**: Update profile by a different logged-in user
- **Result**: `PERMISSION_DENIED`

### Payload 3: Spoofed Verified Gig Creation
- **Target**: `gigs/new_gig_id`
- **Action**: Create gig with `isVerifiedPoster: true`
- **Result**: `PERMISSION_DENIED`

### Payload 4: Spoofed Verified Gig Update
- **Target**: `gigs/existing_gig_id`
- **Action**: Update gig, setting `isVerifiedPoster: true`
- **Result**: `PERMISSION_DENIED`

### Payload 5: Interested User Verification Forgery
- **Target**: `gigs/existing_gig_id`
- **Action**: Append interested user entry with `isVerified: true`
- **Result**: `PERMISSION_DENIED`

### Payload 6: Anonymous Gig Insertion
- **Target**: `gigs/new_gig_id`
- **Action**: Create gig when unauthenticated
- **Result**: `PERMISSION_DENIED`

### Payload 7: Chat Ingress Bypass
- **Target**: `chats/private_chat_id`
- **Action**: Read or update thread details when the current user's email is not in the `participants` array
- **Result**: `PERMISSION_DENIED`

### Payload 8: Message Injection on Private Channel
- **Target**: `chats/private_chat_id/messages/msg_999`
- **Action**: Write messages when current user is not a participant of the parent thread
- **Result**: `PERMISSION_DENIED`

### Payload 9: Feedback Forgery / System Logs Modification
- **Target**: `activities_general/activity_id_1`
- **Action**: Update or delete logs (which must be write-only/immutable)
- **Result**: `PERMISSION_DENIED`

### Payload 10: Notification Spoofing / System Alert Ingress
- **Target**: `notifications/notif_1`
- **Action**: Modify or send notification where sender does not match actual current user
- **Result**: `PERMISSION_DENIED`

### Payload 11: Denial of Wallet ID Poisoning (Huge ID strings)
- **Target**: `users/a_very_long_string_representing_a_malicious_id_over_128_characters_long_which_would_bloat_the_database_and_cause_massive_indexing_overhead...`
- **Action**: Create/get document
- **Result**: `PERMISSION_DENIED`

### Payload 12: Review Manipulation / Self-Review Injection
- **Target**: `reviews/review_1`
- **Action**: Delete or update someone else's review
- **Result**: `PERMISSION_DENIED`
