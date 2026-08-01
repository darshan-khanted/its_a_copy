// Session-shaped truth: auth user + user doc (rep, rank, verified) + derived unlocks.
// Subscribes ONLY to the current user's own document (self/participant-scoped, design §G.3).
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User, Unlocks } from '@/types';
import { unlocksForRank } from '@/features/rep/lib/unlocks';

interface SessionValue {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  unlocks: Unlocks;
  loading: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    // Self-scoped: one document, never the whole users collection (req 30.7).
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        setUser(snap.exists() ? ({ ...(snap.data() as User), uid: firebaseUser.uid }) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [firebaseUser]);

  const value = useMemo<SessionValue>(
    () => ({
      firebaseUser,
      user,
      unlocks: unlocksForRank(user?.rank ?? 'TAPPED_IN'),
      loading,
    }),
    [firebaseUser, user, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
