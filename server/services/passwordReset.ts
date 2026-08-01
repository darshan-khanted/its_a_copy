import crypto from "crypto";
import { getFirebaseAdminDb } from "../config/firebase";

export interface PasswordResetToken {
  email: string;
  tokenHash: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Resiliency fallback for reset tokens when the Firestore write path is unavailable.
 * This is a storage fallback only — it never influences any authentication decision
 * and is not conditioned on the request hostname (NFR-3.4).
 */
const passwordResetsInMemoryStore = new Map<string, PasswordResetToken>();

export async function saveResetToken(tokenHash: string, data: PasswordResetToken): Promise<void> {
  try {
    const adminDb = getFirebaseAdminDb();
    await adminDb.collection("password_resets").doc(tokenHash).set(data);
    console.log(
      `[Firestore Token Store] Successfully stored reset token for ${data.email} in Firestore.`,
    );
  } catch (err: any) {
    console.warn(
      `[Token Store Fallback] Storing reset token for ${data.email} in-memory after Firestore write failure: ${err?.message || err}`,
    );
    passwordResetsInMemoryStore.set(tokenHash, data);
  }
}

export async function getResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
  try {
    const adminDb = getFirebaseAdminDb();
    const docSnap = await adminDb.collection("password_resets").doc(tokenHash).get();
    if (docSnap.exists) {
      const data = docSnap.data() as PasswordResetToken;
      console.log(
        `[Firestore Token Store] Successfully retrieved reset token for ${data.email} from Firestore.`,
      );
      return data;
    }
    return passwordResetsInMemoryStore.get(tokenHash) || null;
  } catch (err: any) {
    console.warn(
      `[Token Store Fallback] Retrieving reset token from in-memory store after Firestore read failure: ${err?.message || err}`,
    );
    return passwordResetsInMemoryStore.get(tokenHash) || null;
  }
}

export async function invalidateResetTokensForEmail(email: string): Promise<number> {
  let count = 0;
  for (const [key, val] of passwordResetsInMemoryStore.entries()) {
    if (val.email.toLowerCase() === email.toLowerCase()) {
      passwordResetsInMemoryStore.delete(key);
      count++;
    }
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const snap = await adminDb.collection("password_resets").where("email", "==", email).get();
    if (snap.size > 0) {
      const batch = adminDb.batch();
      snap.forEach((doc: any) => {
        batch.delete(doc.ref);
        count++;
      });
      await batch.commit();
      console.log(
        `[Firestore Token Store] Successfully deleted ${snap.size} reset tokens from Firestore for ${email}.`,
      );
    }
  } catch (err: any) {
    console.warn(
      `[Token Store Fallback] Could not delete Firestore reset tokens for ${email}: ${err?.message || err}`,
    );
  }
  return count;
}

/**
 * Verifies a legacy salted-SHA-256 password in constant time. Returns false on any
 * error rather than throwing, so migration always resolves to a credential decision.
 */
export function legacyVerifyPasswordServer(
  password: string,
  salt: string,
  storedHash: string,
): boolean {
  try {
    const computedHash = crypto.createHash("sha256").update(password + salt).digest("hex");
    if (computedHash.length !== storedHash.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "utf-8"),
      Buffer.from(storedHash, "utf-8"),
    );
  } catch (err) {
    console.error("Server legacy verification failed:", err);
    return false;
  }
}
