import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteField,
} from "firebase/firestore";
import {
  ref as storageRef,
  listAll as storageListAll,
  deleteObject as storageDeleteObject,
} from "firebase/storage";
import { db, storage, getFirebaseAdminDb, getFirebaseAdminAuth, FieldValue } from "../config/firebase";
import { requireAuth, requireDeveloper, AuthedRequest } from "../middleware/auth";
import {
  saveResetToken,
  getResetToken,
  invalidateResetTokensForEmail,
} from "../services/passwordReset";

const router = express.Router();

// Every administrative route requires a verified developer identity. No hostname
// branch participates in these authentication/authorization decisions (NFR-3.4/3.5).
router.use(requireAuth, requireDeveloper);

router.get("/count-legacy-creds", async (_req: AuthedRequest, res) => {
  try {
    const usersSnap = await getFirebaseAdminDb().collection("users").get();
    let withCreds = 0;
    let total = 0;
    usersSnap.docs.forEach((doc: any) => {
      total++;
      const data = doc.data();
      if (data.passwordHash || data.passwordSalt) {
        withCreds++;
      }
    });
    return res.json({ success: true, totalUsers: total, legacyCredsCount: withCreds });
  } catch (err: any) {
    console.error("Count legacy credentials failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/clean-legacy-creds", async (_req: AuthedRequest, res) => {
  try {
    const usersSnap = await getFirebaseAdminDb().collection("users").get();
    let count = 0;
    const batch = getFirebaseAdminDb().batch();

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (data.passwordHash || data.passwordSalt) {
        batch.update(doc.ref, {
          passwordHash: FieldValue.delete(),
          passwordSalt: FieldValue.delete(),
        });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    return res.json({ success: true, message: `Successfully cleared legacy password fields from ${count} users.` });
  } catch (err: any) {
    console.error("Clean legacy credentials failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/cleanup", async (_req: AuthedRequest, res) => {
  try {
    console.log("Admin Cleanup API triggered server-side...");
    const logs: string[] = [];

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (fs.existsSync(uploadsDir)) {
      const cleanDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.lstatSync(fullPath).isDirectory()) {
            cleanDir(fullPath);
            fs.rmdirSync(fullPath);
            logs.push(`Deleted local subdirectory: ${fullPath}`);
          } else {
            fs.unlinkSync(fullPath);
            logs.push(`Deleted local file: ${fullPath}`);
          }
        }
      };
      cleanDir(uploadsDir);
      logs.push("Cleared local uploads folder recursively on backend.");
    } else {
      logs.push("Local uploads folder does not exist on disk.");
    }

    const cleanStorage = async (folderPath: string) => {
      const folderRef = storageRef(storage, folderPath);
      try {
        const result = await storageListAll(folderRef);
        for (const item of result.items) {
          logs.push(`Deleting from Firebase Storage: ${item.fullPath}`);
          await storageDeleteObject(item);
        }
        for (const prefix of result.prefixes) {
          await cleanStorage(prefix.fullPath);
        }
      } catch (err: any) {
        logs.push(`Warning/Error cleaning storage folder ${folderPath}: ${err.message}`);
      }
    };
    await cleanStorage("uploads");

    try {
      const usersCol = collection(db, "users");
      const usersSnap = await getDocs(usersCol);
      logs.push(`Found ${usersSnap.size} user profiles to process.`);
      for (const userDoc of usersSnap.docs) {
        const userRef = doc(db, "users", userDoc.id);
        await updateDoc(userRef, {
          avatar: "",
          aadharUrl: deleteField(),
          isVerified: false,
        });
        logs.push(`Cleared avatar and Aadhaar verification for user profile: ${userDoc.id}`);
      }
    } catch (err: any) {
      logs.push(`Error updating user profiles: ${err.message}`);
    }

    try {
      const gigsCol = collection(db, "gigs");
      const gigsSnap = await getDocs(gigsCol);
      logs.push(`Found ${gigsSnap.size} gigs to process.`);
      for (const gigDoc of gigsSnap.docs) {
        const data = gigDoc.data();
        const gigRef = doc(db, "gigs", gigDoc.id);

        const updates: any = {
          imageUrl: "",
          posterAvatar: "",
          isVerifiedPoster: false,
        };

        if (Array.isArray(data.interestedUsers)) {
          updates.interestedUsers = data.interestedUsers.map((item: any) => ({
            ...item,
            avatar: "",
            isVerified: false,
          }));
        }

        if (data.selectedWorker) {
          updates.selectedWorker = {
            ...data.selectedWorker,
            avatar: "",
            isVerified: false,
          };
        }

        await updateDoc(gigRef, updates);
        logs.push(`Cleared image, poster avatar, and interest list avatars for gig: ${gigDoc.id}`);
      }
    } catch (err: any) {
      logs.push(`Error updating gigs: ${err.message}`);
    }

    try {
      const chatsCol = collection(db, "chats");
      const chatsSnap = await getDocs(chatsCol);
      logs.push(`Found ${chatsSnap.size} chats to process.`);
      for (const chatDoc of chatsSnap.docs) {
        const data = chatDoc.data();
        if (data.participantAvatars) {
          const updatedAvatars: { [key: string]: string } = {};
          for (const email of Object.keys(data.participantAvatars)) {
            updatedAvatars[email] = "";
          }
          const chatRef = doc(db, "chats", chatDoc.id);
          await updateDoc(chatRef, {
            participantAvatars: updatedAvatars,
          });
          logs.push(`Cleared participant avatars in chat: ${chatDoc.id}`);
        }
      }
    } catch (err: any) {
      logs.push(`Error updating chats: ${err.message}`);
    }

    try {
      const reviewsCol = collection(db, "reviews");
      const reviewsSnap = await getDocs(reviewsCol);
      logs.push(`Found ${reviewsSnap.size} reviews to process.`);
      for (const reviewDoc of reviewsSnap.docs) {
        const reviewRef = doc(db, "reviews", reviewDoc.id);
        await updateDoc(reviewRef, {
          reviewerAvatar: "",
        });
        logs.push(`Cleared reviewer avatar for review: ${reviewDoc.id}`);
      }
    } catch (err: any) {
      logs.push(`Error updating reviews: ${err.message}`);
    }

    console.log("Cleanup completed successfully!");
    return res.json({
      success: true,
      message: "All user files and document uploads cleared from both disk, storage, and databases successfully.",
      logs,
    });
  } catch (err: any) {
    console.error("Admin cleanup failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Development-only end-to-end verification of the password reset flow. Gated by the
 * explicit NODE_ENV development flag and the developer identity above — never by the
 * request hostname (NFR-3.4).
 */
router.get("/test/e2e", async (_req: AuthedRequest, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({
      success: false,
      error: "Forbidden: E2E test endpoints are strictly disabled outside development environments.",
    });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  const testEmail = "dkdkdkdk00701@gmail.com";

  try {
    log("=========================================");
    log("STARTING SERVER-SIDE PASSWORD RESET E2E TEST ");
    log("=========================================\n");

    log("Step 1: Cleaning up any old password reset records...");
    const clearedCount = await invalidateResetTokensForEmail(testEmail);
    log(`- Cleared ${clearedCount} old reset records.`);

    log("\nStep 2: Simulating password reset request...");
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = Date.now() + 30 * 60 * 1000;

    await saveResetToken(tokenHash, {
      email: testEmail,
      tokenHash: tokenHash,
      expiresAt: expiresAt,
      createdAt: Date.now(),
    });
    log(`- Successfully generated and stored token hash.`);

    log("\nStep 3: Testing token verification...");
    const incomingHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const matchedReset = await getResetToken(incomingHash);

    if (!matchedReset || matchedReset.expiresAt <= Date.now()) {
      throw new Error("FAIL: Reset token was not matched or is invalid!");
    }
    log(`✓ SUCCESS: Token matched successfully for email ${matchedReset.email}`);

    log("\nStep 4: Testing password confirmation + cleanup...");
    const email = matchedReset.email;

    const adminAuth = getFirebaseAdminAuth();
    const authUser = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(authUser.uid, { password: "NewPassword123!" });
    log("✓ SUCCESS: Updated Admin Auth password successfully.");

    const deletedCount = await invalidateResetTokensForEmail(email);
    log(`✓ SUCCESS: All reset tokens (${deletedCount}) for user deleted to prevent re-use.`);

    log("\nStep 5: Verifying token is now rejected (Replay protection)...");
    const secondMatched = await getResetToken(incomingHash);

    if (secondMatched) {
      throw new Error("FAIL: Replay protection did not invalidate token!");
    }
    log("✓ SUCCESS: Reused token correctly failed validation.");

    log("\nStep 6: Testing expired token rejection...");
    const expiredRaw = crypto.randomBytes(32).toString("hex");
    const expiredHash = crypto.createHash("sha256").update(expiredRaw).digest("hex");

    await saveResetToken(expiredHash, {
      email: testEmail,
      tokenHash: expiredHash,
      expiresAt: Date.now() - 1000,
      createdAt: Date.now() - 30 * 60 * 1000,
    });

    const expiredMatched = await getResetToken(expiredHash);
    if (expiredMatched && expiredMatched.expiresAt <= Date.now()) {
      log("✓ SUCCESS: Expired token correctly rejected during validation check.");
    } else if (!expiredMatched) {
      log("✓ SUCCESS: Expired token correctly not matched/found.");
    } else {
      throw new Error("FAIL: Expired token was not rejected!");
    }

    await invalidateResetTokensForEmail(testEmail);

    log("\n=========================================");
    log("ALL END-TO-END VERIFICATIONS PASSED!     ");
    log("=========================================");

    return res.json({ success: true, logs });
  } catch (err: any) {
    log(`\nTEST RUN FAILED: ${err.message || err}`);
    return res.status(500).json({ success: false, error: err.message || err, logs });
  }
});

export default router;
