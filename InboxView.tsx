import React, { useState, useEffect } from "react";
import { MessageSquare, ArrowRight, Loader2, Pin, CheckCheck } from "lucide-react";
import { ChatThread, User, getUserAvatarUrl } from "../types";
import { formatTimestampToDDMMYY } from "../utils/date";
import { toTitleCase } from "../utils/stringUtils";
import {
  db,
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  handleFirestoreError,
  OperationType,
} from "../firebase";

interface InboxViewProps {
  currentUser: User;
  onSelectThread: (thread: ChatThread) => void;
}

export default function InboxView({ currentUser, onSelectThread }: InboxViewProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const safeSelfEmail = currentUser.email.toLowerCase().replace(/\./g, "_");

  const unreadThreadsCount = threads.reduce((acc, thread) => {
    const unreadCount = thread.unreadCount?.[safeSelfEmail] || 0;
    return acc + (unreadCount > 0 ? 1 : 0);
  }, 0);

  const handleMarkAllRead = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const unreadThreads = threads.filter(
        (thread) => (thread.unreadCount?.[safeSelfEmail] || 0) > 0
      );
      await Promise.all(
        unreadThreads.map((thread) =>
          updateDoc(doc(db, "chats", thread.id), {
            [`unreadCount.${safeSelfEmail}`]: 0,
          })
        )
      );
    } catch (error) {
      console.error("Error marking all threads as read:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    const chatsPath = "chats";
    const q = query(
      collection(db, chatsPath),
      where("participants", "array-contains", currentUser.email.toLowerCase())
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const activeThreads: ChatThread[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          activeThreads.push({
            id: docSnap.id,
            ...data
          } as ChatThread);
        });

        // Sort by pinnedBy and then lastMessageTime descending (most recent first)
        activeThreads.sort((a, b) => {
          const aPinned = a.pinnedBy?.[safeSelfEmail] ? 1 : 0;
          const bPinned = b.pinnedBy?.[safeSelfEmail] ? 1 : 0;
          if (aPinned !== bPinned) {
            return bPinned - aPinned;
          }
          return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
        });
        setThreads(activeThreads);
        setIsLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, chatsPath);
      }
    );

    return () => unsub();
  }, [currentUser.email, safeSelfEmail]);

  return (
    <div className="w-full min-h-screen bg-brand-bg pt-3 pb-28" id="inbox-view-container">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-4">
        {/* Section Title */}
        <div className="flex justify-between items-center mt-2">
          <div>
            <h2 className="font-extrabold text-lg text-brand-dark font-display">
              My Messages
            </h2>
            <p className="text-[11px] text-brand-gray font-semibold">
              Manage negotiations and gig discussions
            </p>
          </div>
          <button
            onClick={handleMarkAllRead}
            disabled={isUpdating || unreadThreadsCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-extrabold rounded-full transition-all active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap shrink-0 ${
              unreadThreadsCount > 0
                ? "bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary border border-brand-primary/20 cursor-pointer"
                : "bg-slate-100 text-slate-400 border border-slate-200"
            }`}
            id="mark-all-read-btn"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{isUpdating ? "Marking..." : "Mark all read"}</span>
          </button>
        </div>

        {/* List of Threads */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-brand-gray gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <span className="text-xs font-semibold">Loading your conversations...</span>
          </div>
        ) : threads.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-brand-light-gray shadow-sm flex flex-col items-center gap-4 mt-4">
            <div className="w-16 h-16 bg-brand-light-gray/40 text-brand-gray rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-brand-dark">No conversations yet</h3>
              <p className="text-xs text-brand-gray mt-1 leading-relaxed max-w-[240px] mx-auto">
                Express interest in a gig or respond to interested workers to start a chat thread.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-1" id="threads-list">
            {threads.map((thread) => {
              const otherEmail = (thread.participants || []).find(
                (p) => p.toLowerCase() !== currentUser.email.toLowerCase()
              ) || "";
              const safeOtherEmail = otherEmail
                ? otherEmail.replace(/\./g, "_")
                : "";

              const otherName = toTitleCase(
                thread.participantNames?.[safeOtherEmail] ||
                otherEmail ||
                "Neighbor"
              );

              const otherAvatar = getUserAvatarUrl(
                thread.participantAvatars?.[safeOtherEmail],
                otherEmail,
                otherName
              );

              const unreadCount = thread.unreadCount?.[safeSelfEmail] || 0;
              const hasUnread = unreadCount > 0;

              const timeStr = thread.lastMessageTime
                ? formatTimestampToDDMMYY(thread.lastMessageTime)
                : "";

              return (
                <div
                  key={thread.id}
                  onClick={() => onSelectThread(thread)}
                  className={`bg-white rounded-2xl p-4 border transition-all duration-200 active:scale-[0.99] cursor-pointer hover:border-brand-primary/30 flex items-center gap-3.5 shadow-sm relative ${
                    hasUnread
                      ? "border-brand-primary/25 bg-indigo-50/5"
                      : "border-brand-light-gray/60"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={otherAvatar}
                      alt={otherName}
                      className="w-12 h-12 rounded-full object-cover border border-brand-light-gray"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = getUserAvatarUrl("", otherEmail, otherName);
                      }}
                    />
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Thread details */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-baseline gap-2">
                      <h4 className={`text-xs font-bold leading-none truncate flex items-center gap-1.5 ${hasUnread ? "text-brand-dark font-extrabold" : "text-brand-dark"}`}>
                        {otherName}
                        {thread.pinnedBy?.[safeSelfEmail] && (
                          <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold border border-amber-200 shadow-sm animate-pulse">
                            <Pin className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            <span>PINNED</span>
                          </span>
                        )}
                      </h4>
                      <span className="text-[10px] text-brand-gray font-semibold shrink-0">
                        {timeStr}
                      </span>
                    </div>

                    <h5 className="text-[10px] text-brand-primary font-bold uppercase tracking-wider line-clamp-1 mt-1">
                      {thread.gigTitle}
                    </h5>

                    <p className={`text-[11px] truncate mt-1 ${hasUnread ? "text-slate-900 font-extrabold" : "text-brand-gray"}`}>
                      {thread.lastMessageSender === currentUser.email ? "You: " : ""}
                      {thread.lastMessage || <span className="italic text-gray-400">No messages yet</span>}
                    </p>
                  </div>

                  {/* Icon */}
                  <div className="shrink-0 text-brand-light-gray group-hover:text-brand-primary">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
