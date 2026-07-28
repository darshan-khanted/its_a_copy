/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  MessageSquare, 
  ShieldAlert, 
  Navigation, 
  Phone, 
  MessageCircle, 
  Share2, 
  Check, 
  X, 
  Star, 
  AlertCircle,
  Award,
  ChevronRight,
  ShieldCheck,
  Image,
  Maximize2
} from 'lucide-react';
import { ActiveView, Gig, User, Review, GigStatus, InterestedUser, getUserAvatarUrl } from '../types';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { getCoordsForSuburb, getEffectiveUserLocation, calculateHaversineDistance, resolveCityAndCoordinates } from '../utils/distance';
import { getCategoryGraphic, getFallbackSvg } from '../utils/graphic';
import { formatToDDMMYY, formatTimestampToDDMMYY } from '../utils/date';
import { toTitleCase } from '../utils/stringUtils';

const API_KEY =
  import.meta.env.GOOGLE_MAPS_API_KEY ||
  import.meta.env.GOOGLE_MAPS_PLATFORM_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

interface DetailsViewProps {
  gig: Gig;
  onNavigate: (view: ActiveView) => void;
  onExpressInterest: (gigId: string, proposedPrice?: number) => Promise<void>;
  onSelectWorker: (gigId: string, worker: InterestedUser, finalPrice: number) => Promise<void>;
  onCompleteGig: (gigId: string) => Promise<void>;
  onCancelGig: (gigId: string) => Promise<void>;
  currentUser?: User | null;
  onRateUser?: (email: string, ratingValue: number, comment?: string, relatedId?: string) => Promise<void>;
  reviews?: Review[];
  onOpenChat: (
    gig: Gig,
    otherUser: { email: string; fullName: string; avatar: string },
    initialMessage?: string
  ) => void;
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

export default function DetailsView({
  gig,
  onNavigate,
  onExpressInterest,
  onSelectWorker,
  onCompleteGig,
  onCancelGig,
  currentUser,
  onRateUser,
  reviews = [],
  onOpenChat,
  onViewUserProfile,
  onRequireLogin,
}: DetailsViewProps) {
  const [showDirections, setShowDirections] = useState<boolean>(false);
  const [showAllReviewsPage, setShowAllReviewsPage] = useState<boolean>(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState<boolean>(false);
  const [proposedPrice, setProposedPrice] = useState<string>(gig.price.toString());
  const [mapLoadError, setMapLoadError] = useState<boolean>(false);

  const [userLoc, setUserLoc] = useState<{
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
        },
        (error) => {
          console.warn("DetailsView: Geolocation error:", error);
        }
      );
    }
  }, []);

  const currentCity = localStorage.getItem("qwick_currentCity") || "Bengaluru";
  const effectiveLoc = getEffectiveUserLocation(userLoc, currentCity);
  const gigCity = gig.city || currentCity;
  
  // Use our robust local resolver for coordinate safety if they are missing
  const localResolution = resolveCityAndCoordinates(gig.locationName || "", gig.suburb || "", gigCity);
  const gigLat = gig.lat !== undefined && gig.lat !== null ? gig.lat : localResolution.lat;
  const gigLng = gig.lng !== undefined && gig.lng !== null ? gig.lng : localResolution.lng;
  const calculatedDistance = calculateHaversineDistance(effectiveLoc.lat, effectiveLoc.lng, gigLat, gigLng);
  
  // We prefer searching Google Maps by the precise address string entered in the gig post,
  // falling back to coordinates if the address is missing.
  // This ensures Google Maps resolves the exact user-typed location name perfectly!
  const addressQueryString = gig.locationName 
    ? `${gig.locationName}${gig.suburb ? ', ' + gig.suburb : ''}${gigCity ? ', ' + gigCity : ''}`
    : '';
  const mapQuery = addressQueryString 
    ? encodeURIComponent(addressQueryString)
    : `${gigLat},${gigLng}`;

  // Rating states
  const [formRating, setFormRating] = useState<number>(5);
  const [formComment, setFormComment] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  // Worker selection states
  const [selectedInterestedWorker, setSelectedInterestedWorker] = useState<InterestedUser | null>(null);
  const [agreedPriceInput, setAgreedPriceInput] = useState<string>("");
  const [isSubmittingWorkerSelection, setIsSubmittingWorkerSelection] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [isFullscreenPhotoOpen, setIsFullscreenPhotoOpen] = useState<boolean>(false);

  const gigStatus: GigStatus = gig.status || 'Open';
  const isAcceptedFromBothEnds = gig.isAccepted || gigStatus === 'In Progress' || gigStatus === 'Completed';

  const handleOpenGoogleMapsDirections = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    window.open(url, '_blank');
  };
  
  const isOwnGig = currentUser && (
    (gig.posterEmail && gig.posterEmail === currentUser.email) ||
    gig.posterName === currentUser.fullName
  );

  // Filter reviews left for the poster of this gig
  const posterReviews = reviews.filter((r) => r.targetEmail === gig.posterEmail);
  const posterRating = posterReviews.length > 0
    ? parseFloat((posterReviews.reduce((sum, r) => sum + r.rating, 0) / posterReviews.length).toFixed(1))
    : (gig.posterRating ?? 4.8);
  
  // Check if current user has already expressed interest
  const hasExpressedInterest = currentUser && (gig.interestedUsers || []).some(u => u.email === currentUser.email);
  const userInterestDetails = currentUser 
    ? (gig.interestedUsers || []).find(u => u.email === currentUser.email)
    : null;

  // Check if current user has reviewed the counterpart for this gig
  const hasCurrentUserReviewedCounterpart = currentUser && reviews.some(
    (r) => r.relatedId === gig.id && r.reviewerEmail === currentUser.email
  );

  const handleInterestClick = async () => {
    if (!currentUser) {
      if (onRequireLogin) {
        onRequireLogin({
          type: 'express_interest',
          gigId: gig.id,
          proposedPrice: gig.price
        });
      } else {
        alert('Please sign in or complete onboarding to express interest in listings.');
        onNavigate(ActiveView.PROFILE);
      }
      return;
    }
    
    try {
      await onExpressInterest(gig.id, gig.price);
      
      const messageText = `Hi ${gig.posterName}, I am interested in your gig: "${gig.title}" for ₹${gig.price} posted on Qwick. Let me know when we can discuss!`;
      
      onOpenChat(
        gig,
        {
          email: gig.posterEmail || "",
          fullName: gig.posterName || "Poster",
          avatar: gig.posterAvatar || "",
        },
        messageText
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleNegotiateClick = () => {
    if (!currentUser) {
      if (onRequireLogin) {
        onRequireLogin({
          type: 'negotiate',
          gigId: gig.id
        });
      } else {
        alert('Please sign in or complete onboarding to negotiate listings.');
        onNavigate(ActiveView.PROFILE);
      }
      return;
    }
    setProposedPrice(gig.price.toString());
    setShowNegotiationModal(true);
  };

  const handleSendNegotiation = async () => {
    const priceNum = parseInt(proposedPrice, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter a valid price greater than zero.');
      return;
    }

    try {
      setShowNegotiationModal(false);
      await onExpressInterest(gig.id, priceNum);
      
      const messageText = `Hi ${gig.posterName}, I am interested in your gig: "${gig.title}" posted on Qwick, and I would like to propose a price of ₹${priceNum}. Let me know if that works!`;
      
      onOpenChat(
        gig,
        {
          email: gig.posterEmail || "",
          fullName: gig.posterName || "Poster",
          avatar: gig.posterAvatar || "",
        },
        messageText
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmSelectWorker = async () => {
    if (!selectedInterestedWorker) return;
    const finalPrice = parseInt(agreedPriceInput, 10);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      alert("Please enter a valid agreed price.");
      return;
    }

    setIsSubmittingWorkerSelection(true);
    try {
      await onSelectWorker(gig.id, selectedInterestedWorker, finalPrice);
      
      // Open in-app chat thread with selected worker
      const messageText = `Hi ${selectedInterestedWorker.fullName}, I have selected you as the worker for my gig "${gig.title}" on Qwick for the agreed final price of ₹${finalPrice}! Let's coordinate here.`;
      
      onOpenChat(
        gig,
        {
          email: selectedInterestedWorker.email,
          fullName: selectedInterestedWorker.fullName,
          avatar: selectedInterestedWorker.avatar,
        },
        messageText
      );
      
      setSelectedInterestedWorker(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingWorkerSelection(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!formComment.trim()) {
      alert("Please write a short review comment.");
      return;
    }
    if (!onRateUser) return;

    setIsSubmittingRating(true);
    try {
      // If poster is rating the selected worker
      if (isOwnGig && gig.selectedWorker) {
        await onRateUser(gig.selectedWorker.email, formRating, formComment, gig.id);
        await onCompleteGig(gig.id);
        alert(`Gig successfully completed! Your rating for ${gig.selectedWorker.fullName} has been submitted.`);
      } 
      // If selected worker is rating the poster
      else if (currentUser && gig.selectedWorker?.email === currentUser.email) {
        await onRateUser(gig.posterEmail || "", formRating, formComment, gig.id);
        alert(`Thank you! Your rating for poster ${gig.posterName} has been submitted.`);
      }
      setFormComment("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Status Badge UI configuration
  const getStatusBadge = () => {
    switch (gigStatus) {
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] uppercase font-extrabold px-3 py-1 rounded-full border border-blue-200">
            In Progress
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[10px] uppercase font-extrabold px-3 py-1 rounded-full border border-purple-200">
            Completed 🎉
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] uppercase font-extrabold px-3 py-1 rounded-full border border-red-200">
            Cancelled
          </span>
        );
      case 'Open':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] uppercase font-extrabold px-3 py-1 rounded-full border border-emerald-200">
            Live & Open
          </span>
        );
    }
  };

  if (showAllReviewsPage) {
    return (
      <div className="w-full min-h-screen bg-brand-bg pt-3 pb-32 text-left">
        <div className="max-w-md mx-auto px-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 py-2">
            <button
              onClick={() => setShowAllReviewsPage(false)}
              className="p-2 px-3 rounded-xl bg-white border border-brand-light-gray/80 text-brand-primary hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-black shadow-sm cursor-pointer"
            >
              <span>← Back to Gig Details</span>
            </button>
          </div>

          <div className="bg-white border border-brand-light-gray/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 rounded-full border border-brand-light-gray overflow-hidden shrink-0 shadow-sm">
              <img 
                src={getUserAvatarUrl(gig.posterAvatar, gig.posterEmail, gig.posterName)} 
                alt={gig.posterName} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.currentTarget.src = getUserAvatarUrl("", gig.posterEmail, gig.posterName);
                }}
              />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-brand-dark">{toTitleCase(gig.posterName)}</h3>
              <p className="text-[10px] text-brand-gray mt-0.5 font-bold">Community Member Feedback</p>
              <div className="flex items-center text-[#e2c62d] gap-1.5 mt-1">
                <span className="text-xs font-extrabold text-brand-dark">★ {posterRating.toFixed(1)}</span>
                <span className="text-[10px] text-brand-gray font-bold">
                  ({currentUser ? posterReviews.length : (gig.posterRatingCount ?? 5)} reviews)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-brand-light-gray/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
            <div className="pb-2 border-b border-brand-light-gray/40 flex justify-between items-center">
              <h3 className="font-black text-xs text-brand-dark uppercase tracking-wider">All Feedbacks</h3>
              <span className="text-[10px] font-black text-brand-primary bg-brand-primary/10 px-2.5 py-1 rounded-full border border-brand-primary/5">
                {currentUser ? `${posterReviews.length} Reviews` : "Private"}
              </span>
            </div>

            {!currentUser ? (
              <div className="text-center py-12 bg-amber-50/30 rounded-2xl border border-dashed border-amber-200">
                <span className="text-4xl block mb-2 opacity-80">🔒</span>
                <p className="text-xs font-black text-amber-800">Reviews are Private</p>
                <p className="text-[10px] text-amber-700/80 mt-1 max-w-[280px] mx-auto font-semibold leading-relaxed">
                  Please sign in to view detailed community feedback text and ratings from past collaborations.
                </p>
              </div>
            ) : posterReviews.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-2 opacity-60">✍️</span>
                <p className="text-xs font-black text-brand-gray">No reviews posted yet.</p>
                <p className="text-[10px] text-brand-gray/70 mt-1">Complete a gig to leave feedback for {gig.posterName}!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {posterReviews.map((rev) => (
                  <div key={rev.id} className="border-b border-brand-light-gray/30 pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <img 
                          src={getUserAvatarUrl(rev.reviewerAvatar, rev.reviewerEmail, rev.reviewerName)} 
                          alt={rev.reviewerName} 
                          className="w-7 h-7 rounded-full border border-brand-light-gray shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = getUserAvatarUrl("", rev.reviewerEmail, rev.reviewerName);
                          }}
                        />
                        <div>
                          <span className="font-extrabold text-brand-dark block text-[11px]">{rev.reviewerName}</span>
                          <span className="text-[9px] text-brand-gray/60 block font-medium">
                            {formatTimestampToDDMMYY(rev.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex text-[#e2c62d]">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <span key={idx} className="text-sm">
                            {idx < rev.rating ? "★" : "☆"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-brand-gray/90 leading-relaxed bg-brand-bg/60 p-3 rounded-xl italic border border-brand-light-gray/20">
                      "{rev.comment}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-brand-bg pt-3 pb-32">
      {/* Hero Header Area */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-brand-dark">
        <img
          src={getCategoryGraphic(gig.category, gig.title)}
          alt={gig.title}
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = getFallbackSvg(gig.category, gig.title);
          }}
        />
        
        {/* Floating details box */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white/25 shadow-xl flex justify-between items-center text-left">
            <div>
              <div className="flex gap-1.5 flex-wrap mb-1">
                {gig.urgent && (
                  <div className="inline-flex items-center gap-1 bg-brand-mint text-brand-mint-dark text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full">
                    <span className="w-2 h-2 bg-brand-mint-dark rounded-full animate-ping mr-1" />
                    Urgent
                  </div>
                )}
                {getStatusBadge()}
              </div>
              <h2 className="text-base font-extrabold text-brand-dark leading-tight">{gig.title}</h2>
            </div>
            <div className="bg-brand-mint text-brand-mint-dark px-3 py-1.5 rounded-xl font-extrabold text-sm border border-brand-mint-dark/10">
              ₹{gig.price.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-4 flex flex-col gap-4">
        
        {/* Poster Bio Block */}
        <section 
          onClick={() => {
            if (onViewUserProfile) {
              onViewUserProfile(
                gig.posterEmail || "",
                toTitleCase(gig.posterName || "Poster"),
                gig.posterAvatar || "",
                "", // bio fetched inside the modal
                gig.isVerifiedPoster || false
              );
            } else {
              setShowAllReviewsPage(true);
            }
          }}
          className="bg-white p-5 rounded-2xl border border-brand-light-gray/80 text-left flex gap-4 items-center cursor-pointer hover:bg-slate-50/70 hover:shadow-sm transition-all duration-200 active:scale-[0.99] group"
        >
          <img
            src={getUserAvatarUrl(gig.posterAvatar, gig.posterEmail, gig.posterName)}
            alt={gig.posterName}
            className="w-12 h-12 rounded-2xl object-cover border border-brand-light-gray shrink-0 shadow-sm group-hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.src = getUserAvatarUrl("", gig.posterEmail, gig.posterName);
            }}
          />
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-extrabold uppercase text-brand-primary tracking-wider block mb-0.5">Gig Poster</span>
            <h4 className="font-extrabold text-xs text-brand-dark flex items-center gap-1 truncate group-hover:text-brand-primary transition-colors">
              {toTitleCase(gig.posterName)}
              {gig.isVerifiedPoster ? (
                <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ml-1.5 shrink-0">
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ml-1.5 shrink-0">
                  <ShieldAlert className="w-2.5 h-2.5" /> Unverified
                </span>
              )}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-brand-dark">★ {posterRating.toFixed(1)}</span>
              <span className="text-[10px] text-brand-gray font-bold">({posterReviews.length} reviews)</span>
            </div>
          </div>
          <button 
            type="button"
            className="p-2 hover:bg-brand-light-gray/50 rounded-xl transition-all"
            aria-label="View poster profile"
          >
            <ChevronRight className="w-5 h-5 text-brand-gray group-hover:translate-x-0.5 transition-transform" />
          </button>
        </section>

        {/* WORKER SELECTION / PROGRESS BOARD (For Poster & Selected Worker) */}
        {(isOwnGig || (currentUser && gig.selectedWorker && gig.selectedWorker.email === currentUser.email)) && (
          <section className="bg-white p-5 rounded-2xl border border-brand-light-gray/80 text-left flex flex-col gap-3 shadow-sm">
            <h3 className="font-extrabold text-sm text-brand-dark flex items-center gap-1.5">
              <Award className="w-4 h-4 text-brand-primary" />
              <span>{isOwnGig ? "Poster Control Room" : "Worker Control Room"}</span>
            </h3>

            {gigStatus === 'Open' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-brand-light-gray/30">
                  <span className="text-xs font-bold text-brand-gray">Interested Workers ({ (gig.interestedUsers || []).length })</span>
                </div>

                {(!gig.interestedUsers || gig.interestedUsers.length === 0) ? (
                  <div className="text-center py-6 border-2 border-dashed border-brand-light-gray/50 rounded-xl">
                    <span className="text-2xl block mb-1">⏳</span>
                    <p className="text-xs font-bold text-brand-gray">No users expressed interest yet.</p>
                    <p className="text-[10px] text-brand-gray/60">Other members will see your listing in their feed.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {gig.interestedUsers.map((worker) => {
                      const workerName = toTitleCase(worker.fullName);
                      const workerAvatarUrl = getUserAvatarUrl(worker.avatar, worker.email, worker.fullName);
                      return (
                        <div key={worker.email} className="p-3.5 bg-slate-50 border border-brand-light-gray/40 rounded-xl flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <img 
                              src={workerAvatarUrl} 
                              alt={workerName} 
                              onClick={() => onViewUserProfile?.(
                                worker.email,
                                workerName,
                                workerAvatarUrl,
                                worker.bio,
                                worker.isVerified
                              )}
                              className="w-10 h-10 rounded-full border border-brand-light-gray shrink-0 cursor-pointer hover:scale-105 hover:opacity-90 active:scale-95 transition-all" 
                              title={`View ${workerName}'s profile`}
                              onError={(e) => {
                                e.currentTarget.src = getUserAvatarUrl("", worker.email, workerName);
                              }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span 
                                  onClick={() => onViewUserProfile?.(
                                    worker.email,
                                    workerName,
                                    workerAvatarUrl,
                                    worker.bio,
                                    worker.isVerified
                                  )}
                                  className="text-xs font-extrabold text-brand-dark cursor-pointer hover:text-brand-primary hover:underline transition-all"
                                  title={`View ${workerName}'s profile`}
                                >
                                  {workerName}
                                </span>
                                {worker.isVerified ? (
                                  <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">
                                    ✓ Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">
                                    ✗ Unverified
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] text-brand-gray font-bold">
                                  Bid: <strong className="text-brand-primary text-xs font-black ml-0.5">₹{(worker.proposedPrice || gig.price).toLocaleString()}</strong>
                                </span>
                                {worker.bio && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[10px] text-brand-gray/80 truncate max-w-[150px]">{worker.bio}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              const initialMsg = `Hi ${workerName}, I saw your interest in my gig "${gig.title}" with a proposed price of ₹${(worker.proposedPrice || gig.price).toLocaleString()}. Let's coordinate here!`;
                              onOpenChat(
                                gig,
                                {
                                  email: worker.email,
                                  fullName: workerName,
                                  avatar: worker.avatar,
                                },
                                initialMsg
                              );
                            }}
                            className="border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-extrabold px-3 py-2 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm shrink-0 bg-white"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            <span>View in Chat</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {gigStatus === 'In Progress' && gig.selectedWorker && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  {isOwnGig ? (
                    // Poster views Selected Worker
                    <div className="flex gap-2.5 items-center mb-2">
                      <img 
                        src={getUserAvatarUrl(gig.selectedWorker.avatar, gig.selectedWorker.email, gig.selectedWorker.fullName)} 
                        alt={toTitleCase(gig.selectedWorker.fullName)} 
                        onClick={() => onViewUserProfile?.(
                          gig.selectedWorker!.email,
                          toTitleCase(gig.selectedWorker!.fullName),
                          getUserAvatarUrl(gig.selectedWorker!.avatar, gig.selectedWorker!.email, gig.selectedWorker!.fullName),
                          gig.selectedWorker!.bio,
                          gig.selectedWorker!.isVerified
                        )}
                        className="w-10 h-10 rounded-full border border-blue-100 cursor-pointer hover:scale-105 hover:opacity-90 active:scale-95 transition-all"
                        title={`View ${toTitleCase(gig.selectedWorker.fullName)}'s profile`}
                      />
                      <div>
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-blue-700 block">Selected Worker</span>
                        <h4 
                          onClick={() => onViewUserProfile?.(
                            gig.selectedWorker!.email,
                            toTitleCase(gig.selectedWorker!.fullName),
                            gig.selectedWorker!.avatar,
                            gig.selectedWorker!.bio,
                            gig.selectedWorker!.isVerified
                          )}
                          className="font-extrabold text-xs text-brand-dark flex items-center gap-1 cursor-pointer hover:text-brand-primary hover:underline transition-all"
                          title={`View ${toTitleCase(gig.selectedWorker.fullName)}'s profile`}
                        >
                          {toTitleCase(gig.selectedWorker.fullName)}
                          {gig.selectedWorker.isVerified ? (
                            <span className="text-green-600 text-[10px]" title="Verified">✓ Verified</span>
                          ) : (
                            <span className="text-red-500 text-[10px]" title="Unverified">✗ Unverified</span>
                          )}
                        </h4>
                      </div>
                    </div>
                  ) : (
                    // Worker views Poster
                    <div className="flex gap-2.5 items-center mb-2">
                      <img 
                        src={getUserAvatarUrl(gig.posterAvatar, gig.posterEmail, gig.posterName)} 
                        alt={gig.posterName} 
                        onClick={() => onViewUserProfile?.(
                          gig.posterEmail || "",
                          gig.posterName || "Poster",
                          getUserAvatarUrl(gig.posterAvatar, gig.posterEmail, gig.posterName),
                          "",
                          gig.isVerifiedPoster || false
                        )}
                        className="w-10 h-10 rounded-full border border-blue-100 cursor-pointer hover:scale-105 hover:opacity-90 active:scale-95 transition-all"
                        title={`View poster ${gig.posterName || 'Poster'}'s profile`}
                      />
                      <div>
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-blue-700 block">Gig Poster</span>
                        <h4 
                          onClick={() => onViewUserProfile?.(
                            gig.posterEmail || "",
                            toTitleCase(gig.posterName || "Poster"),
                            gig.posterAvatar || "",
                            "",
                            gig.isVerifiedPoster || false
                          )}
                          className="font-extrabold text-xs text-brand-dark flex items-center gap-1 cursor-pointer hover:text-brand-primary hover:underline transition-all"
                          title={`View poster ${toTitleCase(gig.posterName || 'Poster')}'s profile`}
                        >
                          {toTitleCase(gig.posterName)}
                          {gig.isVerifiedPoster ? (
                            <span className="text-green-600 text-[10px]" title="Verified">✓ Verified</span>
                          ) : (
                            <span className="text-red-500 text-[10px]" title="Unverified">✗ Unverified</span>
                          )}
                        </h4>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const chatPartner = isOwnGig && gig.selectedWorker
                        ? {
                            email: gig.selectedWorker.email,
                            fullName: gig.selectedWorker.fullName,
                            avatar: gig.selectedWorker.avatar || "",
                          }
                        : {
                            email: gig.posterEmail || "",
                            fullName: gig.posterName || "Poster",
                            avatar: gig.posterAvatar || "",
                          };
                      const message = isOwnGig && gig.selectedWorker
                        ? `Hi ${gig.selectedWorker.fullName}, coordinating on our in-progress assignment "${gig.title}".`
                        : `Hi ${gig.posterName}, coordinating on our in-progress assignment "${gig.title}".`;
                      
                      onOpenChat(gig, chatPartner, message);
                    }}
                    className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open Chat Thread</span>
                  </button>
                </div>

                {/* Mark as Completed & Rate Block */}
                {!hasCurrentUserReviewedCounterpart ? (
                  <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl space-y-3">
                    <h4 className="text-xs font-black text-purple-900 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      <span>{isOwnGig ? "Complete Work & Rate Worker" : "Complete Work & Rate Poster"}</span>
                    </h4>
                    <p className="text-[10px] text-purple-800 leading-relaxed">
                      {isOwnGig ? (
                        <>Please leave a star rating and verified feedback for <strong>{gig.selectedWorker.fullName}</strong> to complete this assignment.</>
                      ) : (
                        <>Please leave a star rating and verified feedback for poster <strong>{gig.posterName}</strong> once the task is completed.</>
                      )}
                    </p>

                    <div className="flex items-center gap-1 pb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setFormRating(star)}
                          className={`text-2xl transition-all cursor-pointer ${
                            star <= formRating ? 'text-amber-500 scale-105' : 'text-purple-300'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={formComment}
                      onChange={(e) => setFormComment(e.target.value)}
                      placeholder={isOwnGig ? "Write an honest, real review about the worker's diligence, speed, and communication..." : "Write an honest, real review about the poster's guidance, support, and clarity..."}
                      className="w-full h-16 p-2 bg-white border border-purple-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-purple-300"
                    />

                    <button
                      onClick={handleSubmitRating}
                      disabled={isSubmittingRating}
                      className="w-full bg-purple-700 hover:bg-purple-800 text-white font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all"
                    >
                      {isSubmittingRating ? "Submitting..." : isOwnGig ? "Submit Review & Close Gig" : "Submit Review for Poster"}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-purple-50 border border-purple-200 text-center rounded-xl text-purple-800 font-bold text-xs">
                    {isOwnGig ? (
                      <>
                        You have reviewed this assignment. Marking as Completed...
                        <button onClick={() => onCompleteGig(gig.id)} className="w-full bg-purple-700 text-white font-bold py-2 mt-2 rounded-lg">
                          Finalize Completion
                        </button>
                      </>
                    ) : (
                      <>You have successfully submitted your review for this gig poster! Thank you for your feedback.</>
                    )}
                  </div>
                )}
              </div>
            )}

            {gigStatus === 'Completed' && (
              <div className="p-4 bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold rounded-xl text-center flex flex-col items-center gap-1">
                <span className="text-2xl">🎉</span>
                <span>This gig has been completed successfully offline!</span>
                <p className="text-[10px] text-purple-600 mt-1 font-medium">Thank you for fostering transparency on Qwick!</p>
              </div>
            )}

            {gigStatus === 'Cancelled' && (
              <div className="p-4 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl text-center">
                <span>This listing has been cancelled.</span>
              </div>
            )}

            {/* Cancel Gig Box */}
            {gigStatus !== 'Cancelled' && (
              <div className="pt-4 border-t border-brand-light-gray/30 mt-2">
                {isAcceptedFromBothEnds ? (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full py-2.5 bg-slate-100 border border-slate-200 text-slate-400 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Cancel and Remove Listing</span>
                    </button>
                    <p className="text-[10px] text-red-500 font-bold text-center">
                      🚫 This gig has been mutually accepted and is in progress. Cancellation is disabled to prevent misuse.
                    </p>
                  </div>
                ) : (
                  <div>
                    {!showCancelConfirm ? (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>Cancel and Remove Listing</span>
                      </button>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
                        <p className="text-[11px] text-red-800 font-bold text-center">
                          Are you sure you want to cancel this gig? This action cannot be undone.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setShowCancelConfirm(false)}
                            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold py-2 rounded-lg transition-all cursor-pointer"
                          >
                            No, Keep Listing
                          </button>
                          <button
                            onClick={async () => {
                              await onCancelGig(gig.id);
                              setShowCancelConfirm(false);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-extrabold py-2 rounded-lg transition-all shadow-sm cursor-pointer"
                          >
                            Yes, Cancel Listing
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}



        {/* Gig Description */}
        <section className="bg-white p-5 rounded-2xl border border-brand-light-gray/80 text-left relative">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-extrabold text-sm text-brand-dark">Gig Description</h3>
          </div>
          <p className="text-xs text-brand-gray leading-relaxed whitespace-pre-line">
            {gig.description}
          </p>
        </section>

        {/* Uploaded Gig Photo Attachment Section */}
        {gig.imageUrl && gig.imageUrl.trim() !== "" && gig.imageUrl !== "null" && gig.imageUrl !== "undefined" && (
          <section className="bg-white p-4 rounded-2xl border border-brand-light-gray/80 text-left relative flex flex-col gap-3 shadow-sm overflow-hidden">
            <div 
              onClick={() => setIsFullscreenPhotoOpen(true)}
              className="flex items-center justify-between p-1 hover:bg-brand-light-gray/10 rounded-xl transition-all duration-200 cursor-zoom-in group"
            >
              <div className="flex items-center gap-3">
                {/* Thumbnail */}
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-brand-light-gray/60 shrink-0 bg-brand-light-gray/10 flex items-center justify-center">
                  <img
                    src={gig.imageUrl}
                    alt="Thumbnail"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-brand-dark/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                  </div>
                </div>
                
                {/* Text Details */}
                <div>
                  <h4 className="font-extrabold text-xs text-brand-dark flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Gig Photo Attachment</span>
                  </h4>
                  <p className="text-[10px] text-brand-gray font-medium mt-0.5">
                    Tap to view full screen
                  </p>
                </div>
              </div>

              {/* View Action Indicator */}
              <div className="flex items-center gap-1 bg-brand-primary/10 group-hover:bg-brand-primary/25 text-brand-primary px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all">
                <span>View</span>
                <Maximize2 className="w-3 h-3" />
              </div>
            </div>

            {/* Fullscreen Modal View */}
            {isFullscreenPhotoOpen && (
              <div 
                className="fixed inset-0 bg-brand-dark/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 transition-all duration-300 animate-in fade-in"
                onClick={() => setIsFullscreenPhotoOpen(false)}
              >
                {/* Header controls */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center text-white z-50">
                  <div className="flex items-center gap-2">
                    <Image className="w-5 h-5 text-brand-primary" />
                    <span className="text-sm font-bold truncate max-w-[200px] sm:max-w-md">{gig.title}</span>
                  </div>
                  <button 
                    onClick={() => setIsFullscreenPhotoOpen(false)}
                    className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all cursor-pointer"
                    aria-label="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Image content */}
                <div 
                  className="relative max-w-full max-h-[80vh] flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()} // Prevent close when clicking image itself
                >
                  <img
                    src={gig.imageUrl}
                    alt={gig.title}
                    className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl select-none"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <p className="text-[11px] text-white/60 mt-4 text-center font-medium">
                  Tap anywhere to close the preview
                </p>
              </div>
            )}
          </section>
        )}

        {/* Job Location & Map block */}
        <section className="flex flex-col gap-3 text-left">
          <h3 className="font-extrabold text-sm text-brand-dark">Job Location</h3>
          
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-brand-light-gray/80 shadow-sm">
            <MapPin className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-brand-dark">{gig.locationName.split(',')[0]}</p>
              <p className="text-[11px] text-brand-gray leading-relaxed">{gig.locationName}</p>
            </div>
          </div>

          {/* Real Google Map Preview */}
          <div className="w-full aspect-video rounded-2xl overflow-hidden border border-brand-light-gray shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01] relative group cursor-pointer">
            <div className="w-full h-full relative" key={gig.id}>
              <iframe
                title="Map Preview"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${mapQuery}&t=m&z=15&hl=en&output=embed`}
                className="w-full h-full opacity-90 hover:opacity-100 transition-opacity"
              />
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                id="map-overlay-link"
                className="absolute inset-0 bg-transparent cursor-pointer z-10"
              ></a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="absolute bottom-3 right-3 bg-brand-primary hover:bg-brand-primary-dark text-white px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-lg text-[11px] font-bold transition-all hover:scale-105 active:scale-95 z-20 pointer-events-auto"
                id="view-on-google-maps-btn"
              >
                <Navigation className="w-3.5 h-3.5 animate-pulse" />
                <span>View on Google Maps</span>
              </a>
            </div>
          </div>
        </section>

        {/* Timeline Bento Grid */}
        <section className="bg-white p-5 rounded-2xl border border-brand-light-gray/80 text-left flex flex-col gap-4">
          <h3 className="text-[10px] uppercase tracking-wider font-extrabold text-brand-primary">Gig Timeline</h3>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-primary/5 flex items-center justify-center text-brand-primary border border-brand-primary/10">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-brand-gray tracking-wider">Date</p>
                <p className="text-xs font-bold text-brand-dark">{formatToDDMMYY(gig.date)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-primary/5 flex items-center justify-center text-brand-primary border border-brand-primary/10">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-brand-gray tracking-wider">Start Time</p>
                <p className="text-xs font-bold text-brand-primary">{gig.startTime}</p>
              </div>
            </div>

            {/* Price detail */}
            <div className="pt-4 border-t border-brand-light-gray flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-brand-dark">Total Payout</p>
                <p className="text-[10px] text-brand-gray">No platform fees. Pay directly after completion.</p>
              </div>
              <p className="text-xl font-extrabold text-brand-primary">₹{gig.price.toLocaleString()}</p>
            </div>
          </div>
        </section>

      </div>

      {/* Bottom Sticky Action Bar (Only for Open gigs and NOT owned by user) */}
      {!isOwnGig && gigStatus === 'Open' && (
        <div className="fixed bottom-0 left-0 right-0 py-3 px-4 sm:px-6 md:px-8 bg-white/95 backdrop-blur-md border-t border-brand-light-gray/50 z-40">
          <div className="max-w-md mx-auto flex gap-3">

            <button
              onClick={handleNegotiateClick}
              className="flex-1 h-11 rounded-xl border-2 border-brand-primary text-brand-primary hover:bg-brand-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 font-extrabold text-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Negotiate Price</span>
            </button>
            
            <button
              onClick={handleInterestClick}
              className="flex-[1.5] h-11 bg-brand-primary text-white hover:bg-brand-primary-hover active:scale-95 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-brand-primary/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>I'm Interested</span>
            </button>
          </div>
        </div>
      )}

      {/* Directions overlay */}
      {showDirections && (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowDirections(false)}>
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md flex flex-col gap-4 text-left border-t border-brand-light-gray" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-brand-light-gray pb-3">
              <h3 className="font-extrabold text-sm text-brand-dark">Directions to Location</h3>
              <button onClick={() => setShowDirections(false)} className="text-xs font-bold text-brand-primary">Close</button>
            </div>
             <p className="text-xs text-brand-gray font-semibold">Address: {gig.locationName}</p>
             {calculatedDistance !== null && (
               <div className="bg-brand-primary/5 rounded-xl p-3 border border-brand-primary/10 flex justify-between items-center mt-1">
                 <span className="text-[11px] text-brand-gray font-bold">Estimated Distance:</span>
                 <span className="text-xs text-brand-accent font-extrabold">{calculatedDistance} km</span>
               </div>
             )}
            <div className="space-y-3 mt-1">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold flex items-center justify-center">1</div>
                <p className="text-xs text-brand-gray">
                  Head from your starting point towards {gig.suburb || 'destination'} 
                  {calculatedDistance !== null ? ` (${(calculatedDistance * 0.15).toFixed(1)} km)` : ' (300m)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold flex items-center justify-center">2</div>
                <p className="text-xs text-brand-gray">
                  Proceed along the main route to {gig.suburb || 'neighbourhood area'} 
                  {calculatedDistance !== null ? ` (${(calculatedDistance * 0.85).toFixed(1)} km)` : ' (1.2km)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold flex items-center justify-center">3</div>
                <p className="text-xs text-brand-gray">{gig.locationName.split(',')[0]} is nearby, near local transition stop</p>
              </div>
            </div>
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setShowDirections(false);
              }} 
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-bold text-xs rounded-xl shadow-md mt-2 flex items-center justify-center gap-1.5 text-center transition-all hover:scale-[1.02] active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5 animate-pulse" />
              <span>Start Navigation (GPS)</span>
            </a>
          </div>
        </div>
      )}

      {/* Propose Negotiation Modal */}
      {showNegotiationModal && (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNegotiationModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 text-left border border-brand-light-gray shadow-2xl relative animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-extrabold text-sm text-brand-dark">Propose Negotiated Price</h3>
              <p className="text-[11px] text-brand-gray mt-1 leading-relaxed">
                Propose a custom price for <span className="font-bold text-brand-dark">"{gig.title}"</span>. The current listing price is <span className="font-bold text-brand-primary">₹{gig.price}</span>.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-brand-gray uppercase tracking-wider">Propose Price (₹)</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-bold text-brand-primary">₹</span>
                <input
                  type="number"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className="w-full pl-7 pr-4 py-2.5 bg-brand-bg hover:bg-slate-100/50 focus:bg-white text-xs font-bold text-brand-dark rounded-xl border border-brand-light-gray/60 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                  placeholder="Enter custom price"
                  min="1"
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => setShowNegotiationModal(false)}
                className="flex-1 py-2.5 border border-brand-light-gray/80 hover:bg-brand-bg active:scale-95 text-xs font-bold text-brand-gray rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNegotiation}
                className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-hover active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-primary/10 cursor-pointer"
              >
                Send Proposal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
