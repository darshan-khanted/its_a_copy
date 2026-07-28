/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Zap, Bell, ArrowLeft, Share2, CheckCheck, Trash2, Calendar, Info, AlertTriangle, MapPin, Navigation, Search, X, Copy, Check, UserCircle } from 'lucide-react';
import { ActiveView, User, Notification, Gig, getUserAvatarUrl } from '../types';
import { INDIAN_CITIES, getClosestMajorCity, extractCityFromAddress } from '../utils/distance';

interface HeaderProps {
  activeView: ActiveView;
  user: User | null;
  onNavigate: (view: ActiveView) => void;
  onBack?: () => void;
  titleContext?: string;
  notifications?: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onClearNotifications?: () => void;
  onSelectGig?: (gig: Gig) => void;
  allGigs?: Gig[];
  currentCity?: string;
  onCityChange?: (city: string) => void;
  selectedGig?: Gig | null;
}

function formatTimeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Header({
  activeView,
  user,
  onNavigate,
  onBack,
  titleContext,
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotifications,
  onSelectGig,
  allGigs = [],
  currentCity,
  onCityChange,
  selectedGig,
}: HeaderProps) {
  const isBackAllowed = activeView === ActiveView.DETAILS || activeView === ActiveView.POST || activeView === ActiveView.PUBLISHED || activeView === ActiveView.NOTIFICATIONS;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showCityModal, setShowCityModal] = useState(false);
  const [customCitySearch, setCustomCitySearch] = useState("");
  const [isLocatingCity, setIsLocatingCity] = useState(false);

  // States for the Share Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [manualCopied, setManualCopied] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocatingCity(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Find closest major city from our list first
        const closest = getClosestMajorCity(lat, lng);
        if (closest) {
          if (onCityChange) onCityChange(closest);
          setIsLocatingCity(false);
          setShowCityModal(false);
          return;
        }

        // Fall back to OSM Nominatim reverse geocoding
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`, {
          headers: {
            "Accept-Language": "en"
          }
        })
          .then((res) => res.json())
          .then((data) => {
            setIsLocatingCity(false);
            if (data && data.display_name) {
              const detectedCity = extractCityFromAddress(data.display_name);
              if (detectedCity && onCityChange) {
                onCityChange(detectedCity);
                setShowCityModal(false);
              } else {
                alert("Could not identify city. Please enter it manually.");
              }
            } else {
              alert("Could not detect city. Please enter it manually.");
            }
          })
          .catch((err) => {
            console.error("Error auto-detecting city:", err);
            setIsLocatingCity(false);
            alert("Could not auto-detect city. Please choose or enter manually.");
          });
      },
      (error) => {
        setIsLocatingCity(false);
        console.warn("Geolocation error:", error);
        alert("Location access denied or unavailable. Please choose your city manually.");
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleCustomCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCitySearch.trim()) return;
    const formatted = customCitySearch
      .trim()
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    if (onCityChange) onCityChange(formatted);
    setCustomCitySearch("");
    setShowCityModal(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const shareLink = selectedGig 
    ? `${window.location.origin}/?gigId=${selectedGig.id}` 
    : window.location.href;

  const shareText = selectedGig 
    ? `Hey! Check out this gig on Qwick Gig: "${selectedGig.title}" in ${selectedGig.suburb || 'your area'}${selectedGig.price ? ` for ₹${selectedGig.price}` : ''}. Download Qwick Gig to earn extra cash or hire local helpers instantly!`
    : `Hey! Check out Qwick Gig - the easiest way to earn extra cash or hire local helpers instantly!`;

  const handleShareClick = () => {
    const fullMessage = `${shareText}\n\nView details: ${shareLink}`;
    navigator.clipboard.writeText(fullMessage)
      .then(() => {
        setManualCopied(false);
        setShowShareModal(true);
      })
      .catch((err) => {
        console.error("Failed to auto-copy to clipboard:", err);
        setManualCopied(false);
        setShowShareModal(true);
      });
  };

  const handleManualCopy = () => {
    const fullMessage = `${shareText}\n\nView details: ${shareLink}`;
    navigator.clipboard.writeText(fullMessage)
      .then(() => {
        setManualCopied(true);
        setTimeout(() => setManualCopied(false), 2000);
      });
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b border-brand-light-gray/60 z-50 transition-shadow">
        <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between relative">
          <div className="flex items-center gap-1.5 max-w-[65%]">
            {isBackAllowed && (
              <button
                onClick={onBack}
                className="p-1 px-2 -ml-2 rounded-full hover:bg-brand-light-gray/40 text-brand-primary active:scale-95 transition-all shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            <div 
              onClick={() => onNavigate(ActiveView.LANDING)}
              className="flex items-center gap-1.5 cursor-pointer font-extrabold text-lg select-none shrink-0"
            >
              <div className="w-7 h-7 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all">
                <Zap className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="font-extrabold text-base tracking-normal text-[#0f172a]">Qwick Gig</span>
            </div>
          </div>

          {/* Dynamic header right-actions */}
          <div className="flex items-center gap-2">
            {activeView === ActiveView.LANDING ? (
              !user && (
                <button
                  onClick={() => onNavigate(ActiveView.PROFILE)}
                  className="bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-brand-primary-hover active:scale-95 transition-all shadow-sm"
                >
                  Login
                </button>
              )
            ) : activeView === ActiveView.DETAILS ? (
              <button 
                onClick={handleShareClick}
                className="p-2 rounded-full hover:bg-brand-light-gray/40 text-brand-dark transition-colors"
                title="Share Gig"
              >
                <Share2 className="w-5 h-5 text-brand-dark" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button 
                    onClick={() => onNavigate(ActiveView.NOTIFICATIONS)}
                    className={`p-2 rounded-full relative transition-all active:scale-95 cursor-pointer ${
                      activeView === ActiveView.NOTIFICATIONS 
                        ? "bg-brand-primary/10 text-brand-primary" 
                        : "hover:bg-brand-light-gray/40 text-brand-primary"
                    }`}
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5 text-brand-primary" />
                    {unreadCount > 0 && (
                      <div className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black h-4.5 w-4.5 rounded-full flex items-center justify-center border border-white animate-pulse">
                        {unreadCount}
                      </div>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <button 
                    onClick={() => onNavigate(ActiveView.PROFILE)}
                    className={`p-1.5 rounded-full relative transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                      activeView === ActiveView.PROFILE 
                        ? "bg-brand-primary/10 text-brand-primary" 
                        : "hover:bg-brand-light-gray/40 text-brand-primary"
                    }`}
                    title={user ? user.fullName : "Profile"}
                  >
                    {user ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-primary/20 bg-brand-light-gray">
                        <img 
                          src={getUserAvatarUrl(user.avatar, user.email, user.fullName)} 
                          alt={user.fullName} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.src = getUserAvatarUrl("", user.email, user.fullName);
                          }}
                        />
                      </div>
                    ) : (
                      <UserCircle className="w-8 h-8 text-brand-primary" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* City Location Sub-Header Bar */}
        {currentCity && (activeView === ActiveView.HOME || activeView === ActiveView.FEED) && (
          <div className="border-t border-brand-light-gray/40 bg-slate-50/95 py-2 px-4 shadow-xs">
            <div className="max-w-md mx-auto flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-brand-gray font-bold">
                <MapPin className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                <span>Showing gigs in:</span>
                <span className="text-brand-dark font-black">{currentCity}</span>
              </div>
              <button
                onClick={() => setShowCityModal(true)}
                className="text-[10px] font-black text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 border border-brand-primary/15 px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>Change City</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* City Selector Modal */}
      {showCityModal && (
        <div 
          className="fixed inset-0 bg-brand-dark/55 backdrop-blur-sm z-[999] flex items-center justify-center p-4" 
          onClick={() => setShowCityModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 border border-brand-light-gray shadow-2xl text-left" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-brand-light-gray">
              <div>
                <h3 className="font-extrabold text-sm text-brand-dark">Select Your City</h3>
                <p className="text-[10px] text-brand-gray font-semibold mt-0.5">Showing gigs in this area only</p>
              </div>
              <button
                onClick={() => setShowCityModal(false)}
                className="p-1.5 rounded-full hover:bg-brand-light-gray text-brand-gray"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Auto detect option */}
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={isLocatingCity}
              className="w-full py-3 px-4 bg-brand-primary/5 hover:bg-brand-primary/10 active:bg-brand-primary/15 text-brand-primary border border-brand-primary/10 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-65"
            >
              {isLocatingCity ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  <span>Locating...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 fill-brand-primary/20" />
                  <span>Auto-detect Current City 📍</span>
                </>
              )}
            </button>

            {/* Popular cities grid */}
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-brand-gray mb-2">Popular Cities</p>
              <div className="grid grid-cols-2 gap-2">
                {["Bengaluru", "Mumbai", "Delhi", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad"].map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      if (onCityChange) onCityChange(city);
                      setShowCityModal(false);
                    }}
                    className={`py-2 px-3 text-left text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      currentCity === city
                        ? "bg-brand-primary text-white border-brand-primary"
                        : "bg-slate-50 border-slate-200 text-brand-dark hover:bg-brand-primary/5"
                    }`}
                  >
                    <span>{city}</span>
                    {currentCity === city && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Search / Custom city input */}
            <form onSubmit={handleCustomCitySubmit} className="flex flex-col gap-1.5 border-t border-brand-light-gray/60 pt-3">
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-brand-gray">Other City or Town</label>
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-3.5 h-3.5 text-brand-gray" />
                <input
                  type="text"
                  value={customCitySearch}
                  onChange={(e) => setCustomCitySearch(e.target.value)}
                  placeholder="e.g. Jaipur, Kochi, Patna..."
                  className="w-full h-10 bg-slate-50 border border-brand-outline rounded-xl pl-9 pr-4 font-semibold text-brand-dark focus:outline-none focus:border-brand-primary text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={!customCitySearch.trim()}
                className="w-full py-2 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-brand-primary-hover active:scale-95 transition-all disabled:opacity-50 mt-1"
              >
                Set Location
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Share & Promotion Modal */}
      {showShareModal && (
        <div 
          className="fixed inset-0 bg-brand-dark/55 backdrop-blur-sm z-[999] flex items-center justify-center p-4" 
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 border border-brand-light-gray shadow-2xl text-left animate-in fade-in zoom-in duration-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-brand-light-gray">
              <div className="flex items-center gap-2">
                <span className="text-lg">📢</span>
                <h3 className="font-extrabold text-sm text-brand-dark">Share Gig Details</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-full hover:bg-brand-light-gray text-brand-gray transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Clipboard auto-copied alert */}
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-3 flex items-start gap-2.5">
                <div className="bg-emerald-500 text-white rounded-full p-1 shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold">Copied to clipboard!</p>
                  <p className="text-[10px] text-emerald-700/80 font-semibold mt-0.5">The promotional message and link have been successfully copied.</p>
                </div>
              </div>

              {/* Message preview */}
              <div className="bg-brand-bg/50 border border-brand-light-gray/60 p-3.5 rounded-2xl flex flex-col gap-2">
                <p className="text-[10px] uppercase font-black text-brand-gray tracking-wider">Message Preview</p>
                <div className="text-xs text-brand-dark bg-white border border-brand-light-gray/30 p-3 rounded-xl max-h-32 overflow-y-auto leading-relaxed select-all font-medium">
                  {shareText}
                  <div className="text-brand-primary font-bold mt-1 text-[11px] underline truncate">{shareLink}</div>
                </div>
              </div>

              {/* Manual Link Input */}
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-[10px] uppercase font-black text-brand-gray tracking-wider">Manual Share Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${shareText}\n\nView details: ${shareLink}`}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 h-10 bg-slate-50 border border-brand-outline rounded-xl px-3 font-semibold text-brand-dark focus:outline-none text-xs truncate"
                  />
                  <button
                    onClick={handleManualCopy}
                    className="h-10 px-3 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-brand-primary-hover active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 min-w-[80px]"
                  >
                    {manualCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Social Quick Share Grid */}
              <div className="border-t border-brand-light-gray/60 pt-3 mt-1">
                <p className="text-[10px] uppercase font-black text-brand-gray tracking-wider mb-2">Quick Share Options</p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText + "\n\nView details: " + shareLink)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-[#25D366]/10 hover:bg-[#25D366]/15 text-[#075E54] border border-[#25D366]/20 text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all text-center"
                  >
                    <span>💬 WhatsApp</span>
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareLink)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/15 text-[#1DA1F2] border border-[#1DA1F2]/20 text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all text-center"
                  >
                    <span>X / Twitter</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
