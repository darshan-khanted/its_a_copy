import { auth } from "../firebase";

const robustFetch = async (url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err: any) {
      const isNetworkError = err instanceof TypeError || (err.message && err.message.toLowerCase().includes("fetch"));
      if (isNetworkError && i < retries - 1) {
        console.warn(`[RobustFetch] Network error fetching ${url}, retrying in ${delay}ms... (${i + 1}/${retries})`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  return fetch(url, options);
};

export const getClientAuthToken = async (): Promise<string> => {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch (err) {
    console.warn("Could not get Firebase Auth token natively:", err);
  }
  // Fallback if not authenticated via Firebase SDK but we have a currentUser in React state
  const savedUserStr = localStorage.getItem("qwick_currentUser");
  if (savedUserStr) {
    try {
      const savedUser = JSON.parse(savedUserStr);
      if (savedUser && savedUser.email) {
        return `sandbox-token:${savedUser.email}:${encodeURIComponent(savedUser.fullName || "Neighbor")}`;
      }
    } catch (e) {
      console.warn("Failed to parse saved user for token generation:", e);
    }
  }
  return "sandbox-test-token";
};

export const sendNotificationEmail = async (
  to: string,
  type: "inbox_message" | "gig_interest" | "proposal_accepted" | "negotiation_proposed",
  senderName: string,
  options?: { 
    gigTitle?: string; 
    messageContent?: string; 
    price?: number;
    threadId?: string;
    gigId?: string;
    workerEmail?: string;
    proposedPrice?: number;
    finalPrice?: number;
    recipientEmail?: string;
  }
) => {
  try {
    console.log(`[SMTP-CLIENT] sendNotificationEmail triggered for type=${type} to=${to}`);
    const idToken = await getClientAuthToken();
    if (!idToken) {
      console.warn("[SMTP-CLIENT] No auth token found. Cannot send notification email.");
      return;
    }

    const payload = {
      to,
      type,
      senderName,
      gigTitle: options?.gigTitle,
      messageContent: options?.messageContent,
      text: options?.messageContent, // Match server-side expectation
      price: options?.price,
      threadId: options?.threadId,
      gigId: options?.gigId,
      workerEmail: options?.workerEmail,
      proposedPrice: options?.proposedPrice,
      finalPrice: options?.finalPrice,
      recipientEmail: options?.recipientEmail,
      appUrl: window.location.origin
    };

    console.log(`[SMTP-CLIENT] Dispatching fetch to /api/emails/send-notification with type=${type}`);
    const res = await robustFetch("/api/emails/send-notification", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(`[SMTP-CLIENT] Response for notification email (${type}):`, data);
  } catch (err) {
    console.warn(`[SMTP-CLIENT] Failed to send notification email (${type}):`, err);
  }
};
