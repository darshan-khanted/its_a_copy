import { getFirebaseAdminDb } from "../config/firebase";
import {
  sendEmailServer,
  getPosterDurationEndedEmail,
  getWorkerDurationEndedEmail,
} from "./mailer";

export function isGigEndTimePassed(gig: any): boolean {
  if (!gig) return false;
  if (!gig.date || !gig.endTime || gig.date.includes("Flexible") || gig.endTime.includes("Flexible")) {
    return true;
  }
  try {
    const now = new Date();
    const istTime = now.getTime() + (now.getTimezoneOffset() + 330) * 60000;
    const istNow = new Date(istTime);

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
      year = istNow.getFullYear();
      month = istNow.getMonth() + 1;
      day = istNow.getDate();
    }

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
      hour = parseInt(parts[0].replace(/[^0-9]/g, ""), 10);
      minute = parseInt(parts[1].replace(/[^0-9]/g, ""), 10);

      const upperEndTime = cleanEndTime.toUpperCase();
      if (upperEndTime.includes("PM") && hour < 12) {
        hour += 12;
      } else if (upperEndTime.includes("AM") && hour === 12) {
        hour = 0;
      }
    } else {
      return true;
    }

    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
      const endDateTime = new Date(year, month - 1, day, hour, minute);
      return istNow.getTime() >= endDateTime.getTime();
    }
  } catch (e) {
    console.error("Error parsing end time in isGigEndTimePassed server-side:", e);
  }
  return true;
}

export interface GigCheckReport {
  success: boolean;
  checkedCount: number;
  notifiedCount: number;
  notifiedGigs: Array<{
    id: string;
    title: string;
    posterEmail?: string;
    workerEmail?: string;
    emailsSent: string[];
  }>;
  error?: string;
  inProgress?: boolean;
}

let isCheckingGigs = false;

export async function checkConcludedGigs(): Promise<GigCheckReport> {
  const report: GigCheckReport = {
    success: true,
    checkedCount: 0,
    notifiedCount: 0,
    notifiedGigs: [],
  };

  if (isCheckingGigs) {
    report.success = false;
    report.error = "A gig timeframe check is already actively running.";
    report.inProgress = true;
    return report;
  }
  isCheckingGigs = true;

  try {
    const adminDb = getFirebaseAdminDb();
    const appUrl = process.env.APP_URL || "https://qwickgig.com";

    const gigSnap = await adminDb.collection("gigs").where("status", "==", "In Progress").get();

    if (gigSnap && gigSnap.size > 0) {
      report.checkedCount = gigSnap.size;
      console.log(`[Timer] Checking ${gigSnap.size} "In Progress" gigs for completed duration...`);
      for (const doc of gigSnap.docs) {
        const gig = doc.data();
        if (gig.completionReminderSent) {
          continue;
        }

        if (isGigEndTimePassed(gig)) {
          let shouldSend = false;
          try {
            await adminDb.runTransaction(async (transaction: any) => {
              const gigRef = adminDb.collection("gigs").doc(doc.id);
              const freshDoc = await transaction.get(gigRef);
              if (!freshDoc.exists) return;

              const freshGig = freshDoc.data();
              if (
                freshGig.status === "In Progress" &&
                !freshGig.completionReminderSent &&
                isGigEndTimePassed(freshGig)
              ) {
                transaction.update(gigRef, { completionReminderSent: true });
                shouldSend = true;
              }
            });
          } catch (txErr: any) {
            const errDetail = txErr?.stack || txErr?.message || String(txErr);
            console.error(`[Timer] Transaction failed to claim gig ${doc.id}: ${errDetail}`);
            shouldSend = false;
          }

          if (shouldSend) {
            console.log(
              `[Timer] Gig "${gig.title}" (ID: ${doc.id}) timeframe has ended. Atomic claim successful, sending notifications...`,
            );

            let threadId = "";
            try {
              const threadSnap = await adminDb
                .collection("chats")
                .where("gigId", "==", doc.id)
                .where("participants", "array-contains", gig.acceptedByEmail.toLowerCase())
                .get();
              if (threadSnap && threadSnap.size > 0) {
                threadId = threadSnap.docs[0].id;
              }
            } catch (err) {
              console.error(`[Timer] Error fetching chat thread for gig ${doc.id}:`, err);
            }

            const redirectUrl = threadId
              ? `${appUrl}?redirect=/chat/${threadId}`
              : `${appUrl}?redirect=/gig/${doc.id}`;

            const emailsSent: string[] = [];

            if (gig.posterEmail) {
              try {
                const posterMail = getPosterDurationEndedEmail(
                  gig.posterName || "Client",
                  gig.acceptedByName || "Helper",
                  gig.title,
                  appUrl,
                  redirectUrl,
                );
                await sendEmailServer(gig.posterEmail, posterMail.subject, posterMail.text, posterMail.html);
                console.log(`[Timer] Sent gig timeframe ended reminder email to poster: ${gig.posterEmail}`);
                emailsSent.push("poster");
              } catch (err) {
                console.error(`[Timer] Failed to send email to poster ${gig.posterEmail}:`, err);
              }
            }

            if (gig.acceptedByEmail) {
              try {
                const workerMail = getWorkerDurationEndedEmail(
                  gig.acceptedByName || "Helper",
                  gig.posterName || "Client",
                  gig.title,
                  appUrl,
                  redirectUrl,
                );
                await sendEmailServer(gig.acceptedByEmail, workerMail.subject, workerMail.text, workerMail.html);
                console.log(`[Timer] Sent gig timeframe ended reminder email to worker: ${gig.acceptedByEmail}`);
                emailsSent.push("worker");
              } catch (err) {
                console.error(`[Timer] Failed to send email to worker ${gig.acceptedByEmail}:`, err);
              }
            }

            report.notifiedCount++;
            report.notifiedGigs.push({
              id: doc.id,
              title: gig.title,
              posterEmail: gig.posterEmail,
              workerEmail: gig.acceptedByEmail,
              emailsSent,
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[Timer] Error running checkConcludedGigs background check:", err);
    report.success = false;
    report.error = err.message || String(err);
  } finally {
    isCheckingGigs = false;
  }

  return report;
}

export function startGigTimeframeChecks() {
  console.log("[Timer] Initializing background gig timeframe checking task...");
  checkConcludedGigs();
  setInterval(checkConcludedGigs, 30000);
}
