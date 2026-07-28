import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Helper function to upload file to Firebase Storage
export async function uploadFileToFirebase(dataUrl: string, type: string, identifier: string): Promise<string> {
  const timestamp = Date.now();
  const sanitizedId = String(identifier || "unknown").replace(/[^a-zA-Z0-9_\-]/g, "_");
  
  // Extension mapping
  let ext = "png";
  if (dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")) ext = "jpg";
  else if (dataUrl.includes("image/png")) ext = "png";
  else if (dataUrl.includes("application/pdf")) ext = "pdf";
  else if (dataUrl.includes("image/gif")) ext = "gif";
  else if (dataUrl.includes("image/webp")) ext = "webp";

  const storagePath = `uploads/${type}s/${sanitizedId}_${timestamp}.${ext}`;
  const fileRef = ref(storage, storagePath);
  
  // uploadString takes (storageRef, value, format)
  await uploadString(fileRef, dataUrl, 'data_url');
  const downloadUrl = await getDownloadURL(fileRef);
  return downloadUrl;
}

// Wrapper with robust fallback to backend file system or raw data URL
export async function uploadFileWithFallback(
  dataUrl: string, 
  type: 'avatar' | 'aadhar' | 'gig', 
  identifier: string
): Promise<string> {
  // Try Firebase Storage first
  try {
    console.log(`Attempting Firebase Storage upload for ${type}...`);
    const downloadUrl = await uploadFileToFirebase(dataUrl, type, identifier);
    console.log(`Successfully uploaded to Firebase Storage:`, downloadUrl);
    return downloadUrl;
  } catch (error) {
    console.warn(`Firebase Storage upload failed, falling back to local server filesystem.`, error);
    // Fallback to local server /api/upload
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          type,
          userId: type === "avatar" || type === "aadhar" ? identifier : undefined,
          gigId: type === "gig" ? identifier : undefined
        })
      });
      const data = await res.json();
      if (data.url) {
        return data.url;
      }
      throw new Error(data.error || "Invalid response from server upload");
    } catch (fallbackError) {
      console.error("Local server upload fallback failed:", fallbackError);
      // Return the base64 URL so that the app still works in memory
      return dataUrl;
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { collection, onSnapshot, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, query, where };

