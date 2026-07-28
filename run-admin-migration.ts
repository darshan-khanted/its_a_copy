import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// Load Firebase Web Config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Initialize client-side Firebase app
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function runMigration() {
  console.log("=== STARTING CLIENT-PROXY ADMIN FIRESTORE MIGRATION ===");
  console.log(`Targeting Database: ${firebaseConfig.firestoreDatabaseId}`);

  try {
    const gigsCol = collection(db, "gigs");
    const snapshot = await getDocs(gigsCol);
    
    console.log(`Found ${snapshot.size} total documents in the "gigs" collection.`);

    let scannedCount = 0;
    let corruptedCount = 0;
    let updatedCount = 0;

    for (const docSnap of snapshot.docs) {
      scannedCount++;
      const data = docSnap.data();
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      const dateVal = data.date;
      const startTimeVal = data.startTime;

      // Check and clean "Date: " prefix
      if (dateVal && typeof dateVal === "string" && dateVal.startsWith("Date: ")) {
        const cleanedDate = dateVal.replace("Date: ", "");
        updates.date = cleanedDate;
        needsUpdate = true;
        console.log(`Gig [${docSnap.id}] ("${data.title}") posted by ${data.posterEmail || "unknown"} has prefixed date: "${dateVal}" -> "${cleanedDate}"`);
      }

      // Check and clean "Starts: " prefix
      if (startTimeVal && typeof startTimeVal === "string" && startTimeVal.startsWith("Starts: ")) {
        const cleanedTime = startTimeVal.replace("Starts: ", "");
        updates.startTime = cleanedTime;
        needsUpdate = true;
        console.log(`Gig [${docSnap.id}] ("${data.title}") posted by ${data.posterEmail || "unknown"} has prefixed startTime: "${startTimeVal}" -> "${cleanedTime}"`);
      }

      if (needsUpdate) {
        corruptedCount++;
        try {
          const docRef = doc(db, "gigs", docSnap.id);
          await updateDoc(docRef, updates);
          updatedCount++;
        } catch (updateErr) {
          console.error(`Error updating document ${docSnap.id}:`, updateErr);
        }
      }
    }

    console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===");
    console.log(`Total Gigs Scanned: ${scannedCount}`);
    console.log(`Corrupted Gigs Found: ${corruptedCount}`);
    console.log(`Gigs Successfully Repaired: ${updatedCount}`);
    
    if (corruptedCount === 0) {
      console.log("🎉 Outstanding! 0 corrupted gigs remain in the database.");
    } else if (corruptedCount === updatedCount) {
      console.log("🎉 Success! All corrupted gigs were repaired.");
    } else {
      console.log("⚠️ Warning: Some updates failed. Please review error output above.");
    }

  } catch (error: any) {
    console.error("\n❌ Migration failed to execute:");
    console.error(error);
    process.exit(1);
  }
}

runMigration();
