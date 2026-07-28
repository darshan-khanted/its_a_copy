import React from 'react';
import { motion } from 'motion/react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Zap, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ArrowLeft,
  Briefcase
} from 'lucide-react';
import { ActiveView, Notification, Gig } from '../types';

interface NotificationsViewProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
  onNavigate: (view: ActiveView) => void;
  onSelectGig: (gig: Gig) => void;
  allGigs: Gig[];
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

export default function NotificationsView({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotifications,
  onNavigate,
  onSelectGig,
  allGigs,
}: NotificationsViewProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (n: Notification) => {
    onMarkAsRead(n.id);
    if (n.relatedId && allGigs) {
      const matched = allGigs.find((g) => g.id === n.relatedId);
      if (matched) {
        onSelectGig(matched);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-md mx-auto px-4 pb-24 pt-4"
    >
      <div className="flex flex-col gap-6">
        
        {/* Page Title & Stats */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-brand-dark tracking-tight flex items-center gap-2">
              Notifications
            </h1>
            <p className="text-xs text-brand-gray mt-1 font-medium">
              {unreadCount > 0 
                ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "You're completely up to date!"}
            </p>
          </div>

          <button
            onClick={() => onNavigate(ActiveView.HOME)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Go Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Global Action Toolbar */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between bg-slate-50 border border-brand-outline p-3 rounded-2xl">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Manage notifications
            </span>
            <div className="flex items-center gap-3.5">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="text-xs font-black text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button
                onClick={onClearNotifications}
                className="text-xs font-black text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear all
              </button>
            </div>
          </div>
        )}

        {/* Notification List Container */}
        {notifications.length === 0 ? (
          <div className="bg-white border border-brand-outline rounded-3xl p-8 text-center flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-slate-50 border border-brand-outline rounded-2xl flex items-center justify-center text-slate-400 mb-4 shadow-sm animate-pulse">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-brand-dark">No Notifications</h3>
            <p className="text-xs text-brand-gray mt-1.5 max-w-xs leading-relaxed">
              When someone books your gig, or when there are new opportunities in your area, we will let you know here!
            </p>
            <button
              onClick={() => onNavigate(ActiveView.FEED)}
              className="mt-6 bg-brand-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-brand-primary-hover shadow-md shadow-brand-primary/15 transition-all cursor-pointer active:scale-95"
            >
              Browse Available Gigs
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n, index) => {
              let Icon = Info;
              let iconBg = "bg-slate-100 border-slate-200 text-slate-500";
              
              if (n.type === "welcome") {
                Icon = Zap;
                iconBg = "bg-amber-50 border-amber-200 text-amber-500";
              } else if (n.type === "gig_posted") {
                Icon = Calendar;
                iconBg = "bg-indigo-50 border-indigo-200 text-indigo-500";
              } else if (n.type === "gig_accepted") {
                Icon = CheckCircle2;
                iconBg = "bg-emerald-50 border-emerald-200 text-emerald-500";
              } else if (n.type === "urgent") {
                Icon = AlertTriangle;
                iconBg = "bg-rose-50 border-rose-200 text-rose-500";
              }

              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 rounded-2xl border transition-all text-left relative flex gap-3.5 cursor-pointer w-full group ${
                    n.read 
                      ? "bg-white border-slate-200/80 hover:bg-slate-50/50" 
                      : "bg-slate-50 border-brand-primary/30 hover:border-brand-primary/50 shadow-sm"
                  }`}
                >
                  {/* Left Side Icon Badge */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${iconBg} shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Middle Text Area */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black truncate pr-1 ${
                        n.read ? "text-brand-dark" : "text-[#0f172a]"
                      }`}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {formatTimeAgo(n.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      {n.message}
                    </p>

                    {/* Action Tag if it can navigate */}
                    {n.relatedId && (
                      <div className="mt-2.5 flex items-center gap-1 text-[10px] text-brand-primary font-bold bg-brand-primary/5 px-2 py-0.5 rounded-md w-fit group-hover:bg-brand-primary/10 transition-colors">
                        <Briefcase className="w-3 h-3" /> View Gig Details
                      </div>
                    )}
                  </div>

                  {/* Red Dot Status Pin */}
                  {!n.read && (
                    <div className="absolute right-3.5 top-3.5 w-2.5 h-2.5 bg-brand-primary rounded-full border-2 border-white animate-pulse" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </motion.div>
  );
}
