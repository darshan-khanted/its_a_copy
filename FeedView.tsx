/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  X,
  HelpCircle,
  MessageSquare,
  CheckCircle,
  Smartphone,
  SearchX,
  Calendar,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { ActiveView, Gig, User, getUserAvatarUrl } from "../types";
import { calculateHaversineDistance, getCoordsForSuburb, getEffectiveUserLocation, resolveCityAndCoordinates } from "../utils/distance";
import { toTitleCase } from "../utils/stringUtils";

interface FeedViewProps {
  onNavigate: (view: ActiveView) => void;
  gigs: Gig[];
  onSelectGig: (gig: Gig) => void;
  onExpressInterest: (gigId: string, proposedPrice?: number) => Promise<void>;
  onUpdateGigPrice: (gigId: string, newPrice: number) => void;
  currentUser?: User | null;
  onOpenChat: (
    gig: Gig,
    otherUser: { email: string; fullName: string; avatar: string },
    initialMessage?: string
  ) => void;
  isLoading?: boolean;
  onViewUserProfile?: (
    email: string,
    fullName: string,
    avatar?: string,
    bio?: string,
    isVerified?: boolean
  ) => void;
  onRequireLogin?: (intendedAction: {
    type: 'express_interest' | 'negotiate' | 'publish_gig' | 'go_to_inbox' | 'go_to_profile';
    gigId?: string;
    proposedPrice?: number;
  }) => void;
}

export default function FeedView({
  onNavigate,
  gigs,
  onSelectGig,
  onExpressInterest,
  onUpdateGigPrice,
  currentUser,
  onOpenChat,
  isLoading: propIsLoading = false,
  onViewUserProfile,
  onRequireLogin,
}: FeedViewProps) {
  const [passedCardIds, setPassedCardIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("qwick_passed_gigs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing passed gigs", e);
      }
    }
    return [];
  });

  React.useEffect(() => {
    localStorage.setItem("qwick_passed_gigs", JSON.stringify(passedCardIds));
  }, [passedCardIds]);
  const [negotiatingGig, setNegotiatingGig] = useState<Gig | null>(null);
  const [negotiatePrice, setNegotiatePrice] = useState<string>("");

  const [sortingLoading, setSortingLoading] = useState(false);
  const isLoading = propIsLoading || sortingLoading;
  const [sortBy, setSortBy] = useState<"newest" | "distance">("newest");

  // User Location (start as null to avoid calculating distance if location settings are not turned on)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLoc({ lat, lng });
          console.log(`FeedView: Detected user location: (${lat}, ${lng})`);
        },
        (error) => {
          console.log("Geolocation error or denied in FeedView:", error);
          setUserLoc(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setUserLoc(null);
    }
  }, []);

  const getDistance = (gig: Gig) => {
    const isOwnGig = currentUser && (
      (gig.posterEmail && gig.posterEmail === currentUser.email) ||
      gig.posterName === currentUser.fullName
    );
    if (isOwnGig) return 0;

    const currentCity = localStorage.getItem("qwick_currentCity") || "Bengaluru";
    const effectiveLoc = getEffectiveUserLocation(userLoc, currentCity);

    // Retrieve gig coordinates; if missing on gig object, resolve via suburb and city context
    const gigCity = gig.city || currentCity;
    const localResolution = resolveCityAndCoordinates(gig.locationName || "", gig.suburb || "", gigCity);
    const gLat = gig.lat !== undefined && gig.lat !== null ? gig.lat : localResolution.lat;
    const gLng = gig.lng !== undefined && gig.lng !== null ? gig.lng : localResolution.lng;

    if (!gLat || !gLng) return null;

    return calculateHaversineDistance(effectiveLoc.lat, effectiveLoc.lng, gLat, gLng);
  };

  React.useEffect(() => {
    setSortingLoading(true);
    const timer = setTimeout(() => {
      setSortingLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [sortBy]); // trigger load on sort change for better UX

  const visibleGigs = gigs
    .filter((gig) => !passedCardIds.includes(gig.id) && !gig.isClosed && (gig.status === "Open" || !gig.status))
    .sort((a, b) => {
      if (sortBy === "distance") {
        const distA = getDistance(a) ?? Infinity;
        const distB = getDistance(b) ?? Infinity;
        return distA - distB;
      }
      // Default: sort by newest first (descending by createdAt timestamp)
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const handlePass = (gigId: string) => {
    setPassedCardIds((prev) => [...prev, gigId]);
  };

  const handleNegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negotiatingGig || !negotiatePrice) return;
    const priceNum = parseInt(negotiatePrice.replace(/[^0-9]/g, ""), 10);
    if (isNaN(priceNum) || priceNum <= 0) return;

    try {
      await onExpressInterest(negotiatingGig.id, priceNum);

      const messageText = `Hi ${negotiatingGig.posterName}, I am interested in your gig: "${negotiatingGig.title}" on Qwick, and I would like to negotiate the price to ₹${priceNum}. Is this okay with you?`;

      onOpenChat(
        negotiatingGig,
        {
          email: negotiatingGig.posterEmail || "",
          fullName: negotiatingGig.posterName || "Poster",
          avatar: negotiatingGig.posterAvatar || "",
        },
        messageText
      );
    } catch (err) {
      console.error(err);
    }

    setNegotiatingGig(null);
    setNegotiatePrice("");
  };

  return (
    <div className="w-full min-h-screen bg-brand-bg pt-3 pb-28">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-4">
        {/* Sorting */}
        <div className="flex justify-between items-center bg-white px-4 py-2.5 rounded-2xl border border-brand-light-gray shadow-sm">
          <span className="text-xs font-bold text-brand-gray">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-bold text-brand-dark bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="distance">Distance Wise</option>
          </select>
        </div>

        {/* Dynamic empty state or Loading */}
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div
              variants={{
                show: { transition: { staggerChildren: 0.08 } }
              }}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="flex flex-col gap-4"
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    show: { opacity: 1, y: 0 }
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="bg-white p-5 rounded-2xl border border-brand-light-gray shadow-sm flex flex-col gap-4 animate-pulse"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="flex flex-col gap-2">
                        <div className="h-3 w-24 bg-gray-200 rounded" />
                        <div className="h-2 w-16 bg-gray-200 rounded" />
                      </div>
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-5 w-48 bg-gray-200 rounded mt-2" />
                  <div className="h-4 w-full bg-gray-200 rounded" />
                  <div className="h-4 w-3/4 bg-gray-200 rounded" />
                  <div className="h-12 w-full bg-gray-200 rounded-xl mt-2" />
                </motion.div>
              ))}
            </motion.div>
          ) : visibleGigs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 flex flex-col items-center gap-4 bg-white p-8 rounded-3xl border border-brand-light-gray shadow-sm mt-4"
            >
              <div className="w-24 h-24 bg-brand-light-gray/40 rounded-full flex items-center justify-center mb-2">
                <SearchX className="w-10 h-10 text-brand-gray" />
              </div>
              <p className="font-extrabold text-brand-dark text-lg">
                No gigs found
              </p>
              <p className="text-xs text-brand-gray leading-normal max-w-xs text-center">
                We couldn't find any gigs matching your criteria. Try adjusting
                your filters or checking back later.
              </p>
              <button
                onClick={() => {
                  setPassedCardIds([]);
                }}
                className="mt-2 px-6 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-full shadow-md active:scale-95 transition-all"
              >
                Reset Passed Gigs
              </button>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-4" id="gig-feed">
              <AnimatePresence mode="popLayout">
                {visibleGigs.map((gig, index) => {
                  const isAccepted = gig.isAccepted;
                  const isOwnGig = currentUser && (
                    (gig.posterEmail && gig.posterEmail === currentUser.email) ||
                    gig.posterName === currentUser.fullName
                  );
                  const distance = getDistance(gig);

                  return (
                    <motion.article
                      layout
                      key={gig.id}
                      layoutId={gig.id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15, scale: 0.98 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 450, 
                        damping: 30,
                        delay: index < 6 ? index * 0.05 : 0 // Smooth staggered delay for early cards
                      }}
                      className={`bg-white p-5 rounded-2xl border transition-all shadow-sm flex flex-col gap-4 group ${
                        isAccepted
                          ? "border-brand-accent bg-brand-mint/5 shadow-md"
                          : "border-brand-light-gray"
                      }`}
                    >
                    {/* Header line */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 text-left">
                        <h2 className="font-extrabold text-sm text-brand-dark leading-tight group-hover:text-brand-primary transition-colors">
                          {gig.title}
                        </h2>
                        <div className="flex items-center gap-1 text-brand-gray text-[11px] mt-1 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-brand-accent" />
                          <span>
                            {isOwnGig ? (
                              <span className="text-brand-primary font-bold">Your gig • {gig.suburb}</span>
                            ) : distance !== null ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-brand-accent font-extrabold">{distance} km away</span>
                                <span className="text-brand-gray/40">•</span>
                                <span className="text-brand-gray">{gig.suburb}</span>
                              </span>
                            ) : (
                              <span>{gig.suburb}</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-brand-mint text-brand-mint-dark font-extrabold text-xs px-3 py-1.5 rounded-lg border border-brand-mint-dark/10 shadow-sm shrink-0">
                        ₹{gig.price.toLocaleString()}
                      </div>
                    </div>

                    {/* Brief description */}
                    <p className="text-xs text-brand-gray text-left leading-relaxed line-clamp-2">
                      {gig.description}
                    </p>

                    {/* Poster and Rating Row */}
                    <div className="flex items-center justify-between py-2 border-t border-b border-brand-light-gray/45 text-[11px] text-brand-gray font-semibold">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewUserProfile?.(
                            gig.posterEmail || "",
                            toTitleCase(gig.posterName || "Poster"),
                            gig.posterAvatar || "",
                            "",
                            gig.isVerifiedPoster || false
                          );
                        }}
                        className="flex items-center gap-2 cursor-pointer hover:text-brand-primary active:scale-95 transition-all group/poster"
                        title={`View ${toTitleCase(gig.posterName || "Poster")}'s profile`}
                      >
                        <img 
                          src={getUserAvatarUrl(gig.posterAvatar, gig.posterEmail, gig.posterName)} 
                          alt={gig.posterName} 
                          className="w-5 h-5 rounded-full object-cover border border-brand-light-gray group-hover/poster:scale-105 transition-transform" 
                          onError={(e) => {
                            e.currentTarget.src = getUserAvatarUrl("", gig.posterEmail, gig.posterName);
                          }}
                        />
                        <span className="text-brand-dark font-bold text-xs group-hover/poster:underline group-hover/poster:text-brand-primary transition-colors flex items-center gap-1">
                          <span>{toTitleCase(gig.posterName || "Poster")}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[#e2c62d] font-extrabold bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200/50">
                        <span>★</span>
                        <span className="text-brand-dark text-xs">{gig.posterRating ?? "4.8"}</span>
                      </div>
                    </div>

                    {/* Buttons CTA block */}
                    <div className="grid grid-cols-2 gap-2.5 mt-2">
                      {(() => {
                        const isOwnGig =
                          currentUser &&
                          ((gig.posterEmail &&
                            gig.posterEmail === currentUser.email) ||
                            gig.posterName === currentUser.fullName);

                        if (isOwnGig) {
                          return (
                            <>
                              <div className="col-span-1 py-3 bg-slate-100 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center border border-slate-200">
                                Your Own Listing
                              </div>
                              <button
                                onClick={() => onSelectGig(gig)}
                                className="col-span-1 py-3 bg-brand-light-gray text-brand-dark hover:bg-brand-light-gray/80 font-bold text-xs rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-transform"
                              >
                                <span>Details</span>
                              </button>
                            </>
                          );
                        }

                        return (
                          <>
                            <button
                              onClick={() => handlePass(gig.id)}
                              className="col-span-1 py-3 border border-brand-outline/65 text-brand-gray hover:bg-brand-light-gray/20 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                            >
                              <X className="w-4 h-4 text-brand-gray/80" />
                              <span>Pass</span>
                            </button>
                            <button
                              onClick={() => onSelectGig(gig)}
                              className="col-span-1 py-3 bg-brand-light-gray text-brand-dark hover:bg-brand-light-gray/80 font-bold text-xs rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-transform"
                            >
                              <span>Details</span>
                            </button>
                            <button
                              onClick={() => {
                                if (!currentUser) {
                                  if (onRequireLogin) {
                                    onRequireLogin({
                                      type: 'negotiate',
                                      gigId: gig.id
                                    });
                                  } else {
                                    alert('Please create an account or sign in to negotiate listings.');
                                    onNavigate(ActiveView.PROFILE);
                                  }
                                  return;
                                }
                                setNegotiatingGig(gig);
                                setNegotiatePrice(gig.price.toString());
                              }}
                              className="col-span-1 py-3 border-2 border-brand-primary/20 hover:bg-brand-primary/5 text-brand-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Negotiate</span>
                            </button>
                            <button
                              onClick={() => {
                                if (!currentUser) {
                                  if (onRequireLogin) {
                                    onRequireLogin({
                                      type: 'express_interest',
                                      gigId: gig.id,
                                      proposedPrice: gig.price
                                    });
                                  } else {
                                    alert('Please create an account or sign in to express interest in listings.');
                                    onNavigate(ActiveView.PROFILE);
                                  }
                                  return;
                                }
                                onExpressInterest(gig.id).then(() => {
                                  const messageText = `Hi ${gig.posterName}, I am interested in your gig: "${gig.title}" for ₹${gig.price} on Qwick. Let me know when we can discuss!`;
                                  onOpenChat(
                                    gig,
                                    {
                                      email: gig.posterEmail || "",
                                      fullName: gig.posterName || "Poster",
                                      avatar: gig.posterAvatar || "",
                                    },
                                    messageText
                                  );
                                }).catch((err) => console.error("Error logging interest:", err));
                              }}
                              className="col-span-1 py-3 bg-brand-primary text-white hover:bg-brand-primary-hover font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-md shadow-brand-primary/20"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>I'm Interested</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </AnimatePresence>

        {/* In-App Negotiation Modal Overlay */}
        <AnimatePresence>
          {negotiatingGig && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setNegotiatingGig(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 border border-brand-light-gray shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center pb-2 border-b border-brand-light-gray">
                  <h3 className="font-extrabold text-sm text-brand-dark">
                    Negotiate Price
                  </h3>
                  <button
                    onClick={() => setNegotiatingGig(null)}
                    className="p-1 rounded-full hover:bg-brand-light-gray"
                  >
                    <X className="w-4 h-4 text-brand-gray" />
                  </button>
                </div>

                <div className="text-left">
                  <p className="text-[10px] text-brand-primary uppercase font-bold tracking-wider">
                    Gig Title
                  </p>
                  <p className="text-xs font-bold text-brand-dark mt-0.5 line-clamp-1">
                    {negotiatingGig.title}
                  </p>
                  <p className="text-[11px] text-brand-gray mt-1">
                    Current Offer: ₹{negotiatingGig.price.toLocaleString()}
                  </p>
                </div>

                <form
                  onSubmit={handleNegotiateSubmit}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-brand-gray">
                      Your Bid (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 font-extrabold text-brand-primary text-sm">
                        ₹
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9,]*"
                        value={negotiatePrice}
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          const cleanVal = rawVal.replace(/[^0-9]/g, "");
                          if (cleanVal === "") {
                            setNegotiatePrice("");
                            return;
                          }
                          const numVal = parseInt(cleanVal, 10);
                          if (numVal < 0 || numVal > 10000000) return;
                          setNegotiatePrice(numVal.toLocaleString("en-IN"));
                        }}
                        className="w-full h-11 bg-brand-light-gray/50 border border-brand-outline rounded-xl pl-8 pr-4 text-xs font-extrabold focus:outline-none focus:border-brand-primary"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-brand-primary text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 hover:bg-brand-primary-hover active:scale-95 transition-all mt-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Submit & Open Chat</span>
                  </button>
                  <p className="text-[10px] text-center text-brand-gray leading-normal">
                    By submitting, we open a direct chat thread with the
                    poster containing your counter-offer.
                  </p>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
