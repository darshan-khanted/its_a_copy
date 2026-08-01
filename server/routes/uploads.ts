import express from "express";
import path from "path";
import fs from "fs";
import {
  ref as storageRef,
  uploadBytes as storageUploadBytes,
  getDownloadURL as storageGetDownloadURL,
} from "firebase/storage";
import { storage } from "../config/firebase";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = express.Router();

/**
 * Authenticated upload of images and identity documents (mutating route → requires a
 * verified Firebase ID token per NFR-3.5).
 */
router.post("/upload", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { dataUrl, type, userId, gigId } = req.body;

    if (!dataUrl) {
      return res.status(400).json({ error: "No file data provided." });
    }

    if (!type || !["avatar", "aadhar", "gig"].includes(type)) {
      return res.status(400).json({ error: "Invalid or missing file upload type." });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid Data URL format." });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    let ext = "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
    else if (mimeType.includes("png")) ext = "png";
    else if (mimeType.includes("pdf")) ext = "pdf";
    else if (mimeType.includes("gif")) ext = "gif";
    else if (mimeType.includes("webp")) ext = "webp";

    const timestamp = Date.now();
    const sanitizedId = String(userId || gigId || "unknown").replace(/[^a-zA-Z0-9_\-]/g, "_");
    const filename = `${sanitizedId}_${timestamp}.${ext}`;

    const storagePath = `uploads/${type}s/${filename}`;
    const fileRef = storageRef(storage, storagePath);

    console.log(`Server-side uploading file to Firebase Storage path: ${storagePath}...`);
    await storageUploadBytes(fileRef, buffer, { contentType: mimeType });
    const downloadUrl = await storageGetDownloadURL(fileRef);

    console.log(`Successfully uploaded to Firebase Storage server-side: ${downloadUrl}`);

    try {
      const uploadRoot = path.join(process.cwd(), "uploads");
      const targetSubDir = path.join(uploadRoot, `${type}s`);

      if (!fs.existsSync(uploadRoot)) {
        fs.mkdirSync(uploadRoot, { recursive: true });
      }
      if (!fs.existsSync(targetSubDir)) {
        fs.mkdirSync(targetSubDir, { recursive: true });
      }
      const filePath = path.join(targetSubDir, filename);
      fs.writeFileSync(filePath, buffer);
      console.log(`Saved backup copy on backend filesystem: ${filePath} (${buffer.length} bytes)`);
    } catch (localWriteErr) {
      console.warn("Could not write local backup copy to ephemeral disk (non-blocking):", localWriteErr);
    }

    return res.json({ url: downloadUrl, success: true });
  } catch (err: any) {
    console.error("Backend file save / Firebase Storage upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to save file on backend." });
  }
});

export default router;
