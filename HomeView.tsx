/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { PlusCircle, ArrowRight, MapPin, Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";
import { ActiveView, Gig, User, getUserAvatarUrl } from "../types";
import { calculateHaversineDistance, getCoordsForSuburb, getEffectiveUserLocation, resolveCityAndCoordinates } from "../utils/distance";
import { getCategoryGraphic, getFallbackSvg } from "../utils/graphic";
import { toTitleCase } from "../utils/stringUtils";

interface HomeViewProps {
  onNavigate: (view: ActiveView) => void;
  gigs: Gig[];
  onSelectGig: (gig: Gig) => void;
  onSelectCategory: (category: string) => void;
  user?: User | null;
  isLoading?: boolean;
  onViewUserProfile?: (
    email: string,
    fullName: string,
    avatar?: string,
    bio?: string,
    isVerified?: boolean
  ) => void;
}

export default function HomeView({
  onNavigate,
  gigs,
  onSelectGig,
  onSelectCategory,
  user,
  isLoading = false,
  onViewUserProfile,
}: HomeViewProps) {
  // User Location (start as null to avoid calculating distance if location settings are not turned on)
  const [userLoc, setUserLoc] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLoc({ lat, lng });
          console.log(`HomeView: Detected user location: (${lat}, ${lng})`);
        },
        (error) => {
          console.log("Geolocation error or denied in HomeView:", error);
          setUserLoc(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setUserLoc(null);
    }
  }, []);

  const getDistance = (gig: Gig) => {
    const isOwnGig = user && (
      (gig.posterEmail && gig.posterEmail === user.email) ||
      gig.posterName === user.fullName
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

  // Filter for highlights (e.g. show first 3 active open gigs)
  const highlights = gigs.filter((gig) => {
    // Check if the gig has been passed/dismissed by the user
    let isPassed = false;
    try {
      const saved = localStorage.getItem("qwick_passed_gigs");
      if (saved) {
        const passedIds = JSON.parse(saved);
        if (Array.isArray(passedIds) && passedIds.includes(gig.id)) {
          isPassed = true;
        }
      }
    } catch (e) {
      console.error("Error checking passed gigs in highlights", e);
    }

    // Must be open, not closed, not passed
    const isOpen = !gig.isClosed && (gig.status === "Open" || !gig.status);
    return isOpen && !isPassed;
  }).slice(0, 3);

  return (
    <div className="w-full min-h-screen bg-brand-bg pt-3 pb-28">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-6">
        {/* Animated Greeting Card */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6 flex flex-col items-center gap-3 bg-white rounded-3xl p-6 border border-brand-light-gray shadow-sm"
        >
          <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center border border-brand-primary/10 relative animate-fade-in">
            {user ? (
              <img
                src={getUserAvatarUrl(user.avatar, user.email, user.fullName)}
                alt="User Avatar"
                className="w-16 h-16 rounded-full object-cover shadow-sm"
              />
            ) : (
              <span className="text-4xl animate-bounce">👋</span>
            )}
            <div className="absolute inset-0 bg-brand-primary/5 rounded-full animate-ping pointer-events-none" />
          </div>
          <h2 className="text-2xl font-black text-brand-dark">
            Hi, {user ? toTitleCase(user.fullName) : "neighbor"}!
          </h2>
          <p className="text-xs text-brand-gray max-w-[280px] mx-auto leading-relaxed">
            Need a hand or want to lend one? Connect with locals to get everyday
            tasks done.
          </p>
        </motion.section>

        {/* Primary Operational Actions */}
        <section className="flex flex-col gap-3">
          {/* Post gig */}
          <button
            onClick={() => onNavigate(ActiveView.POST)}
            className="w-full h-16 bg-brand-primary text-white rounded-2xl flex items-center justify-between px-6 shadow-md shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-98 transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-white">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-sm">Post a Gig</p>
                <p className="text-[10px] text-brand-light-gray/80 font-medium">
                  Get local help fast
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Do a gig */}
          <button
            onClick={() => {
              onSelectCategory(""); // Show all
              onNavigate(ActiveView.FEED);
            }}
            className="w-full h-16 bg-brand-mint text-brand-mint-dark rounded-2xl flex items-center justify-between px-6 border border-brand-mint-dark/10 shadow-sm active:scale-98 transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-brand-mint-dark/15 rounded-xl flex items-center justify-center font-bold text-brand-mint-dark">
                <span className="text-lg">🛠️</span>
              </div>
              <div>
                <p className="font-extrabold text-sm">Do a Gig</p>
                <p className="text-[10px] text-brand-mint-dark/80 font-medium">
                  Earn money in your area
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-brand-mint-dark/80 group-hover:translate-x-1 transition-transform" />
          </button>
        </section>

        {/* Nearby Highlights Listings with Details trigger links */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-base text-brand-dark flex items-center gap-1.5">
              <span>Nearby Highlights</span>
              <Sparkles className="w-4 h-4 text-brand-primary fill-brand-primary" />
            </h3>
            <button
              onClick={() => {
                onSelectCategory("");
                onNavigate(ActiveView.FEED);
              }}
              className="text-brand-primary font-bold text-xs flex items-center gap-1 hover:opacity-80"
            >
              <span>See all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {isLoading ? (
              // Beautiful Skeleton Cards
              <div className="flex flex-col gap-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white p-4 rounded-2xl border border-brand-light-gray/80 flex flex-col gap-3 relative overflow-hidden shadow-sm"
                  >
                    {/* Price Tag Skeleton */}
                    <div className="absolute top-4 right-4 bg-gray-200 h-7 w-16 rounded-lg" />

                    <div className="flex gap-3 items-start pr-14">
                      {/* Image Skeleton */}
                      <div className="w-16 h-16 rounded-xl bg-gray-200 flex-shrink-0" />

                      <div className="flex flex-col gap-2 mt-1">
                        {/* Title Skeleton */}
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                        {/* Suburb/Distance Skeleton */}
                        <div className="h-3 w-24 bg-gray-200 rounded" />
                      </div>
                    </div>

                    {/* Description Skeletons */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="h-3 w-full bg-gray-200 rounded" />
                      <div className="h-3 w-5/6 bg-gray-200 rounded" />
                    </div>

                    {/* Footer Avatar & Rating Skeleton */}
                    <div className="flex items-center justify-between py-2 border-t border-brand-light-gray/40 mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-gray-200" />
                        <div className="h-3 w-16 bg-gray-200 rounded" />
                      </div>
                      <div className="h-3 w-8 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : highlights.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-3xl border border-brand-light-gray shadow-sm text-xs text-brand-gray">
                No active gigs listed yet. Be the first to list!
              </div>
            ) : (
              highlights.map((gig) => (
                <div
                  key={gig.id}
                  onClick={() => onSelectGig(gig)}
                  className="bg-white p-4 rounded-2xl border border-brand-light-gray/80 flex flex-col gap-3 relative overflow-hidden shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <div className="absolute top-4 right-4 bg-brand-mint text-brand-mint-dark font-extrabold text-xs px-3 py-1.5 rounded-lg border border-brand-mint-dark/10 z-10 shadow-sm">
                    ₹{gig.price.toLocaleString()}
                  </div>

                  <div className="flex gap-3 items-start pr-14">
                    <img
                      src={
                        (!gig.imageUrl || gig.imageUrl.trim() === "" || gig.imageUrl === "null" || gig.imageUrl === "undefined")
                          ? getCategoryGraphic(gig.category, gig.title)
                          : gig.imageUrl
                      }
                      alt={gig.title}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-brand-light-gray"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = getFallbackSvg(gig.category, gig.title);
                      }}
                    />

                    <div className="flex flex-col">
                      <h4 className="font-bold text-sm text-brand-dark group-hover:text-brand-primary leading-snug line-clamp-1 transition-colors">
                        {gig.title}
                      </h4>
                      <div className="flex items-center gap-1 text-brand-gray text-[11px] mt-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-brand-primary" />
                        <span>
                          {user && (
                            (gig.posterEmail && gig.posterEmail === user.email) ||
                            gig.posterName === user.fullName
                          ) ? (
                            <span className="text-brand-primary font-bold">Your gig • {gig.suburb}</span>
                          ) : getDistance(gig) !== null ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-brand-accent font-extrabold">{getDistance(gig)} km away</span>
                              <span className="text-brand-gray/40">•</span>
                              <span className="text-brand-gray">{gig.suburb}</span>
                            </span>
                          ) : (
                            <span>{gig.suburb}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-brand-gray line-clamp-2 leading-relaxed">
                    {gig.description}
                  </p>

                  {/* Poster details and rating */}
                  <div className="flex items-center justify-between py-1.5 border-t border-brand-light-gray/40 text-[10px] text-brand-gray font-semibold mt-1">
                    <span 
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
                      className="text-brand-dark font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:text-brand-primary active:scale-95 transition-all group/poster"
                      title={`View ${toTitleCase(gig.posterName || "Poster")}'s profile`}
                    >
                      <img 
                        src={getUserAvatarUrl(gig.posterAvatar, gig.posterEmail, gig.posterName)} 
                        alt={gig.posterName} 
                        className="w-4 h-4 rounded-full object-cover group-hover/poster:scale-105 transition-transform" 
                      />
                      <span className="group-hover/poster:underline group-hover/poster:text-brand-primary transition-colors flex items-center gap-1">
                        <span>{toTitleCase(gig.posterName || "Poster")}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[#e2c62d] font-bold">
                      ★ <span className="text-brand-dark">{gig.posterRating ?? "4.8"}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Ambient safety assurance banner */}
        {!user?.isVerified && (
          <section className="bg-brand-mint/20 border border-brand-mint/40 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <p className="font-bold text-xs text-brand-mint-dark">
                  Safety First Guarantee
                </p>
                <p className="text-[10px] text-brand-mint-dark/80">
                  Every neighbor is Aadhaar identity-verified.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate(ActiveView.PROFILE)}
              className="text-xs font-bold text-white bg-brand-mint-dark px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              Verify
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
