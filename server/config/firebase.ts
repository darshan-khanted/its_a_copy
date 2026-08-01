import { initializeApp as initializeFirebaseApp } from "firebase/app";
import { getStorage as getFirebaseStorage } from "firebase/storage";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import {
  getFirestore as getAdminFirestore,
  FieldValue as AdminFieldValue,
} from "firebase-admin/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export { firebaseConfig };
export const FieldValue = AdminFieldValue;

/**
 * Client Firebase app. Used by the admin-firestore compatibility shim below and by
 * the storage/upload routes. Firebase modules are imported modularly (never the
 * umbrella `firebase` package) per design §I.6.
 */
const firebaseApp = initializeFirebaseApp(firebaseConfig);

export const storage = getFirebaseStorage(firebaseApp);
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

let _adminAuth: ReturnType<typeof getAdminAuth> | null = null;

/**
 * Local development connects to the Firebase Auth emulator ONLY when the explicit
 * `FIREBASE_AUTH_EMULATOR_HOST` environment variable is set (requirement 23.9).
 * No authentication decision is ever conditioned on the request hostname
 * (requirement 23.8, NFR-3.4). The Admin SDK auto-detects this variable, so there
 * is nothing hostname-derived to configure here.
 */
export function isAuthEmulatorEnabled(): boolean {
  return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

export function getFirebaseAdminAuth() {
  if (!_adminAuth) {
    if (getApps().length === 0) {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
    _adminAuth = getAdminAuth();
  }
  return _adminAuth;
}

/**
 * Compatibility shim that exposes an Admin-Firestore-shaped API backed by the
 * modular client Firestore SDK. Preserved verbatim from the original monolith so
 * the extracted routes keep identical behaviour.
 */
export function getFirebaseAdminDb(): any {
  const wrapDoc = (docRef: any) => ({
    id: docRef.id,
    _realDocRef: docRef,
    set: async (data: any, options?: any) => {
      if (options?.merge) {
        return await setDoc(docRef, data, { merge: true });
      }
      return await setDoc(docRef, data);
    },
    get: async () => {
      const snap = await getDoc(docRef);
      return {
        id: snap.id,
        exists: snap.exists(),
        data: () => snap.data(),
        ref: docRef,
      };
    },
    update: async (data: any) => {
      return await updateDoc(docRef, data);
    },
    collection: (subCollectionName: string) => {
      const queryRef: any = collection(docRef, subCollectionName);
      const filters: any[] = [];

      const chainable = {
        where: (field: string, op: any, value: any) => {
          filters.push(where(field, op, value));
          return chainable;
        },
        doc: (docId?: string) => {
          const subDocRef = docId
            ? doc(docRef, subCollectionName, docId)
            : doc(collection(docRef, subCollectionName));
          return wrapDoc(subDocRef);
        },
        get: async () => {
          let finalQuery = queryRef;
          if (filters.length > 0) {
            finalQuery = query(queryRef, ...filters);
          }
          const snap = await getDocs(finalQuery);
          return {
            size: snap.size,
            docs: snap.docs.map((docSnap) => ({
              id: docSnap.id,
              exists: docSnap.exists(),
              data: () => docSnap.data(),
              ref: docSnap.ref,
            })),
          };
        },
      };

      return chainable;
    },
  });

  return {
    runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
      return await runTransaction(db, async (tx: any) => {
        const wrappedTx = {
          get: async (docWrapper: any) => {
            const realDocRef = docWrapper._realDocRef || docWrapper.ref || docWrapper;
            const snap = await tx.get(realDocRef);
            return {
              exists: snap.exists(),
              data: () => snap.data(),
            };
          },
          set: (docWrapper: any, data: any, options?: any) => {
            const realDocRef = docWrapper._realDocRef || docWrapper.ref || docWrapper;
            if (options?.merge) tx.set(realDocRef, data, { merge: true });
            else tx.set(realDocRef, data);
          },
          update: (docWrapper: any, data: any) => {
            const realDocRef = docWrapper._realDocRef || docWrapper.ref || docWrapper;
            tx.update(realDocRef, data);
          },
        };
        return await updateFunction(wrappedTx);
      });
    },
    collection: (collectionName: string) => {
      const queryRef: any = collection(db, collectionName);
      const filters: any[] = [];

      const chainable = {
        where: (field: string, op: any, value: any) => {
          filters.push(where(field, op, value));
          return chainable;
        },
        doc: (docId?: string) => {
          const docRef = docId
            ? doc(db, collectionName, docId)
            : doc(collection(db, collectionName));
          return wrapDoc(docRef);
        },
        get: async () => {
          let finalQuery = queryRef;
          if (filters.length > 0) {
            finalQuery = query(queryRef, ...filters);
          }
          const snap = await getDocs(finalQuery);
          return {
            size: snap.size,
            docs: snap.docs.map((docSnap) => ({
              id: docSnap.id,
              exists: docSnap.exists(),
              data: () => docSnap.data(),
              ref: docSnap.ref,
            })),
          };
        },
      };

      return chainable;
    },
    batch: () => {
      const b = writeBatch(db);
      return {
        update: (docWrapper: any, data: any) => {
          b.update(docWrapper._realDocRef || docWrapper.ref || docWrapper, data);
        },
        commit: async () => {
          await b.commit();
        },
      };
    },
  };
}
