import express from "express";
import crypto from "crypto";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
  FieldValue,
} from "../config/firebase";
import { authRateLimiter } from "../middleware/rateLimit";
import { verifyIdToken } from "../middleware/auth";
import { logActivityServer } from "../services/activityLog";
import {
  legacyVerifyPasswordServer,
  saveResetToken,
  getResetToken,
  invalidateResetTokensForEmail,
} from "../services/passwordReset";
import { sendEmailServer, getWelcomeEmail, getPasswordResetEmail } from "../services/mailer";

const router = express.Router();

/**
 * Server-side atomic registration: creates the Firebase Auth user, creates the
 * Firestore user document, and sends the welcome email.
 */
router.post("/register", authRateLimiter, async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const password = req.body.password;
  const fullName = req.body.fullName || "Neighbor";

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required." });
  }

  try {
    const adminAuth = getFirebaseAdminAuth();
    const adminDb = getFirebaseAdminDb();

    const userDocRef = adminDb.collection("users").doc(email);
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
      return res.status(400).json({ success: false, error: "An account with this email already exists." });
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
    });

    const userRecordDoc = {
      email,
      fullName,
      rating: 4.8,
      ratingCount: 5,
      onboardingCompleted: false,
      createdAt: Date.now(),
      phoneNumber: "",
    };
    await userDocRef.set(userRecordDoc);

    await logActivityServer("signup", `User ${fullName} registered a new account`, email, fullName);

    const appUrl = process.env.APP_URL || "https://qwickgig.com";
    const { subject, html: htmlContent, text: plainText } = getWelcomeEmail(fullName, appUrl);

    try {
      await sendEmailServer(email, subject, plainText, htmlContent);
    } catch (emailErr: any) {
      console.error(`[SMTP Welcome Email Error] Non-fatal welcome email delivery failure to ${email}:`, emailErr);
    }

    return res.json({ success: true, email: userRecord.email });
  } catch (err: any) {
    console.error("Server native signup failed:", err);
    let errorMsg = err.message || "Failed to create account.";
    if (err.code === "auth/email-already-in-use") {
      errorMsg = "An account with this email already exists.";
    } else if (err.code === "auth/weak-password") {
      errorMsg = "Password is too weak. Please use at least 6 characters.";
    }
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * Completes Google sign-up: verifies the ID token, creates the user document if
 * missing, and sends the welcome email.
 */
router.post("/complete-google-signup", authRateLimiter, async (req, res) => {
  try {
    const decodedToken = await verifyIdToken(req);
    const email = decodedToken.email?.toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, error: "Invalid token details. Email not found." });
    }

    const fullName = req.body.fullName || decodedToken.name || "Neighbor";
    const adminDb = getFirebaseAdminDb();

    const userDocRef = adminDb.collection("users").doc(email);
    const docSnap = await userDocRef.get();

    if (!docSnap.exists) {
      const userRecordDoc = {
        email,
        fullName,
        rating: 4.8,
        ratingCount: 5,
        onboardingCompleted: false,
        createdAt: Date.now(),
        phoneNumber: "",
      };
      await userDocRef.set(userRecordDoc);

      await logActivityServer("signup", `User ${fullName} registered a new account via Google OAuth`, email, fullName);

      const appUrl = process.env.APP_URL || "https://qwickgig.com";
      const { subject, html: htmlContent, text: plainText } = getWelcomeEmail(fullName, appUrl);

      try {
        await sendEmailServer(email, subject, plainText, htmlContent);
      } catch (emailErr: any) {
        console.error(`[SMTP Welcome Email Error] Non-fatal Google welcome email delivery failure to ${email}:`, emailErr);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Google complete signup failed:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to complete signup." });
  }
});

/**
 * Migrates a legacy salted-hash credential to Firebase Auth. On any verification
 * failure it returns invalid-credentials and NEVER accepts the login on the mere
 * existence of a user document (requirement 23.10, NFR-3.4). There is no sandbox or
 * hostname fallback: a real Firebase Auth user is always created/updated, or the
 * migration fails closed.
 */
router.post("/migrate-legacy-user", authRateLimiter, async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required." });
  }

  const dummySalt = "dummysalt123456789012345678901234";
  const dummyHash = crypto.createHash("sha256").update("dummypassword" + dummySalt).digest("hex");
  const dummyVerify = () => {
    legacyVerifyPasswordServer("dummypassword", dummySalt, dummyHash);
  };

  const genericErrorResponse = () =>
    res.status(401).json({
      success: false,
      error: "Invalid email or password.",
    });

  const startTime = Date.now();
  const minExecutionTimeMs = 600;

  const delayIfNeeded = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < minExecutionTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, minExecutionTimeMs - elapsed));
    }
  };

  try {
    const userDocRef = getFirebaseAdminDb().collection("users").doc(email);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      dummyVerify();
      await logActivityServer("failed_login", `Migration failed: Account does not exist`, email, email);
      await delayIfNeeded();
      return genericErrorResponse();
    }

    const userData = userDocSnap.data() || {};
    const { passwordHash, passwordSalt, fullName } = userData;

    if (!passwordHash || !passwordSalt) {
      dummyVerify();
      await logActivityServer("failed_login", `Migration failed: No legacy credentials exist for this account`, email, fullName || email);
      await delayIfNeeded();
      return genericErrorResponse();
    }

    const isMatched = legacyVerifyPasswordServer(password, passwordSalt, passwordHash);
    if (!isMatched) {
      await logActivityServer("failed_login", `Migration failed: Incorrect legacy password entered`, email, fullName || email);
      await delayIfNeeded();
      return genericErrorResponse();
    }

    // Passwords match — establish the real Firebase Auth record. No sandbox bypass:
    // if Auth is unavailable the migration fails closed rather than fabricating a user.
    let authUser: any = null;
    try {
      authUser = await getFirebaseAdminAuth().getUserByEmail(email);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        authUser = await getFirebaseAdminAuth().createUser({
          email,
          password,
          displayName: fullName || email,
        });
      } else {
        throw err;
      }
    }

    if (authUser) {
      await getFirebaseAdminAuth().updateUser(authUser.uid, {
        password: password,
      });
    }

    await userDocRef.update({
      passwordHash: FieldValue.delete(),
      passwordSalt: FieldValue.delete(),
    });

    await logActivityServer("login", `User ${fullName || email} successfully migrated and authenticated`, email, fullName || email);

    return res.json({ success: true, message: "Migration successful!" });
  } catch (err: any) {
    // Never accept the login on document existence: any unexpected failure resolves
    // to invalid-credentials (fail closed).
    console.log("Migration error (handled):", err.message || err);
    await delayIfNeeded();
    return genericErrorResponse();
  }
});

/**
 * Custom password reset flow backed by hashed, expiring tokens.
 */
router.post("/request-password-reset", authRateLimiter, async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required." });
  }

  const genericResponse = {
    success: true,
    message: "If an account with that email exists, a password reset link has been sent.",
  };

  const startTime = Date.now();
  const minExecutionTimeMs = 600;

  const delayIfNeeded = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < minExecutionTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, minExecutionTimeMs - elapsed));
    }
  };

  try {
    let userExists = false;
    try {
      const userDocRef = getFirebaseAdminDb().collection("users").doc(email);
      const userDocSnap = await userDocRef.get();
      userExists = userDocSnap.exists;
    } catch (dbErr: any) {
      console.warn("Could not check user existence via Firestore:", dbErr.message || dbErr);
      userExists = true; // Fail toward not leaking enumeration signal
    }

    if (!userExists) {
      await delayIfNeeded();
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = Date.now() + 30 * 60 * 1000;

    await saveResetToken(tokenHash, {
      email: email,
      tokenHash: tokenHash,
      expiresAt: expiresAt,
      createdAt: Date.now(),
    });

    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host") || "qwickgig.com";
    const baseAppUrl = process.env.APP_URL || `${protocol}://${host}`;
    const resetLink = `${baseAppUrl}/reset-password?token=${rawToken}`;

    const { subject, html, text } = getPasswordResetEmail(resetLink, baseAppUrl);
    const emailSent = await sendEmailServer(email, subject, text, html);

    if (emailSent) {
      await logActivityServer("password_reset_request", `Custom password reset link sent successfully via SMTP to ${email}`, email, email);
    } else {
      console.warn(`Could not deliver custom SMTP email to ${email}`);
    }

    await delayIfNeeded();
    return res.json(genericResponse);
  } catch (err: any) {
    console.log("Error in custom request-password-reset (handled):", err.message || err);
    await delayIfNeeded();
    return res.json(genericResponse);
  }
});

router.post("/verify-reset-token", authRateLimiter, async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: "Token is required." });
  }

  const startTime = Date.now();
  const minExecutionTimeMs = 600;

  const delayIfNeeded = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < minExecutionTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, minExecutionTimeMs - elapsed));
    }
  };

  try {
    const incomingHash = crypto.createHash("sha256").update(token).digest("hex");
    const matchedReset = await getResetToken(incomingHash);

    if (!matchedReset || matchedReset.expiresAt <= Date.now()) {
      await delayIfNeeded();
      return res.status(400).json({ success: false, error: "Invalid or expired reset token." });
    }

    await delayIfNeeded();
    return res.json({ success: true, email: matchedReset.email });
  } catch (err: any) {
    console.error("Error verifying reset token:", err.message || err);
    await delayIfNeeded();
    return res.status(500).json({ success: false, error: "An error occurred while verifying the token." });
  }
});

router.post("/confirm-password-reset", authRateLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, error: "Token and password are required." });
  }

  const startTime = Date.now();
  const minExecutionTimeMs = 600;

  const delayIfNeeded = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < minExecutionTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, minExecutionTimeMs - elapsed));
    }
  };

  try {
    const incomingHash = crypto.createHash("sha256").update(token).digest("hex");
    const matchedReset = await getResetToken(incomingHash);

    if (!matchedReset || matchedReset.expiresAt <= Date.now()) {
      await delayIfNeeded();
      return res.status(400).json({ success: false, error: "Invalid or expired reset token." });
    }

    const email = matchedReset.email;

    const adminAuth = getFirebaseAdminAuth();
    const authUser = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(authUser.uid, { password: password });
    console.log(`Successfully updated Firebase Auth password for ${email}`);

    await invalidateResetTokensForEmail(email);

    await logActivityServer("password_reset_confirm", `Password reset completed successfully for ${email}`, email, email);

    await delayIfNeeded();
    return res.json({ success: true, message: "Your password has been reset successfully." });
  } catch (err: any) {
    console.error("Error confirming password reset:", err.message || err);
    await delayIfNeeded();
    return res.status(500).json({ success: false, error: err.message || "An error occurred while resetting your password." });
  }
});

export default router;
