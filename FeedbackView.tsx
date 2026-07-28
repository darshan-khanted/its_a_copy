import React, { useState } from "react";
import { Star, MessageSquare, Loader2, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { Gig, User, getUserAvatarUrl } from "../types";
import { toTitleCase } from "../utils/stringUtils";

interface FeedbackViewProps {
  currentUser: User;
  pendingGig: Gig;
  onSubmitFeedback: (targetEmail: string, rating: number, comment: string, gigId: string) => Promise<void>;
}

export default function FeedbackView({
  currentUser,
  pendingGig,
  onSubmitFeedback,
}: FeedbackViewProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const isPoster = currentUser.email === pendingGig.posterEmail;
  const targetEmail = isPoster 
    ? (pendingGig.selectedWorker?.email || pendingGig.acceptedByEmail || "")
    : (pendingGig.posterEmail || "");
  const targetName = toTitleCase(
    isPoster
      ? (pendingGig.selectedWorker?.fullName || pendingGig.acceptedByName || "Helper")
      : (pendingGig.posterName || "Gig Poster")
  );
  const targetAvatar = isPoster
    ? getUserAvatarUrl(pendingGig.selectedWorker?.avatar, targetEmail, targetName)
    : getUserAvatarUrl(pendingGig.posterAvatar, targetEmail, targetName);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (rating === 0) {
      setErrorMsg("Please select a rating star to continue.");
      return;
    }

    if (comment.trim().length < 8) {
      setErrorMsg("Please write at least 8 characters about your experience.");
      return;
    }

    if (!targetEmail) {
      setErrorMsg("Failed to identify counterpart user for review.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitFeedback(targetEmail, rating, comment, pendingGig.id);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12" id="feedback-mandatory-screen">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl border border-brand-light-gray shadow-xl p-6 md:p-8 flex flex-col gap-6"
      >
        {/* Urgent/Mandatory Alert Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-full w-fit self-center border border-red-100 animate-pulse">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Mandatory Feedback Required</span>
        </div>

        {/* Text Details */}
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-800 font-display tracking-tight leading-tight">
            Review Your Neighbor
          </h2>
          <p className="text-xs text-brand-gray mt-2 font-medium leading-relaxed max-w-xs mx-auto">
            You recently completed the gig <span className="font-extrabold text-brand-primary">"{pendingGig.title}"</span>. Share your experience to finalize this gig and unlock your home feed.
          </p>
        </div>

        {/* Counterpart Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
          <img 
            src={targetAvatar} 
            alt={targetName} 
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="text-left flex-1 min-w-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {isPoster ? "Your Helper" : "Your Higer"}
            </span>
            <h4 className="text-sm font-extrabold text-slate-800 truncate leading-snug">
              {targetName}
            </h4>
            <p className="text-[11px] text-brand-gray truncate">
              {targetEmail}
            </p>
          </div>
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-5 text-left">
          {/* Star Rating Section */}
          <div className="flex flex-col gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              How was your experience?
            </span>
            
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isSelected = star <= rating;
                const isHovered = star <= hoveredRating;
                const active = isHovered || (hoveredRating === 0 && isSelected);
                
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 focus:outline-none transition-transform hover:scale-125 duration-100 cursor-pointer"
                  >
                    <Star 
                      className={`w-9 h-9 transition-colors ${
                        active 
                          ? "fill-amber-400 text-amber-400" 
                          : "text-slate-200 fill-slate-100"
                      }`} 
                    />
                  </button>
                );
              })}
            </div>
            
            {rating > 0 && (
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100 mt-1">
                {rating === 5 && "Excellent (5.0 / 5)"}
                {rating === 4 && "Very Good (4.0 / 5)"}
                {rating === 3 && "Good (3.0 / 5)"}
                {rating === 2 && "Fair (2.0 / 5)"}
                {rating === 1 && "Poor (1.0 / 5)"}
              </span>
            )}
          </div>

          {/* Comment input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Written Feedback</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`E.g., ${targetName.split(' ')[0]} was extremely friendly, prompt, and got the job done perfectly ahead of schedule. Highly recommended!`}
              className="w-full h-24 p-3 rounded-2xl border border-brand-light-gray focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary text-xs leading-relaxed resize-none transition-all placeholder:text-slate-300 font-medium"
              maxLength={200}
            />
            <div className="flex justify-between items-center text-[10px] text-brand-gray font-semibold px-1">
              <span className="text-red-500 font-bold">
                {comment.trim().length < 8 && "Min. 8 characters required"}
              </span>
              <span>{comment.length}/200</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl font-semibold text-center">
              {errorMsg}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black py-4 px-6 rounded-2xl shadow-md shadow-brand-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Feedback...</span>
              </>
            ) : (
              <span>Submit Feedback</span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
