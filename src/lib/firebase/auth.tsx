"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { ADMIN_UID, firebaseAuth } from "./client";

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Surface any error from a prior signInWithRedirect round-trip.
    getRedirectResult(firebaseAuth).catch(() => {
      // onAuthStateChanged will still fire; swallow to avoid an unhandled rejection.
    });

    return onAuthStateChanged(firebaseAuth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: !!user && !!ADMIN_UID && user.uid === ADMIN_UID,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * Touch devices fall back to redirect because mobile Safari frequently blocks
 * the popup window opened by signInWithPopup.
 */
function prefersRedirect(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export async function signInGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  if (prefersRedirect()) {
    await signInWithRedirect(firebaseAuth, provider);
    return;
  }
  await signInWithPopup(firebaseAuth, provider);
}

export async function signOutCurrent(): Promise<void> {
  await signOut(firebaseAuth);
}
