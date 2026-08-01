import express from "express";
import { getFirebaseAdminDb } from "../config/firebase";
import { emailNotificationRateLimiter } from "../middleware/rateLimit";
import { requireAuth, requireDeveloper, AuthedRequest, DEVELOPER_EMAIL } from "../middleware/auth";
import { logActivityServer } from "../services/activityLog";
import {
  sendEmailServer,
  getWelcomeEmail,
  getInboxMessageEmail,
  getGigInterestEmail,
  getProposalAcceptedEmail,
  getNegotiationProposedEmail,
  getPasswordResetEmail,
} from "../services/mailer";

const router = express.Router();

/**
 * Authenticated welcome-email trigger.
 */
router.post("/send-welcome", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const email = req.auth?.email?.toLowerCase().trim();
    if (!email) {
      return res.status(401).json({ success: false, error: "Unauthorized: Invalid token details. Email not found." });
    }

    const adminDb = getFirebaseAdminDb();
    const userDoc = await adminDb.collection("users").doc(email).get();
    const userName = userDoc.exists ? userDoc.data()!.fullName || "Neighbor" : req.auth?.name || "Neighbor";

    const appUrl = process.env.APP_URL || "https://qwickgig.com";
    const { subject, html: htmlContent, text: plainText } = getWelcomeEmail(userName, appUrl);

    let sent = false;
    sent = await sendEmailServer(email, subject, plainText, htmlContent);
    await logActivityServer("welcome_email_sent", `Welcome email sent successfully to ${email}`, email, userName, { sent });

    return res.json({ success: true, sent });
  } catch (err: any) {
    console.error("Welcome email route error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to send welcome email." });
  }
});

/**
 * Authenticated dynamic platform-notification email. All recipient/content data is
 * resolved server-side from verified records.
 */
router.post("/send-notification", emailNotificationRateLimiter, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const callerEmail = req.auth?.email?.toLowerCase().trim();
    if (!callerEmail) {
      console.error("[SMTP-ROUTE] Auth validation failed: Email not found in decoded token");
      return res.status(401).json({ success: false, error: "Invalid token details. Email not found." });
    }

    const { type } = req.body;
    if (!type || !["inbox_message", "gig_interest", "proposal_accepted", "negotiation_proposed"].includes(type)) {
      console.error(`[SMTP-ROUTE] Invalid notification type requested: type=${type}`);
      return res.status(400).json({ success: false, error: "Invalid notification type." });
    }

    console.log(`[SMTP-ROUTE] Received notification request of type=${type} from caller=${callerEmail}`);

    const appUrl = process.env.APP_URL || "https://qwickgig.com";
    const adminDb = getFirebaseAdminDb();

    let to = "";
    let senderName = req.auth?.name || callerEmail;
    let gigTitle = "";
    let price: number | undefined;
    let messageContent = "";

    if (type === "inbox_message") {
      const { threadId, text } = req.body;
      if (!threadId) {
        return res.status(400).json({ success: false, error: "threadId is required for inbox_message type." });
      }

      const threadDoc = await adminDb.collection("chats").doc(threadId).get();
      if (!threadDoc.exists) {
        return res.status(404).json({ success: false, error: "Chat thread not found." });
      }

      const threadData = threadDoc.data()!;
      const participants = threadData.participants || [];

      if (!participants.map((p: string) => p.toLowerCase()).includes(callerEmail)) {
        return res.status(403).json({ success: false, error: "Forbidden: You are not a participant in this chat thread." });
      }

      to = participants.find((p: string) => p.toLowerCase() !== callerEmail) || "";
      if (!to) {
        return res.status(400).json({ success: false, error: "Recipient not found in chat participants." });
      }

      senderName = threadData.participantNames?.[callerEmail] || req.auth?.name || callerEmail;
      messageContent = text || req.body.messageContent || "Sent a message";
      gigTitle = threadData.gigTitle || "Active Chat";
    } else if (type === "gig_interest") {
      const { gigId, proposedPrice } = req.body;
      if (!gigId) {
        return res.status(400).json({ success: false, error: "gigId is required for gig_interest type." });
      }

      const gigDoc = await adminDb.collection("gigs").doc(gigId).get();
      if (!gigDoc.exists) {
        return res.status(404).json({ success: false, error: "Gig not found." });
      }

      const gigData = gigDoc.data()!;

      const contactDoc = await adminDb.collection("gigs").doc(gigId).collection("private").doc("contact").get();
      const contactData = contactDoc.exists ? contactDoc.data() : null;
      to = (contactData?.posterEmail || "").toLowerCase().trim();

      gigTitle = gigData.title;
      price = proposedPrice !== undefined ? proposedPrice : gigData.price;

      const callerProfileDoc = await adminDb.collection("users").doc(callerEmail).get();
      if (callerProfileDoc.exists) {
        senderName = callerProfileDoc.data()!.fullName || req.auth?.name || callerEmail;
      }
    } else if (type === "proposal_accepted") {
      const { gigId, workerEmail, finalPrice } = req.body;
      if (!gigId || !workerEmail) {
        return res.status(400).json({ success: false, error: "gigId and workerEmail are required." });
      }

      const gigDoc = await adminDb.collection("gigs").doc(gigId).get();
      if (!gigDoc.exists) {
        return res.status(404).json({ success: false, error: "Gig not found." });
      }

      const gigData = gigDoc.data()!;

      const contactDoc = await adminDb.collection("gigs").doc(gigId).collection("private").doc("contact").get();
      const contactData = contactDoc.exists ? contactDoc.data() : null;
      const posterEmail = (contactData?.posterEmail || "").toLowerCase().trim();

      const workerEmailLower = workerEmail.toLowerCase().trim();

      if (callerEmail === posterEmail) {
        to = workerEmailLower;
        senderName = gigData.posterName || req.auth?.name || callerEmail;
        gigTitle = gigData.title;
        price = finalPrice !== undefined ? finalPrice : gigData.price;
      } else if (callerEmail === workerEmailLower) {
        to = posterEmail;
        senderName = req.auth?.name || callerEmail;
        gigTitle = gigData.title;
        price = finalPrice !== undefined ? finalPrice : gigData.price;
      } else {
        return res.status(403).json({ success: false, error: "Forbidden: You must be either the gig owner or the worker to confirm this proposal." });
      }
    } else if (type === "negotiation_proposed") {
      const { gigId, proposedPrice } = req.body;
      if (!gigId || proposedPrice === undefined) {
        return res.status(400).json({ success: false, error: "gigId and proposedPrice are required." });
      }

      const gigDoc = await adminDb.collection("gigs").doc(gigId).get();
      if (!gigDoc.exists) {
        return res.status(404).json({ success: false, error: "Gig not found." });
      }

      const gigData = gigDoc.data()!;

      const contactDoc = await adminDb.collection("gigs").doc(gigId).collection("private").doc("contact").get();
      const contactData = contactDoc.exists ? contactDoc.data() : null;
      const posterEmail = (contactData?.posterEmail || "").toLowerCase().trim();

      if (callerEmail === posterEmail) {
        const { recipientEmail } = req.body;
        if (!recipientEmail) {
          return res.status(400).json({ success: false, error: "recipientEmail is required when poster initiates negotiation." });
        }
        to = recipientEmail.toLowerCase().trim();
      } else {
        to = posterEmail;
      }

      gigTitle = gigData.title;
      price = proposedPrice;
      senderName = req.auth?.name || callerEmail;
    }

    if (!to) {
      return res.status(400).json({ success: false, error: "Unable to resolve recipient email address." });
    }

    let subject = "";
    let plainText = "";
    let htmlContent = "";

    if (type === "inbox_message") {
      const { threadId } = req.body;
      const emailData = getInboxMessageEmail(senderName, messageContent || "", gigTitle || "", appUrl, threadId);
      subject = emailData.subject;
      plainText = emailData.text;
      htmlContent = emailData.html;
    } else if (type === "gig_interest") {
      const { gigId } = req.body;
      const emailData = getGigInterestEmail(senderName, gigTitle || "", price, appUrl, gigId);
      subject = emailData.subject;
      plainText = emailData.text;
      htmlContent = emailData.html;
    } else if (type === "proposal_accepted") {
      const { threadId } = req.body;
      const emailData = getProposalAcceptedEmail(senderName, gigTitle || "", price, appUrl, threadId);
      subject = emailData.subject;
      plainText = emailData.text;
      htmlContent = emailData.html;
    } else if (type === "negotiation_proposed") {
      const { gigId } = req.body;
      const emailData = getNegotiationProposedEmail(senderName, gigTitle || "", price!, appUrl, gigId);
      subject = emailData.subject;
      plainText = emailData.text;
      htmlContent = emailData.html;
    } else {
      return res.status(400).json({ success: false, error: `Invalid notification type: ${type}` });
    }

    const sent = await sendEmailServer(to, subject, plainText, htmlContent);
    await logActivityServer("notification_email_sent", `Notification email (${type}) sent successfully to ${to}`, to, to, { sent, type, gigTitle });

    return res.json({ success: true, sent });
  } catch (err: any) {
    console.error("Notification email route error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to send notification email." });
  }
});

/**
 * Development-only test harness that sends every email template to the developer's
 * own inbox. Gated by the explicit NODE_ENV development flag plus a verified
 * developer identity — never by request hostname.
 */
router.post("/test-send-all", requireAuth, requireDeveloper, async (req: AuthedRequest, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({
      success: false,
      error: "Forbidden: Test email endpoints are strictly disabled except in development environments.",
    });
  }

  try {
    const targetEmail = req.body.email?.toLowerCase().trim();
    const email = targetEmail;

    if (targetEmail !== DEVELOPER_EMAIL) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Only the verified developer (${DEVELOPER_EMAIL}) can receive test emails.`,
      });
    }

    const testResults: Record<string, boolean> = {};
    const appUrl = process.env.APP_URL || "https://qwickgig.com";

    const welcomeMail = getWelcomeEmail("Test Neighbor", appUrl);
    testResults.welcome = await sendEmailServer(email, welcomeMail.subject, welcomeMail.text, welcomeMail.html);

    const msgMail = getInboxMessageEmail("Test Neighbor", "Hey, can you help with the lawn tomorrow?", "Garden Weeding", appUrl, "test-thread-id");
    testResults.inbox_message = await sendEmailServer(email, msgMail.subject, msgMail.text, msgMail.html);

    const interestMail = getGigInterestEmail("Test Helper", "Garden Weeding", 500, appUrl, "test-gig-id");
    testResults.gig_interest = await sendEmailServer(email, interestMail.subject, interestMail.text, interestMail.html);

    const acceptedMail = getProposalAcceptedEmail("Test Owner", "Garden Weeding", 500, appUrl, "test-thread-id");
    testResults.proposal_accepted = await sendEmailServer(email, acceptedMail.subject, acceptedMail.text, acceptedMail.html);

    const negoMail = getNegotiationProposedEmail("Test Negotiator", "Garden Weeding", 450, appUrl, "test-gig-id");
    testResults.negotiation_proposed = await sendEmailServer(email, negoMail.subject, negoMail.text, negoMail.html);

    const resetLink = `${appUrl}/reset-password?token=test_token_xyz123`;
    const resetMail = getPasswordResetEmail(resetLink, appUrl);
    testResults.password_reset = await sendEmailServer(email, resetMail.subject, resetMail.text, resetMail.html);

    return res.json({ success: true, testResults });
  } catch (err: any) {
    console.error("Test email sending failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
