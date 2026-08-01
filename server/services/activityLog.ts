import path from "path";
import fs from "fs";
import { getFirebaseAdminDb } from "../config/firebase";

/**
 * Records a server-side activity entry. Falls back to console + local file when the
 * Firestore write is not permitted, so activity logging never throws into a route.
 */
export async function logActivityServer(
  type: string,
  description: string,
  userEmail: string,
  userName: string,
  metadata: any = {},
): Promise<void> {
  try {
    const activityRef = getFirebaseAdminDb().collection("activity_logs").doc();
    await activityRef.set({
      id: activityRef.id,
      type,
      description,
      userEmail,
      userName,
      timestamp: Date.now(),
      metadata,
    });
  } catch (err) {
    console.log(
      `[Activity Log Fallback] Type: ${type} | Desc: ${description} | User: ${userEmail} (${userName}) | Meta: ${JSON.stringify(metadata)}`,
    );
    try {
      const logLine = `${new Date().toISOString()} [${type}] ${userEmail} (${userName}): ${description} ${JSON.stringify(metadata)}\n`;
      fs.appendFileSync(path.join(process.cwd(), "activity_logs.txt"), logLine, "utf-8");
    } catch (fsErr) {
      /* ignored */
    }
  }
}
