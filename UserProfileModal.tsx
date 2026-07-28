import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ShieldCheck, ShieldAlert, Star, Briefcase, User, Sparkles, MessageSquare } from "lucide-react";
import { User as UserType, Review, getUserAvatarUrl } from "../types";
import { db, doc, getDoc, collection, query, where, getDocs, auth } from "../firebase";
import { formatTimestampToDDMMYY } from "../utils/date";
import { toTitleCase } from "../utils/stringUtils";
interface UserProfileModalProps {
  userEmail: string;
  initialName: string;
  initialAvatar?: string;
  initialBio?: string;
  isVerified?: boolean;
  reviews: Review[];
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({
  userEmail,
  initialName,
  initialAvatar,
  initialBio,
  isVerified = false,
  reviews,
  isOpen,
  onClose,
}: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !userEmail) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      if (!auth.currentUser) {
        // Logged-out visitor: use initial props immediately to prevent Firestore read errors
        setProfile({
          fullName: initialName,
          email: userEmail,
          phoneNumber: "",
          avatar: getUserAvatarUrl(initialAvatar, userEmail, initialName),
          isVerified: isVerified,
          gigsDone: 0,
          gigsPosted: 0,
          bio: initialBio || "",
        });
        setIsLoading(false);
        return;
      }
      try {
        const userRef = doc(db, "users", userEmail);
        let docSnap = await getDoc(userRef);
        let foundData: UserType | null = null;
        
        if (docSnap.exists()) {
          foundData = docSnap.data() as UserType;
        }

        // Retry with lowercase email doc ID if original case was not found
        if (!foundData) {
          const lowerUserRef = doc(db, "users", userEmail.toLowerCase());
          docSnap = await getDoc(lowerUserRef);
          if (docSnap.exists()) {
            foundData = docSnap.data() as UserType;
          }
        }

        // Retry with a query on 'email' field case-insensitively/normally
        if (!foundData) {
          try {
            const usersColRef = collection(db, "users");
            const q = query(usersColRef, where("email", "==", userEmail));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              foundData = querySnap.docs[0].data() as UserType;
            } else {
              // Try querying lowercased email field if still not found
              const qLower = query(usersColRef, where("email", "==", userEmail.toLowerCase()));
              const querySnapLower = await getDocs(qLower);
              if (!querySnapLower.empty) {
                foundData = querySnapLower.docs[0].data() as UserType;
              }
            }
          } catch (queryErr) {
            console.warn("Failed query fallback, using direct document methods", queryErr);
          }
        }

        if (foundData) {
          setProfile(foundData);
        } else {
          setProfile({
            fullName: initialName,
            email: userEmail,
            phoneNumber: "",
            avatar: getUserAvatarUrl(initialAvatar, userEmail, initialName),
            isVerified: isVerified,
            gigsDone: 0,
            gigsPosted: 0,
            bio: initialBio || "",
          });
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
        setProfile({
          fullName: initialName,
          email: userEmail,
          phoneNumber: "",
          avatar: getUserAvatarUrl(initialAvatar, userEmail, initialName),
          isVerified: isVerified,
          gigsDone: 0,
          gigsPosted: 0,
          bio: initialBio || "",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, userEmail, initialName, initialAvatar, initialBio, isVerified]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  // Filter and calculate reviews for this target user
  const userReviews = reviews.filter((r) => r.targetEmail && r.targetEmail.toLowerCase() === userEmail.toLowerCase());
  const averageRating = userReviews.length > 0
    ? userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length
    : (profile?.rating ?? 4.8);
  const feedbackCount = userReviews.length > 0
    ? userReviews.length
    : (profile?.ratingCount ?? 5);

  const displayName = toTitleCase(profile?.fullName || initialName);
  const avatarUrl = getUserAvatarUrl(profile?.avatar || initialAvatar, userEmail, displayName);
  const displayBio = profile?.bio || initialBio || "This user hasn't added a bio yet.";
  const showVerifiedBadge = profile?.isVerified ?? isVerified;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative border border-slate-100 flex flex-col max-h-[72vh] xs:max-h-[76vh] sm:max-h-[82vh] md:max-h-[85vh] z-10 text-left"
          id="user-profile-modal"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-200/60 px-2.5 py-1 rounded-full">
                User Insights
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all active:scale-95 cursor-pointer"
              aria-label="Close"
              id="close-profile-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-400">Retrieving community details...</p>
              </div>
            ) : (
              <>
                {/* Hero section */}
                <div className="flex items-start gap-4">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-primary/10 shadow-sm shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = getUserAvatarUrl("", userEmail, displayName);
                    }}
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-extrabold text-base text-brand-dark leading-tight truncate">
                        {displayName}
                      </h3>
                      {showVerifiedBadge ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-green-200">
                          <ShieldCheck className="w-3 h-3 shrink-0" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-red-200">
                          <ShieldAlert className="w-3 h-3 shrink-0" /> Unverified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium truncate">
                      {userEmail}
                    </p>

                    {/* Rating pill */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span className="text-xs font-extrabold">{averageRating.toFixed(1)}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">
                        ({feedbackCount} {feedbackCount === 1 ? "feedback" : "feedbacks"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick stats columns */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center gap-2.5">
                    <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Gigs Done</span>
                      <span className="text-sm font-black text-slate-800">{profile?.gigsDone || 0}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center gap-2.5">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-xl shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Gigs Posted</span>
                      <span className="text-sm font-black text-slate-800">{profile?.gigsPosted || 0}</span>
                    </div>
                  </div>
                </div>

                {/* About / Bio Section */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                    <span>A Bit About {displayName.split(" ")[0]}</span>
                  </h4>
                  <div className="bg-brand-primary/5 border border-brand-primary/10 p-3.5 rounded-2xl">
                    <p className="text-[11px] text-slate-600 leading-relaxed font-semibold whitespace-pre-line italic">
                      "{displayBio}"
                    </p>
                  </div>
                </div>

                {/* Feedbacks List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Community Feedback</span>
                    </h4>
                    <span className="text-[9px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                      {feedbackCount} total
                    </span>
                  </div>

                  {!auth.currentUser ? (
                    <div className="text-center py-8 bg-amber-50/50 rounded-2xl border border-dashed border-amber-200">
                      <span className="text-2xl block mb-1 opacity-80">🔒</span>
                      <p className="text-[10px] font-black text-amber-800">Reviews are Private</p>
                      <p className="text-[9px] text-amber-700/80 mt-1 max-w-[200px] mx-auto font-semibold">
                        Please sign in to view detailed feedback text and past listings of other neighbors.
                      </p>
                    </div>
                  ) : userReviews.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <span className="text-2xl block mb-1 opacity-60">✍️</span>
                      <p className="text-[10px] font-bold text-slate-400">No review ratings received yet.</p>
                      <p className="text-[9px] text-slate-400/80 mt-0.5">Reviews are left after safe, verified completion.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
                      {userReviews.map((rev) => (
                        <div key={rev.id} className="bg-white border border-slate-100 p-3 rounded-2xl shadow-xs space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={getUserAvatarUrl(rev.reviewerAvatar, rev.reviewerEmail, rev.reviewerName)}
                                alt={rev.reviewerName}
                                className="w-7 h-7 rounded-full border border-slate-100 shrink-0 object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = getUserAvatarUrl("", rev.reviewerEmail, rev.reviewerName);
                                }}
                              />
                              <div>
                                <span className="font-extrabold text-slate-800 text-[10px] block">
                                  {rev.reviewerName}
                                </span>
                                <span className="text-[8px] text-slate-400 block">
                                  {formatTimestampToDDMMYY(rev.createdAt)}
                                </span>
                              </div>
                            </div>

                            {/* Stars */}
                            <div className="flex items-center gap-0.5 text-[#e2c62d]">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <span key={idx} className="text-xs">
                                  {idx < rev.rating ? "★" : "☆"}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-[10.5px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100/60 leading-relaxed font-medium">
                            {rev.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer close bar */}
          <div className="py-3 px-4 sm:px-6 md:px-8 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0 w-full">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-brand-primary text-white text-xs font-black rounded-xl hover:bg-brand-primary-dark transition-all active:scale-95 cursor-pointer shadow-sm"
              id="close-profile-modal-footer"
            >
              Done Viewing
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
