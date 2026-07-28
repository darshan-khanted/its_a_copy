/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { User, getUserAvatarUrl } from '../types';
import { toTitleCase } from '../utils/stringUtils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: (isSuccess?: boolean) => void;
  onLogIn: (user: User, isSignUp?: boolean, password?: string, googleCredentialToken?: string) => Promise<void> | void;
  onResetPassword?: (email: string) => void;
}

export default function AuthModal({ isOpen, onClose, onLogIn, onResetPassword }: AuthModalProps) {
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [signinName, setSigninName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [pendingUserToLogin, setPendingUserToLogin] = useState<User | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEmailAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {
      if (!signinEmail.trim()) {
        alert('Please enter your email address.');
        return;
      }
      if (onResetPassword) {
        onResetPassword(signinEmail.trim());
      }
      return;
    }

    if (!signinEmail.trim() || !signinPassword.trim()) {
      alert('Please fill out all fields.');
      return;
    }
    if (isSignUp && !signinName.trim()) {
      alert('Please fill out your full name.');
      return;
    }

    const emailToUse = signinEmail.trim();
    const nameToUse = toTitleCase(isSignUp ? signinName.trim() : emailToUse.split('@')[0]);

    const finalUser: User = {
      fullName: nameToUse,
      email: emailToUse,
      phoneNumber: '',
      isVerified: false,
      avatar: getUserAvatarUrl('', emailToUse, nameToUse),
      gigsDone: 0,
      gigsPosted: 0
    };

    if (isSignUp) {
      setPendingPassword(signinPassword);
      setPendingUserToLogin(finalUser);
      setShowLocationPrompt(true);
    } else {
      onLogIn(finalUser, false, signinPassword);
      onClose(true);
    }
  };

  const completeSignUpWithLocation = () => {
    if (pendingUserToLogin) {
      onLogIn(pendingUserToLogin, true, pendingPassword);
      setPendingUserToLogin(null);
      setPendingPassword('');
      setShowLocationPrompt(false);
      onClose(true);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose(false);
        }
      }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-sm cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-[24px] border border-brand-light-gray shadow-2xl p-6 sm:p-8 overflow-hidden max-h-[90vh] overflow-y-auto cursor-default"
      >
        
        {/* Close Button */}
        <button
          onClick={() => onClose(false)}
          className="absolute right-4 top-4 text-brand-gray hover:text-brand-dark p-2 rounded-full hover:bg-brand-light-gray/20 transition-all cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6 pt-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark tracking-tight">
            {isForgotPassword 
              ? 'Reset Your Password' 
              : isSignUp 
                ? 'Create Your Account' 
                : 'Welcome to Qwick Gig'}
          </h2>
          <p className="text-brand-gray text-xs sm:text-sm mt-1.5 leading-normal">
            {isForgotPassword 
              ? 'Enter your email and we will send you a secure password reset link to access your account.' 
              : isSignUp 
                ? 'Sign up to find local work or post gigs near you.' 
                : 'Sign in to find local work or post gigs near you.'}
          </p>
        </div>

        <form onSubmit={handleEmailAuthSubmit} className="flex flex-col gap-4 text-left">
          {isSignUp && !isForgotPassword && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-dark">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={signinName}
                onChange={(e) => setSigninName(e.target.value)}
                className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-dark">Email Address</label>
            <input
              type="email"
              placeholder="example@gmail.com"
              value={signinEmail}
              onChange={(e) => setSigninEmail(e.target.value)}
              className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
              required
            />
          </div>

          {!isForgotPassword && (
            <div className="flex flex-col gap-1.5 relative">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-brand-dark">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-[11px] text-brand-primary hover:underline font-bold focus:outline-none cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  className="w-full h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl pl-4 pr-11 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-dark p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="h-11 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer mt-2"
          >
            {isForgotPassword 
              ? 'Send Reset Link' 
              : isSignUp 
                ? 'Create Account' 
                : 'Sign In'}
          </button>
        </form>

        {isForgotPassword ? (
          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              className="text-brand-primary hover:underline text-xs font-bold cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            <div className="my-5 flex items-center justify-center gap-3">
              <div className="h-px bg-brand-outline flex-1"></div>
              <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">or</span>
              <div className="h-px bg-brand-outline flex-1"></div>
            </div>

            <div className="flex justify-center w-full mt-2">
              {!import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID === 'dummy-client-id' ? (
                <div className="p-3 bg-red-50 text-red-600 rounded text-xs text-center border border-red-200">
                  Google Client ID is missing. Please add VITE_GOOGLE_CLIENT_ID to your secrets.
                </div>
              ) : !import.meta.env.VITE_GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com') ? (
                <div className="p-3 bg-yellow-50 text-yellow-800 rounded text-xs text-center border border-yellow-200">
                  <span className="font-semibold block mb-1">Invalid Client ID format</span>
                  The value you entered for GOOGLE_CLIENT_ID does not end with .apps.googleusercontent.com.
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      try {
                        const decoded = jwtDecode(credentialResponse.credential) as any;
                        const finalUser: User = {
                          fullName: toTitleCase(decoded.name || 'Google User'),
                          email: decoded.email || 'user@gmail.com',
                          phoneNumber: '',
                          isVerified: false,
                          avatar: getUserAvatarUrl(decoded.picture, decoded.email, decoded.name),
                          gigsDone: 0,
                          gigsPosted: 0
                        };
                        onLogIn(finalUser, undefined, undefined, credentialResponse.credential);
                        onClose(true);
                      } catch (e) {
                        console.error(e);
                      }
                    }
                  }}
                  onError={() => {
                    alert('Google Sign In Failed. Please try again.');
                  }}
                />
              )}
            </div>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-brand-primary hover:underline text-xs font-bold cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Location access prompt matching ProfileView behavior */}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[24px] overflow-hidden shadow-2xl max-w-sm w-full p-6 text-center border border-brand-light-gray flex flex-col gap-4"
          >
            <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-brand-dark font-black text-lg">Enable Device Location</h3>
              <p className="text-xs text-brand-gray mt-2 font-medium leading-relaxed">
                Qwick Gig uses your device location to show you local gig listings, match you with nearby helpers, and calculate accurate distances. This is highly recommended for mobile devices.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("qwick_location_permission_asked", "yes");
                  setShowLocationPrompt(false);
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        console.log("Location enabled successfully:", position);
                        completeSignUpWithLocation();
                      },
                      (error) => {
                        console.warn("Location permission denied/failed:", error);
                        completeSignUpWithLocation();
                      },
                      { enableHighAccuracy: true, timeout: 5000 }
                    );
                  } else {
                    completeSignUpWithLocation();
                  }
                }}
                className="w-full py-3 bg-brand-primary text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-[0.98] transition-all cursor-pointer"
              >
                Enable Location Access
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("qwick_location_permission_asked", "yes");
                  setShowLocationPrompt(false);
                  completeSignUpWithLocation();
                }}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-brand-gray font-bold text-xs rounded-xl transition-all cursor-pointer border border-brand-light-gray/60"
              >
                Not Now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
