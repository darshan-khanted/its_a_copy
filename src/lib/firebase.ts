// Relocated from repo-root firebase.ts (design §G.2). Modular Firebase imports retained.
// Emulator-aware; adds Firebase Auth GoogleAuthProvider (replaces @react-oauth/google).
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type UserCredential,
} from 'firebase/auth';
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
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  firebaseConfig.firestoreDatabaseId,
);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Local development uses ONLY the explicit auth-emulator environment flag (design NFR-3.4/3.5,
// task 1.3 owns removal of hostname-conditioned auth on the server; the client mirrors the flag).
if (import.meta.env.VITE_USE_AUTH_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  } catch {
    // already connected
  }
}

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export function registerWithEmail(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

// --- Storage upload with robust fallback (kept from the original) ---
export async function uploadFileToFirebase(
  dataUrl: string,
  type: string,
  identifier: string,
): Promise<string> {
  const timestamp = Date.now();
  const sanitizedId = String(identifier || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_');

  let ext = 'png';
  if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) ext = 'jpg';
  else if (dataUrl.includes('image/png')) ext = 'png';
  else if (dataUrl.includes('application/pdf')) ext = 'pdf';
  else if (dataUrl.includes('image/gif')) ext = 'gif';
  else if (dataUrl.includes('image/webp')) ext = 'webp';

  const storagePath = `uploads/${type}s/${sanitizedId}_${timestamp}.${ext}`;
  const fileRef = ref(storage, storagePath);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

export async function uploadFileWithFallback(
  dataUrl: string,
  type: 'avatar' | 'aadhar' | 'gig',
  identifier: string,
): Promise<string> {
  try {
    return await uploadFileToFirebase(dataUrl, type, identifier);
  } catch (error) {
    console.warn('Firebase Storage upload failed, falling back to server filesystem.', error);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl,
          type,
          userId: type === 'avatar' || type === 'aadhar' ? identifier : undefined,
          gigId: type === 'gig' ? identifier : undefined,
        }),
      });
      const data = await res.json();
      if (data.url) return data.url;
      throw new Error(data.error || 'Invalid response from server upload');
    } catch (fallbackError) {
      console.error('Local server upload fallback failed:', fallbackError);
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
    providerInfo?: { providerId?: string | null; email?: string | null }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { collection, onSnapshot, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, query, where };
