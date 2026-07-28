/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  ShieldCheck
} from "lucide-react";
import { ActiveView } from "../types";

interface ResetPasswordViewProps {
  onNavigate: (view: ActiveView) => void;
  showToast: (message: string) => void;
}

export default function ResetPasswordView({ onNavigate, showToast }: ResetPasswordViewProps) {
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [verificationStatus, setVerificationStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [verificationError, setVerificationError] = useState<string>("");
  
  // Password form states
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  
  // Submission states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Extract token from URL search query on mount and verify it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token") || "";
    setToken(urlToken);

    if (!urlToken) {
      setVerificationStatus("invalid");
      setVerificationError("No security token was found in the link. Please request a new password reset link.");
      return;
    }

    // Verify token with backend
    fetch("/api/auth/verify-reset-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: urlToken })
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setEmail(data.email);
          setVerificationStatus("valid");
        } else {
          setVerificationStatus("invalid");
          setVerificationError(data.error || "The reset link is invalid, expired, or has already been used.");
        }
      })
      .catch((err) => {
        console.error("Token verification error:", err);
        setVerificationStatus("invalid");
        setVerificationError("Failed to connect to the server. Please check your internet connection.");
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (newPassword.length < 6) {
      setSubmitError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/confirm-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: newPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitSuccess(true);
        showToast("Password reset successfully ✓");
        
        // Clean URL query parameters so the token is not visible in the address bar anymore
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (historyErr) {
          console.warn("Could not clean URL history:", historyErr);
        }
      } else {
        setSubmitError(data.error || "Failed to reset password. Please request a new link.");
      }
    } catch (err) {
      console.error("Confirm password reset error:", err);
      setSubmitError("An error occurred. Please verify your network and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[90vh] bg-brand-bg flex items-center justify-center px-4 py-12">
      {/* Background decoration */}
      <div className="absolute top-[20%] left-[-10%] w-72 h-72 bg-brand-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-72 h-72 bg-brand-mint/10 rounded-full blur-[90px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl p-8 relative z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-extrabold text-brand-dark tracking-tight">
            Secure Password Reset
          </h2>
          <p className="text-xs text-brand-gray mt-1">
            QwickGig Security Portal
          </p>
        </div>

        {/* LOADING STATE */}
        {verificationStatus === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
            <p className="text-sm text-brand-gray font-medium animate-pulse">
              Verifying security credentials...
            </p>
          </div>
        )}

        {/* INVALID STATE */}
        {verificationStatus === "invalid" && (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Invalid or Expired Link
            </h3>
            <p className="text-sm text-brand-gray leading-relaxed mb-8 max-w-xs">
              {verificationError}
            </p>
            <button
              onClick={() => onNavigate(ActiveView.LANDING)}
              className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold text-sm shadow-md hover:bg-brand-primary-hover active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Home</span>
            </button>
          </div>
        )}

        {/* VALID & FORM SUCCESS STATE */}
        {verificationStatus === "valid" && submitSuccess && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center text-center py-6"
          >
            <div className="w-16 h-16 bg-brand-mint/30 rounded-full flex items-center justify-center mb-4 border border-brand-mint-dark/10">
              <CheckCircle2 className="w-8 h-8 text-brand-mint-dark" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Password Changed!
            </h3>
            <p className="text-sm text-brand-gray leading-relaxed mb-8 max-w-xs">
              Your password has been successfully updated. You can now use your new password to sign into your account.
            </p>
            <button
              onClick={() => onNavigate(ActiveView.PROFILE)}
              className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold text-sm shadow-md hover:bg-brand-primary-hover active:scale-95 transition-all cursor-pointer"
            >
              Proceed to Sign In
            </button>
          </motion.div>
        )}

        {/* VALID & ACTIVE FORM STATE */}
        {verificationStatus === "valid" && !submitSuccess && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Info Banner */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-brand-mint-dark mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <span className="block text-[10px] font-bold text-brand-gray uppercase tracking-wider">
                  Resetting Account
                </span>
                <span className="text-sm font-semibold text-brand-dark break-all">
                  {email}
                </span>
              </div>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3.5 flex gap-2 text-xs font-semibold items-center">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Password input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-brand-dark uppercase tracking-wider block">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4.5 w-4.5 text-brand-gray/80" />
                </div>
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  placeholder="Enter secure password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium text-brand-dark focus:bg-white focus:border-brand-primary focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-gray/80 hover:text-brand-dark transition-all cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <span className="text-[11px] text-brand-gray block">
                Must be at least 6 characters long.
              </span>
            </div>

            {/* Confirm Password input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-brand-dark uppercase tracking-wider block">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4.5 w-4.5 text-brand-gray/80" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Re-enter secure password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium text-brand-dark focus:bg-white focus:border-brand-primary focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-gray/80 hover:text-brand-dark transition-all cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-bold text-sm shadow-md hover:bg-brand-primary-hover active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
