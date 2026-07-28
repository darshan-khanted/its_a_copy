/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, Briefcase, User as UserIcon, MessageSquare } from 'lucide-react';
import { ActiveView } from '../types';

interface BottomNavProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  totalUnreadMessages?: number;
}

export default function BottomNav({ activeView, onNavigate, totalUnreadMessages = 0 }: BottomNavProps) {
  // Only display BottomNav on primary operational views
  const isNavVisible = [ActiveView.HOME, ActiveView.FEED, ActiveView.PROFILE, ActiveView.MESSAGES].includes(activeView);

  if (!isNavVisible) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(79,70,229,0.06)] border-t border-brand-light-gray/40 z-50">
      <div className="max-w-md mx-auto h-full px-4 sm:px-6 md:px-8 flex justify-around items-center">
        {/* Home Button */}
        <button
          onClick={() => onNavigate(ActiveView.HOME)}
          className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-200 ${
            activeView === ActiveView.HOME
              ? 'bg-brand-primary text-white px-5 py-2 shadow-lg shadow-brand-primary/20 scale-105'
              : 'text-brand-gray hover:text-brand-primary hover:bg-brand-light-gray/20'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>

        {/* Feed Button */}
        <button
          onClick={() => onNavigate(ActiveView.FEED)}
          className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-200 ${
            activeView === ActiveView.FEED
              ? 'bg-brand-primary text-white px-5 py-2 shadow-lg shadow-brand-primary/20 scale-105'
              : 'text-brand-gray hover:text-brand-primary hover:bg-brand-light-gray/20'
          }`}
        >
          <Briefcase className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Feed</span>
        </button>

        {/* Messages Button with Badge */}
        <button
          onClick={() => onNavigate(ActiveView.MESSAGES)}
          className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-200 relative ${
            activeView === ActiveView.MESSAGES
              ? 'bg-brand-primary text-white px-5 py-2 shadow-lg shadow-brand-primary/20 scale-105'
              : 'text-brand-gray hover:text-brand-primary hover:bg-brand-light-gray/20'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 mb-0.5" />
            {totalUnreadMessages > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-extrabold h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center border border-white shadow-sm">
                {totalUnreadMessages}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Inbox</span>
        </button>

        {/* Profile Button */}
        <button
          onClick={() => onNavigate(ActiveView.PROFILE)}
          className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-200 ${
            activeView === ActiveView.PROFILE
              ? 'bg-brand-primary text-white px-5 py-2 shadow-lg shadow-brand-primary/20 scale-105'
              : 'text-brand-gray hover:text-brand-primary hover:bg-brand-light-gray/20'
          }`}
        >
          <UserIcon className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
        </button>
      </div>
    </nav>
  );
}
