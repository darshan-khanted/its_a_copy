import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Send, 
  ArrowLeft, 
  MessageSquare, 
  Loader2, 
  Phone, 
  Calendar, 
  Clock, 
  DollarSign, 
  Lock, 
  AlertCircle, 
  Sparkles, 
  CheckSquare,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import { ChatThread, ChatMessage, User, getUserAvatarUrl } from "../types";
import { formatToDDMMYY } from "../utils/date";
import { toTitleCase, hashEmail } from "../utils/stringUtils";
import {
  db,
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  query,
  handleFirestoreError,
  OperationType,
  auth,
} from "../firebase";
import { sendNotificationEmail } from "../utils/emailNotifications";
import { getDoc, getDocs, where } from "firebase/firestore";

interface ChatThreadViewProps {
  thread: ChatThread;
  currentUser: User;
  onClose: () => void;
  onViewUserProfile?: (
    email: string,
    fullName: string,
    avatar?: string,
    bio?: string,
    isVerified?: boolean
  ) => void;
}

export default function ChatThreadView({
  thread,
  currentUser,
  onClose,
  onViewUserProfile,
}: ChatThreadViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [otherUserProfile, setOtherUserProfile] = useState<{ isVerified: boolean } | null>(null);

  // Gig states & Proposal workflow states
  const [gig, setGig] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState("");
  const [agreedDate, setAgreedDate] = useState("");
  const [agreedStartTime, setAgreedStartTime] = useState("");
  const [agreedEndTime, setAgreedEndTime] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Periodically refresh the current time to trigger re-renders and enable the completed button in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch the gig document reactively
  useEffect(() => {
    if (!thread.gigId) return;
    const gigRef = doc(db, "gigs", thread.gigId);
    const unsub = onSnapshot(
      gigRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const gigData = { id: docSnap.id, ...docSnap.data() } as any;
          
          // Augment posterEmail if missing
          let posterEmail = gigData.posterEmail || "";
          if (!posterEmail && gigData.posterId && thread.participants) {
            const found = thread.participants.find(p => hashEmail(p) === gigData.posterId);
            if (found) {
              posterEmail = found;
            }
          }
          gigData.posterEmail = posterEmail;

          // Augment acceptedByEmail if missing
          let acceptedByEmail = gigData.acceptedByEmail || "";
          if (!acceptedByEmail && gigData.acceptedById && thread.participants) {
            const found = thread.participants.find(p => hashEmail(p) === gigData.acceptedById);
            if (found) {
              acceptedByEmail = found;
            }
          }
          gigData.acceptedByEmail = acceptedByEmail;

          setGig(gigData);
        }
      },
      (err) => {
        console.error("Error listening to gig in chat:", err);
      }
    );
    return () => unsub();
  }, [thread.gigId, thread.participants]);

  // Sync inputs with the loaded gig ONLY when the confirm modal is opened to prevent overwriting user typing
  useEffect(() => {
    if (showConfirmModal && gig) {
      setAgreedPrice(gig.price ? gig.price.toLocaleString("en-IN") : "");
      
      let cleanDate = gig.date || "";
      if (cleanDate.includes("Date: ")) {
        cleanDate = cleanDate.replace("Date: ", "");
      }
      setAgreedDate(cleanDate);

      let cleanStart = gig.startTime || "";
      if (cleanStart.includes("Starts: ")) {
        cleanStart = cleanStart.replace("Starts: ", "");
      }
      setAgreedStartTime(cleanStart);

      let cleanEnd = gig.endTime || "";
      if (cleanEnd.includes("Starts: ")) {
        cleanEnd = cleanEnd.replace("Starts: ", "");
      }

      if (cleanEnd) {
        setAgreedEndTime(cleanEnd);
      } else if (cleanStart) {
        const parts = cleanStart.split(":");
        if (parts.length === 2) {
          const [h, m] = parts.map(Number);
          const eh = (h + 2) % 24;
          setAgreedEndTime(`${eh.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        } else {
          setAgreedEndTime(cleanStart);
        }
      } else {
        setAgreedEndTime("18:00");
      }
    }
  }, [showConfirmModal]);

  const isEndTimePassed = () => {
    if (!gig) return false;
    if (!gig.date || !gig.endTime || gig.date.includes("Flexible") || gig.endTime.includes("Flexible")) {
      return true;
    }
    try {
      // Get current date/time in IST (the timezone of the application dates)
      const now = new Date();
      const istTime = now.getTime() + (now.getTimezoneOffset() + 330) * 60000;
      const istNow = new Date(istTime);

      // Clean up date string if it contains extra prefixes like "Date: " or is "Flexible Date"
      let cleanDate = gig.date;
      if (cleanDate.includes("Date: ")) {
        cleanDate = cleanDate.replace("Date: ", "");
      }
      
      let year, month, day;
      const ymdMatch = cleanDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      const dmyMatch = cleanDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      
      if (ymdMatch) {
        year = Number(ymdMatch[1]);
        month = Number(ymdMatch[2]);
        day = Number(ymdMatch[3]);
      } else if (dmyMatch) {
        day = Number(dmyMatch[1]);
        month = Number(dmyMatch[2]);
        let y = Number(dmyMatch[3]);
        if (y < 100) {
          y = 2000 + y;
        }
        year = y;
      } else {
        // Fallback: if there is no explicit YYYY-MM-DD or DD/MM/YY date, use today's IST date
        year = istNow.getFullYear();
        month = istNow.getMonth() + 1;
        day = istNow.getDate();
      }

      // Clean up end time string if it contains extra prefixes like "Starts: " or "Ends: "
      let cleanEndTime = gig.endTime;
      if (cleanEndTime.includes("Starts: ")) {
        cleanEndTime = cleanEndTime.replace("Starts: ", "");
      }
      if (cleanEndTime.includes("Ends: ")) {
        cleanEndTime = cleanEndTime.replace("Ends: ", "");
      }

      const parts = cleanEndTime.split(":");
      let hour, minute;
      if (parts.length >= 2) {
        // Extract numbers, stripping any non-numeric text (e.g. "17:30 PM" -> "17" and "30")
        hour = parseInt(parts[0].replace(/[^0-9]/g, ""), 10);
        minute = parseInt(parts[1].replace(/[^0-9]/g, ""), 10);
        
        // Handle AM/PM adjustments
        const upperEndTime = cleanEndTime.toUpperCase();
        if (upperEndTime.includes("PM") && hour < 12) {
          hour += 12;
        } else if (upperEndTime.includes("AM") && hour === 12) {
          hour = 0;
        }
      } else {
        return true; // Treat as passed/always completion allowed for flexible or unparseable time
      }

      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
        // Build the end date/time in the same timezone framework as istNow (local browser timezone)
        const endDateTime = new Date(year, month - 1, day, hour, minute);
        return istNow.getTime() >= endDateTime.getTime();
      }
    } catch (e) {
      console.error("Error parsing end time in isEndTimePassed:", e);
    }
    return true; // Default to true on exception to avoid locking the user
  };

  const getTimeValidationResult = () => {
    if (!agreedDate || !agreedStartTime || !agreedEndTime) {
      return { isValid: true, error: "" };
    }

    // 1. Check if start time is before end time
    const [startH, startM] = agreedStartTime.split(":").map(Number);
    const [endH, endM] = agreedEndTime.split(":").map(Number);
    if (!isNaN(startH) && !isNaN(startM) && !isNaN(endH) && !isNaN(endM)) {
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (endMinutes <= startMinutes) {
        return { isValid: false, error: "End time must be after start time." };
      }
    }

    // 2. Check if selected date & times are in the past
    try {
      let cleanDate = agreedDate;
      if (cleanDate.includes("Date: ")) {
        cleanDate = cleanDate.replace("Date: ", "");
      }

      const match = cleanDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      let year, month, day;
      if (match) {
        year = Number(match[1]);
        month = Number(match[2]);
        day = Number(match[3]);
      } else {
        // If it's a flexible date, do not enforce past time check since they can do it on any future day.
        return { isValid: true, error: "" };
      }

      if (year !== undefined && month !== undefined && day !== undefined) {
        if (!isNaN(startH) && !isNaN(startM)) {
          const startDateTime = new Date(year, month - 1, day, startH, startM);
          if (currentTime >= startDateTime.getTime()) {
            return { isValid: false, error: "The selected start time is in the past." };
          }
        }
        if (!isNaN(endH) && !isNaN(endM)) {
          const endDateTime = new Date(year, month - 1, day, endH, endM);
          if (currentTime >= endDateTime.getTime()) {
            return { isValid: false, error: "The selected end time is in the past." };
          }
        }
      }
    } catch (e) {
      console.error("Error validating times:", e);
    }

    return { isValid: true, error: "" };
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [liveThread, setLiveThread] = useState<ChatThread>(thread);

  // Sync liveThread with thread prop if it changes
  useEffect(() => {
    setLiveThread(thread);
  }, [thread]);

  // Real-time subscription to the thread details to detect typing state, unread changes, etc.
  useEffect(() => {
    const threadRef = doc(db, "chats", thread.id);
    const unsub = onSnapshot(
      threadRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setLiveThread(snapshot.data() as ChatThread);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `chats/${thread.id}`);
      }
    );
    return () => unsub();
  }, [thread.id]);

  const participants = thread.participants || [];
  const otherUserEmail = participants.find(
    (p) => currentUser?.email && p.toLowerCase() !== currentUser.email.toLowerCase()
  ) || participants.find((p) => currentUser?.email && p.toLowerCase() !== currentUser.email.toLowerCase()) || "";
  
  useEffect(() => {
    if (!otherUserEmail) {
      setOtherUserProfile(null);
      return;
    }
    const userRef = doc(db, "users", otherUserEmail.toLowerCase());
    const unsub = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOtherUserProfile({
            isVerified: !!data.isVerified
          });
        } else {
          setOtherUserProfile({ isVerified: false });
        }
      },
      (err) => {
        console.error("Error listening to other user profile:", err);
      }
    );
    return () => unsub();
  }, [otherUserEmail]);
  
  const safeOtherEmailKey = otherUserEmail
    ? otherUserEmail.toLowerCase().replace(/\./g, "_")
    : "";
  
  const otherUserName = toTitleCase(
    liveThread.participantNames?.[safeOtherEmailKey] ||
    otherUserEmail ||
    "User"
  );
    
  const otherUserAvatar = getUserAvatarUrl(
    liveThread.participantAvatars?.[safeOtherEmailKey],
    otherUserEmail,
    otherUserName
  );

  const isOtherUserTyping = !!(liveThread.typing?.[safeOtherEmailKey]);

  // Determine if this chat thread is disabled due to gig being filled by another helper
  const isPoster = !!(gig && currentUser?.email && gig.posterEmail && currentUser.email.toLowerCase() === gig.posterEmail.toLowerCase());
  const helperEmail = isPoster ? otherUserEmail : (currentUser?.email || "");
  const isAcceptedHelper = !!(
    gig &&
    gig.acceptedByEmail &&
    currentUser?.email &&
    currentUser.email.toLowerCase() === gig.acceptedByEmail.toLowerCase()
  );
  const isFilledByAnother = !!(
    gig &&
    (gig.status === "In Progress" || gig.status === "Completed") &&
    gig.acceptedByEmail &&
    helperEmail &&
    helperEmail.toLowerCase() !== gig.acceptedByEmail.toLowerCase()
  );
  const isChatDisabled = !!(
    thread.disabled ||
    liveThread.disabled ||
    isFilledByAnother ||
    gig?.status === "Cancelled" ||
    gig?.status === "Completed"
  );

  // Typing state control and debouncing
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!currentUser?.email || isChatDisabled) return;
    isTypingRef.current = isTyping;
    const safeSelfEmail = currentUser.email.toLowerCase().replace(/\./g, "_");
    try {
      const threadRef = doc(db, "chats", thread.id);
      await updateDoc(threadRef, {
        [`typing.${safeSelfEmail}`]: isTyping
      });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  };

  // Auto-scroll when the other user is typing
  useEffect(() => {
    if (isOtherUserTyping) {
      scrollToBottom("smooth");
    }
  }, [isOtherUserTyping]);

  // Cleanup typing status on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        const safeSelfEmail = currentUser?.email?.toLowerCase().replace(/\./g, "_");
        if (safeSelfEmail) {
          updateDoc(doc(db, "chats", thread.id), {
            [`typing.${safeSelfEmail}`]: false
          }).catch((err) => console.error("Unmount typing cleanup error:", err));
        }
      }
    };
  }, [thread.id, currentUser?.email]);

  // Listen to messages
  useEffect(() => {
    setIsLoading(true);
    const messagesPath = `chats/${thread.id}/messages`;
    
    // Sort by timestamp in onSnapshot handler to keep it reliable
    const unsub = onSnapshot(
      collection(db, messagesPath),
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          msgs.push(docSnap.data() as ChatMessage);
        });
        
        // Sort chronologically
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(msgs);
        setIsLoading(false);

        // Mark unread messages from other user as read
        const unreadFromOther = snapshot.docs.filter((docSnap) => {
          const data = docSnap.data() as ChatMessage;
          return data.senderEmail?.toLowerCase() !== currentUser.email.toLowerCase() && !data.read;
        });

        if (unreadFromOther.length > 0) {
          unreadFromOther.forEach((docSnap) => {
            updateDoc(docSnap.ref, { read: true }).catch((err) => {
              console.error("Error marking message as read:", err);
            });
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, messagesPath);
      }
    );

    return () => unsub();
  }, [thread.id, currentUser.email]);

  // Mark thread itself as read on open
  useEffect(() => {
    const threadPath = `chats/${thread.id}`;
    const safeSelfEmail = currentUser.email.toLowerCase().replace(/\./g, "_");
    
    const resetUnreadCount = async () => {
      try {
        await updateDoc(doc(db, "chats", thread.id), {
          [`unreadCount.${safeSelfEmail}`]: 0,
        });
      } catch (err) {
        // Safe to ignore if background update fails or if document was updated elsewhere
        console.error("Error resetting thread unread count:", err);
      }
    };
    
    resetUnreadCount();
  }, [thread.id, currentUser.email]);

  const isInitialLoadRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Reset initial load ref when thread changes
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [thread.id]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isLoading) return;

    if (isInitialLoadRef.current) {
      // Instant scroll on first load
      scrollToBottom("auto");
      
      // Secondary deferred scroll to catch any layout changes/images rendering
      const timer = setTimeout(() => {
        scrollToBottom("auto");
        isInitialLoadRef.current = false;
      }, 60);
      return () => clearTimeout(timer);
    } else {
      // Smooth scroll for new messages
      scrollToBottom("smooth");
      
      // Backup scroll to handle dynamic heights or slow rendering
      const timer = setTimeout(() => {
        scrollToBottom("smooth");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChatDisabled) return;
    if (!inputText.trim() || isSending) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    updateTypingStatus(false);

    const textToSend = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      const messagesPath = `chats/${thread.id}/messages`;
      const messageId = doc(collection(db, messagesPath)).id;
      
      const newMsg: ChatMessage = {
        id: messageId,
        senderEmail: currentUser.email,
        senderName: currentUser.fullName || currentUser.email,
        text: textToSend,
        timestamp: Date.now(),
        read: false,
      };

      // 1. Create message doc
      await setDoc(doc(db, messagesPath, messageId), newMsg);

      // 2. Update chat thread meta details and increment unread for other user
      const otherEmail = (thread.participants || []).find(
        (p) => p.toLowerCase() !== currentUser.email.toLowerCase()
      );
      const updates: Record<string, any> = {
        lastMessage: textToSend,
        lastMessageSender: currentUser.email,
        lastMessageTime: Date.now(),
      };

      if (otherEmail) {
        const safeOtherEmail = otherEmail.toLowerCase().replace(/\./g, "_");
        // Get fresh chat doc to accurately increment count, or increment in Firestore using dot notation
        // Let's first read the current unread count to increment it
        const threadRef = doc(db, "chats", thread.id);
        const threadSnap = await getDoc(threadRef);
        let currentUnread = 0;
        if (threadSnap.exists()) {
          const currentData = threadSnap.data();
          currentUnread = currentData?.unreadCount?.[safeOtherEmail] || 0;
        }
        updates[`unreadCount.${safeOtherEmail}`] = currentUnread + 1;
      }

      await updateDoc(doc(db, "chats", thread.id), updates);

      // Trigger SMTP transactional email notification for new inbox message
      if (otherEmail) {
        sendNotificationEmail(otherEmail, "inbox_message", currentUser.fullName || currentUser.email, {
          threadId: thread.id,
          messageContent: textToSend,
          gigTitle: gig?.title || "Active Chat"
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendProposal = async () => {
    if (!gig) return;
    const priceNum = parseInt(agreedPrice.replace(/[^0-9]/g, ""), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("Please enter a valid final price.");
      return;
    }
    if (!agreedDate || !agreedStartTime || !agreedEndTime) {
      alert("Please fill in all details.");
      return;
    }

    const timeValidation = getTimeValidationResult();
    if (!timeValidation.isValid) {
      alert(timeValidation.error);
      return;
    }

    setIsSending(true);
    try {
      const messagesPath = `chats/${thread.id}/messages`;
      const messageId = doc(collection(db, messagesPath)).id;

      const proposalText = `📋 GIG CONFIRMATION PROPOSAL\n\nTitle: ${gig.title}\nDate: ${agreedDate}\nTime: ${agreedStartTime} - ${agreedEndTime}\nAgreed Price: ₹${priceNum}\n\nNeighbor, please confirm details below to lock this gig into "In Process" status!`;

      const proposalMsg = {
        id: messageId,
        senderEmail: currentUser.email,
        senderName: currentUser.fullName || currentUser.email,
        text: proposalText,
        timestamp: Date.now(),
        read: false,
        proposal: {
          gigId: gig.id,
          price: priceNum,
          date: agreedDate,
          startTime: agreedStartTime,
          endTime: agreedEndTime,
          status: "pending" as const,
        },
      };

      await setDoc(doc(db, messagesPath, messageId), proposalMsg);

      // Update thread info
      await updateDoc(doc(db, "chats", thread.id), {
        lastMessage: `📋 Sent a gig confirmation proposal for ₹${priceNum}`,
        lastMessageSender: currentUser.email,
        lastMessageTime: Date.now(),
      });

      // Trigger SMTP transactional email notification for new proposal
      const otherEmail = (thread.participants || []).find(
        (p) => p.toLowerCase() !== currentUser.email.toLowerCase()
      );
      if (otherEmail) {
        sendNotificationEmail(otherEmail, "inbox_message", currentUser.fullName || currentUser.email, {
          threadId: thread.id,
          messageContent: `📋 Sent a gig confirmation proposal for ₹${priceNum}`,
          gigTitle: gig?.title || "Active Chat"
        });
      }

      setShowConfirmModal(false);
    } catch (err) {
      console.error("Error sending proposal:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleAcceptProposal = async (msg: ChatMessage) => {
    if (!gig || !msg.proposal) return;
    setIsSending(true);
    try {
      const p = msg.proposal;
      const messagesPath = `chats/${thread.id}/messages`;
      const posterEmail = gig.posterEmail;
      const doerEmail = currentUser.email;

      // 1. Update proposal status
      try {
        await updateDoc(doc(db, messagesPath, msg.id), {
          "proposal.status": "confirmed"
        });
        console.log("Step 1 (Update proposal status) succeeded");
      } catch (e) {
        console.error("Step 1 (Update proposal status) failed:", e);
        throw e;
      }

      // 2. Add system confirmation message in thread
      try {
        const sysId = doc(collection(db, messagesPath)).id;
        await setDoc(doc(db, messagesPath, sysId), {
          id: sysId,
          senderEmail: "system",
          senderName: "System",
          text: `✅ Gig Confirmed! Scheduled for ${formatToDDMMYY(p.date)} from ${p.startTime} to ${p.endTime} at final price ₹${p.price}.`,
          timestamp: Date.now(),
          read: false,
          isSystem: true,
        });
        console.log("Step 2 (Add system confirmation message) succeeded");
      } catch (e) {
        console.error("Step 2 (Add system confirmation) failed:", e);
        throw e;
      }

      // 3. Update Gig status to "In Progress" & fill worker details
      try {
        await updateDoc(doc(db, "gigs", gig.id), {
          status: "In Progress",
          isClosed: true,
          isAccepted: true,
          acceptedByName: currentUser.fullName || currentUser.email,
          acceptedById: hashEmail(currentUser.email),
          price: p.price,
          date: p.date,
          startTime: p.startTime,
          endTime: p.endTime,
          selectedWorker: {
            email: currentUser.email,
            fullName: currentUser.fullName || currentUser.email,
            avatar: currentUser.avatar || "",
            isVerified: currentUser.isVerified || false,
          },
        });

        // Write contact details to private subcollection
        await setDoc(doc(db, "gigs", gig.id, "private", "contact"), {
          acceptedByPhone: currentUser.phoneNumber || "",
          acceptedByEmail: currentUser.email || ""
        }, { merge: true });
        console.log("Step 3 (Update Gig status) succeeded");
      } catch (e) {
        console.error("Step 3 (Update Gig status) failed:", e);
        throw e;
      }

      // 4. Pin thread for both users
      try {
        const safePosterKey = posterEmail.replace(/\./g, "_");
        const safeDoerKey = doerEmail.replace(/\./g, "_");

        await updateDoc(doc(db, "chats", thread.id), {
          [`pinnedBy.${safePosterKey}`]: true,
          [`pinnedBy.${safeDoerKey}`]: true,
          lastMessage: `✅ Gig Confirmed & Pinned! (₹${p.price})`,
          lastMessageSender: "system",
          lastMessageTime: Date.now(),
        });
        console.log("Step 4 (Pin thread) succeeded");
      } catch (e) {
        console.error("Step 4 (Pin thread) failed:", e);
        throw e;
      }

      // 5. Send in-app notification to the helper
      try {
        const notifHelperId = `n-${Math.random().toString(36).substring(7)}`;
        await setDoc(doc(db, "notifications", notifHelperId), {
          id: notifHelperId,
          userEmail: doerEmail,
          title: "Gig Booked & Confirmed! 🚀",
          message: `Your booking for "${gig.title}" has been locked in! Please reach the destination on time (at ${p.startTime} on ${formatToDDMMYY(p.date)}) and complete the gig on time.`,
          timestamp: Date.now(),
          read: false,
          type: "gig_accepted",
          relatedId: gig.id,
        });
        console.log("Step 5 (Send in-app notification) succeeded");
      } catch (e) {
        console.error("Step 5 (Send in-app notification) failed:", e);
        throw e;
      }

      // Trigger SMTP transactional email notification for proposal acceptance
      if (gig.posterEmail) {
        sendNotificationEmail(
          gig.posterEmail,
          "proposal_accepted",
          currentUser.fullName || currentUser.email,
          { gigId: gig.id, workerEmail: doerEmail, finalPrice: p.price, threadId: thread.id }
        );
      }

      // 6. Disable all other chat threads and notify other candidates
      try {
        const chatsCol = collection(db, "chats");
        const qOther = query(chatsCol, where("gigId", "==", gig.id));
        const otherSnap = await getDocs(qOther);

        for (const otherDoc of otherSnap.docs) {
          if (otherDoc.id === thread.id) continue;

          await updateDoc(doc(db, "chats", otherDoc.id), {
            disabled: true,
            lastMessage: "This gig has been filled and confirmed with another helper.",
            lastMessageSender: "system",
            lastMessageTime: Date.now(),
          });

          const otherMsgPath = `chats/${otherDoc.id}/messages`;
          const otherSysId = doc(collection(db, otherMsgPath)).id;
          await setDoc(doc(db, otherMsgPath, otherSysId), {
            id: otherSysId,
            senderEmail: "system",
            senderName: "System",
            text: `⚠️ This chat is now closed because the gig has been confirmed with another helper.`,
            timestamp: Date.now(),
            read: false,
            isSystem: true,
          });

          const otherData = otherDoc.data();
          const otherUserEmail = (otherData.participants || []).find(
            (p: string) => p.toLowerCase() !== gig.posterEmail?.toLowerCase()
          );
          if (otherUserEmail) {
            const notifOtherId = `n-${Math.random().toString(36).substring(7)}`;
            await setDoc(doc(db, "notifications", notifOtherId), {
              id: notifOtherId,
              userEmail: otherUserEmail,
              title: "Gig Filled 🧑‍🤝‍🧑",
              message: `The gig "${gig.title}" you were interested in has been assigned to another helper. Thanks for showing interest!`,
              timestamp: Date.now(),
              read: false,
              type: "welcome",
              relatedId: gig.id,
            });
          }
        }
        console.log("Step 6 (Disable other threads) succeeded");
      } catch (e) {
        console.error("Step 6 (Disable other threads) failed:", e);
        throw e;
      }

    } catch (err) {
      console.error("Error confirming proposal:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeclineProposal = async (msg: ChatMessage) => {
    if (!gig || !msg.proposal) return;
    setIsSending(true);
    try {
      const messagesPath = `chats/${thread.id}/messages`;
      await updateDoc(doc(db, messagesPath, msg.id), {
        "proposal.status": "rejected"
      });

      const sysId = doc(collection(db, messagesPath)).id;
      await setDoc(doc(db, messagesPath, sysId), {
        id: sysId,
        senderEmail: "system",
        senderName: "System",
        text: `❌ Proposal declined by helper.`,
        timestamp: Date.now(),
        read: false,
        isSystem: true,
      });
    } catch (err) {
      console.error("Error declining proposal:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkGigCompleted = async () => {
    if (!gig) return;
    setIsSending(true);
    try {
      // 1. Update Gig status to 'Completed'
      await updateDoc(doc(db, "gigs", gig.id), {
        status: "Completed",
        completedAt: Date.now(),
      });

      // Update worker's gigsDone count in database
      const workerEmail = gig.acceptedByEmail || gig.selectedWorker?.email;
      if (workerEmail) {
        const workerUserRef = doc(db, "users", workerEmail);
        const workerSnap = await getDoc(workerUserRef);
        const currentDone = workerSnap.exists() ? (workerSnap.data()?.gigsDone ?? 0) : 0;
        await setDoc(workerUserRef, { gigsDone: currentDone + 1 }, { merge: true });
      }

      // 2. Unpin the thread for both users
      const posterEmail = gig.posterEmail;
      const doerEmail = gig.acceptedByEmail || gig.selectedWorker?.email;
      const safePosterKey = posterEmail.replace(/\./g, "_");
      const safeDoerKey = doerEmail?.replace(/\./g, "_");

      const unpinUpdates: any = {};
      if (safePosterKey) unpinUpdates[`pinnedBy.${safePosterKey}`] = false;
      if (safeDoerKey) unpinUpdates[`pinnedBy.${safeDoerKey}`] = false;
      unpinUpdates.lastMessage = "🎉 Gig completed! Please leave feedback.";
      unpinUpdates.lastMessageSender = "system";
      unpinUpdates.lastMessageTime = Date.now();
      await updateDoc(doc(db, "chats", thread.id), unpinUpdates);

      // 3. Send system completed message in chat
      const messagesPath = `chats/${thread.id}/messages`;
      const sysId = doc(collection(db, messagesPath)).id;
      await setDoc(doc(db, messagesPath, sysId), {
        id: sysId,
        senderEmail: "system",
        senderName: "System",
        text: `🎉 The gig has been marked as COMPLETED! Both neighbors can now leave feedback and reviews.`,
        timestamp: Date.now(),
        read: false,
        isSystem: true,
      });

    } catch (err) {
      console.error("Error marking completed:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-bg z-[150] flex flex-col max-w-md mx-auto shadow-2xl border-x border-brand-light-gray" id="chat-view-container">
      {/* Header */}
      <header className="bg-white border-b border-brand-light-gray h-16 flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-brand-light-gray/50 text-brand-dark transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div 
            id="chat-profile-header-trigger"
            onClick={() => {
              if (onViewUserProfile && otherUserEmail) {
                onViewUserProfile(
                  otherUserEmail,
                  otherUserName,
                  otherUserAvatar,
                  "", 
                  otherUserProfile?.isVerified || false
                );
              }
            }}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all group/profile"
            title={`View ${otherUserName}'s profile`}
          >
            <img
              src={getUserAvatarUrl(otherUserAvatar, otherUserEmail, otherUserName)}
              alt={otherUserName}
              className="w-10 h-10 rounded-full object-cover border border-brand-light-gray bg-brand-light-gray group-hover/profile:scale-105 transition-transform"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = getUserAvatarUrl("", otherUserEmail, otherUserName);
              }}
            />
            <div className="text-left">
              <h3 className="font-extrabold text-sm text-brand-dark leading-tight line-clamp-1 group-hover/profile:text-brand-primary group-hover/profile:underline transition-all flex items-center gap-1.5">
                <span>{otherUserName}</span>
                {otherUserProfile?.isVerified ? (
                  <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0">
                    <ShieldAlert className="w-2.5 h-2.5" /> Unverified
                  </span>
                )}
              </h3>
              {isOtherUserTyping ? (
                <p className="text-[10px] text-brand-primary font-black uppercase tracking-wider line-clamp-1 mt-0.5 animate-pulse flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-primary"></span>
                  </span>
                  <span>typing...</span>
                </p>
              ) : (
                <p className="text-[10px] text-brand-primary font-bold uppercase tracking-wider line-clamp-1 mt-0.5">
                  💬 {thread.gigTitle}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-brand-light-gray/50 text-brand-gray transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Quick Proposal Bar for Posters */}
      {currentUser.email === gig?.posterEmail && !isChatDisabled && gig?.status === "Open" && (
        <div className="bg-slate-50 border-b border-brand-light-gray px-4 py-2.5 flex justify-between items-center shrink-0">
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-black uppercase text-brand-primary tracking-wider">Ready to book?</span>
            <span className="text-[10px] text-brand-gray font-medium">Define price & time slot to propose booking</span>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] font-extrabold rounded-full active:scale-95 transition-all shadow-sm shadow-brand-primary/10 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 fill-white/10" />
            <span>Confirm Details</span>
          </button>
        </div>
      )}

      {/* Gig Status Banner */}
      {gig && gig.status === "In Progress" && (isPoster || isAcceptedHelper) && (
        <div className="bg-slate-900 text-white px-4 py-3 flex flex-col gap-2 shadow-inner border-b border-slate-800 text-xs shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">Gig in Progress</span>
              <span className="text-[10px] text-slate-300 font-medium">₹{gig.price} • Scheduled {formatToDDMMYY(gig.date)} ({gig.startTime} - {gig.endTime})</span>
            </div>
            
            <button
              onClick={handleMarkGigCompleted}
              disabled={!isEndTimePassed()}
              className={`${
                isEndTimePassed()
                  ? "bg-emerald-500 hover:bg-emerald-600 active:scale-95 cursor-pointer"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              } text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition-all flex items-center gap-1`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Complete Gig</span>
            </button>
          </div>
          {!isEndTimePassed() ? (
            <div className="mt-1 border-t border-slate-800/80 pt-1.5 flex justify-between items-center text-[9px] text-slate-400 font-medium leading-normal">
              <span>⏳ You can only mark this gig as completed once the scheduled timeframe has passed.</span>
              <span className="bg-slate-800 border border-slate-700/60 text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 ml-2">
                In Progress
              </span>
            </div>
          ) : (
            <div className="mt-1 border-t border-slate-800/80 pt-1.5 flex justify-between items-center text-[9px] text-slate-400 font-medium leading-normal">
              <span>✅ Scheduled timeframe has concluded. Please mark as completed to release feedback and reviews.</span>
              <span className="bg-emerald-950 border border-emerald-800/60 text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 ml-2">
                Ready to Close
              </span>
            </div>
          )}
        </div>
      )}

      {gig && gig.status === "Completed" && (isPoster || isAcceptedHelper) && (
        <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-100 px-4 py-2.5 flex items-center justify-between text-xs shrink-0 font-bold">
          <div className="flex items-center gap-2 text-left">
            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>This gig is marked as completed! Feedbacks are now unlocked.</span>
          </div>
        </div>
      )}

      {/* Disabled Chat Banner */}
      {isChatDisabled && (
        <div className="bg-slate-100 text-slate-600 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 text-xs shrink-0 font-semibold text-left">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>This conversation is closed because this gig has been completed, cancelled, or filled with another helper.</span>
        </div>
      )}

      {/* Message Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 scrollbar-none"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-brand-gray gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            <span className="text-xs font-semibold">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
            <div className="p-4 bg-indigo-50 text-brand-primary rounded-full">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-brand-dark">No messages yet</h4>
              <p className="text-xs text-brand-gray mt-1 max-w-[240px]">
                Ask questions or coordinate details about the gig here.
              </p>
            </div>
          </div>
        ) : (
          (() => {
            const lastProposalIndex = messages.reduce<number>((lastIdx, m, idx) => {
              return m.proposal ? idx : lastIdx;
            }, -1);

            return messages.map((msg, index) => {
              const isMe = msg.senderEmail === currentUser.email;
              
              // If it is a system log message
              if (msg.isSystem || msg.senderEmail === "system") {
                return (
                  <div key={msg.id || index} className="flex justify-center my-2 w-full">
                    <div className="bg-slate-100 border border-slate-200/60 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-sm text-center">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // If it contains a structured proposal card
              if (msg.proposal) {
                const p = msg.proposal;
                const isLatestProposal = index === lastProposalIndex;

                return (
                  <div key={msg.id || index} className="flex flex-col items-center w-full my-4">
                    <div className="w-full max-w-[90%] bg-white border-2 border-brand-primary/20 rounded-3xl p-4 shadow-md flex flex-col gap-3.5 text-left text-xs">
                      {/* Header */}
                      <div className="flex items-center gap-1.5 text-brand-primary font-black uppercase tracking-wider text-[10px] border-b border-brand-light-gray pb-2">
                        <Sparkles className="w-4 h-4 fill-brand-primary/10" />
                        <span>Gig Confirmation Proposal</span>
                      </div>

                      {/* Details */}
                      <div className="flex flex-col gap-1">
                        <h4 className="font-extrabold text-xs text-slate-800">
                          {gig?.title || "Gig Details"}
                        </h4>
                        <p className="text-slate-500 text-[10px] leading-relaxed line-clamp-2">
                          {gig?.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date</span>
                          <span className="text-slate-700 text-[10px] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-brand-primary" />
                            {formatToDDMMYY(p.date)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Time Slot</span>
                          <span className="text-slate-700 text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-brand-primary" />
                            {p.startTime} - {p.endTime}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 col-span-2 border-t border-slate-100 pt-2 mt-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Agreed Price</span>
                          <span className="text-brand-primary font-extrabold text-sm flex items-center gap-0.5">
                            ₹{p.price}
                          </span>
                        </div>
                      </div>

                      {/* Footer Status & Actions */}
                      <div className="pt-2 border-t border-brand-light-gray">
                        {!isLatestProposal && p.status === "pending" ? (
                          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-50 px-3 py-2.5 rounded-xl text-[11px] font-bold border border-slate-200/60 justify-center">
                            <X className="w-4 h-4 text-slate-300" />
                            <span>Outdated Proposal</span>
                          </div>
                        ) : p.status === "pending" ? (
                          currentUser.email === gig?.posterEmail ? (
                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-2 rounded-xl text-[10px] font-extrabold border border-amber-100 justify-center">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              <span>Waiting for helper's confirmation...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-bold text-brand-gray text-center block">Do you accept these details?</span>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDeclineProposal(msg)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer text-center text-[11px]"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptProposal(msg)}
                                  className="bg-brand-primary hover:bg-brand-primary-hover text-white py-2 px-3 rounded-xl font-black shadow-sm transition-all active:scale-95 cursor-pointer text-center text-[11px]"
                                >
                                  I Confirm
                                </button>
                              </div>
                            </div>
                          )
                        ) : p.status === "confirmed" ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl text-[11px] font-black border border-emerald-100 justify-center">
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                            <span>Gig Confirmed & Locked</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 justify-center">
                            <X className="w-4 h-4 text-slate-400" />
                            <span>Proposal Declined</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

            const msgDate = new Date(msg.timestamp);
            const timeStr = msgDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            const isPhoneMessage = msg.text.includes("📞") || msg.text.includes("phone number");
            const phoneMatch = msg.text.match(/\d{10}/);
            const phoneNumberStr = phoneMatch ? phoneMatch[0] : "";

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    isMe
                      ? "bg-brand-primary text-white rounded-br-none"
                      : "bg-white text-brand-dark border border-brand-light-gray/80 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words font-medium text-left">{msg.text}</p>
                  
                  {isPhoneMessage && phoneNumberStr && (
                    <a
                      href={`tel:${phoneNumberStr}`}
                      className={`mt-2 w-full font-extrabold text-[10px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 text-center ${
                        isMe 
                          ? "bg-white text-brand-primary hover:bg-indigo-50" 
                          : "bg-brand-primary text-white hover:bg-brand-primary-hover"
                      }`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call {isMe ? "My Number" : msg.senderName.split(' ')[0]} Now</span>
                    </a>
                  )}

                  <div
                    className={`text-[9px] mt-1.5 flex items-center gap-1 justify-end ${
                      isMe ? "text-indigo-200" : "text-brand-gray"
                    }`}
                  >
                    <span>{timeStr}</span>
                    {isMe && (
                      <span className="font-extrabold">
                        {msg.read ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
          })()
        )}
        {/* Real-time typing bubble inside list */}
        {isOtherUserTyping && (
          <div className="flex flex-col items-start animate-in fade-in duration-200">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white border border-brand-light-gray/80 rounded-bl-none text-brand-dark flex items-center gap-2 shadow-sm">
              <span className="text-xs text-brand-gray/80 font-bold">{otherUserName} is typing</span>
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Phone Sharing Bar */}
      {currentUser.phoneNumber && !isChatDisabled && gig?.status === "Open" && (
        <div className="bg-slate-50 border-t border-brand-light-gray px-4 py-2 flex justify-between items-center shrink-0">
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Ready to connect?</span>
            <span className="text-[10px] text-brand-gray font-medium">Instantly send your verified number</span>
          </div>
          <button
            type="button"
            disabled={isSending}
            onClick={async () => {
              if (isSending) return;
              setIsSending(true);
              const phoneMsgText = `📞 Here is my phone number: +91 ${currentUser.phoneNumber}. Let's discuss details over a quick call!`;
              try {
                const messagesPath = `chats/${thread.id}/messages`;
                const messageId = doc(collection(db, messagesPath)).id;
                
                const newMsg: ChatMessage = {
                  id: messageId,
                  senderEmail: currentUser.email,
                  senderName: currentUser.fullName || currentUser.email,
                  text: phoneMsgText,
                  timestamp: Date.now(),
                  read: false,
                };

                await setDoc(doc(db, messagesPath, messageId), newMsg);

                const otherEmail = (thread.participants || []).find(
                  (p) => p.toLowerCase() !== currentUser.email.toLowerCase()
                );
                const updates: Record<string, any> = {
                  lastMessage: phoneMsgText,
                  lastMessageSender: currentUser.email,
                  lastMessageTime: Date.now(),
                };

                if (otherEmail) {
                  const safeOtherEmail = otherEmail.toLowerCase().replace(/\./g, "_");
                  const threadRef = doc(db, "chats", thread.id);
                  const threadSnap = await getDoc(threadRef);
                  let currentUnread = 0;
                  if (threadSnap.exists()) {
                    const currentData = threadSnap.data();
                    currentUnread = currentData?.unreadCount?.[safeOtherEmail] || 0;
                  }
                  updates[`unreadCount.${safeOtherEmail}`] = currentUnread + 1;
                }

                await updateDoc(doc(db, "chats", thread.id), updates);
              } catch (error) {
                console.error("Error sharing phone number:", error);
              } finally {
                setIsSending(false);
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] font-extrabold rounded-full active:scale-95 transition-all shadow-sm shadow-brand-primary/10 cursor-pointer disabled:opacity-50"
          >
            <Phone className="w-3 h-3" />
            <span>Share My Phone No.</span>
          </button>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="py-3 px-4 sm:px-6 md:px-8 bg-white border-t border-brand-light-gray flex gap-2 sticky bottom-0 z-10 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => {
            const val = e.target.value;
            setInputText(val);

            if (thread.disabled || gig?.status === "Completed" || gig?.status === "Cancelled") return;

            // Mark typing as true if not already typing
            if (!isTypingRef.current) {
              updateTypingStatus(true);
            }

            // Reset typing timeout
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
              updateTypingStatus(false);
            }, 3000);
          }}
          placeholder={thread.disabled || gig?.status === "Completed" || gig?.status === "Cancelled" ? "Chat has been closed" : "Type a message..."}
          disabled={thread.disabled || gig?.status === "Completed" || gig?.status === "Cancelled" || isSending}
          className="flex-1 bg-brand-light-gray/50 border border-brand-outline rounded-2xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-brand-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending || thread.disabled || gig?.status === "Completed" || gig?.status === "Cancelled"}
          className="h-10 w-10 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-brand-light-gray text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-md shadow-brand-primary/10 shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* 📋 Confirm Details Modal Overlay */}
      {showConfirmModal && gig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-200 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-primary" />
                <span>Confirm Gig Details</span>
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Gig Title (Read-Only)</span>
              <p className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 truncate">
                {gig.title}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Gig Description (Read-Only)</span>
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-3">
                {gig.description}
              </p>
            </div>

            {/* Editable Agreed Price */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <span>Final Agreed Price (₹)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9,]*"
                value={agreedPrice}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  const cleanVal = rawVal.replace(/[^0-9]/g, "");
                  if (cleanVal === "") {
                    setAgreedPrice("");
                    return;
                  }
                  const numVal = parseInt(cleanVal, 10);
                  if (numVal < 0 || numVal > 10000000) return;
                  setAgreedPrice(numVal.toLocaleString("en-IN"));
                }}
                placeholder="E.g. 500"
                className="w-full bg-white border border-brand-outline rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* Editable Agreed Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <span>Agreed Date</span>
              </label>
              <input
                id="agreed-date-input"
                type="date"
                value={agreedDate}
                onChange={(e) => setAgreedDate(e.target.value)}
                className="w-full bg-white border border-brand-outline rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* Time Slot Inputs */}
            {(() => {
              const timeValidation = getTimeValidationResult();
              const inputBorderClass = timeValidation.isValid
                ? "border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                : "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/20 text-red-900";
              
              return (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-brand-primary" />
                        <span>Start Time</span>
                      </label>
                      <input
                        id="agreed-start-time-input"
                        type="time"
                        value={agreedStartTime}
                        onChange={(e) => setAgreedStartTime(e.target.value)}
                        className={`w-full bg-white border rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none ${inputBorderClass}`}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-brand-primary" />
                        <span>End Time</span>
                      </label>
                      <input
                        id="agreed-end-time-input"
                        type="time"
                        value={agreedEndTime}
                        onChange={(e) => setAgreedEndTime(e.target.value)}
                        className={`w-full bg-white border rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none ${inputBorderClass}`}
                      />
                    </div>
                  </div>

                  {!timeValidation.isValid && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-start gap-1.5 animate-in fade-in duration-200">
                      <span className="text-xs">⚠️</span>
                      <p className="text-[11px] font-semibold text-red-600 leading-tight">
                        {timeValidation.error}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex gap-3 mt-1">
                    <button
                      id="agreed-cancel-proposal-btn"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer text-center text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      id="agreed-send-proposal-btn"
                      onClick={handleSendProposal}
                      disabled={isSending || !timeValidation.isValid}
                      className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white py-3 rounded-xl font-black shadow-md shadow-brand-primary/10 transition-all active:scale-95 cursor-pointer text-center text-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                    >
                      {isSending ? "Sending..." : "Send Proposal"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
