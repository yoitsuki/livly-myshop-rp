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
  signOut,
  type User,
} from "firebase/auth";
import { ADMIN_UID, firebaseAuth } from "./client";

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  redirectError: string | null;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAdmin: false,
  redirectError: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    const auth = firebaseAuth();

    // Surface any pending redirect result so its error doesn't get lost.
    // We still rely on signInWithPopup as the primary flow; this handles
    // any leftover redirect from earlier code paths.
    getRedirectResult(auth).catch((e: unknown) => {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code?: unknown }).code)
          : null;
      const msg =
        e && typeof e === "object" && "message" in e &&
        typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : null;
      setRedirectError(code && msg ? `${msg} (${code})` : code ?? msg ?? null);
    });

    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: !!user && !!ADMIN_UID && user.uid === ADMIN_UID,
      redirectError,
    }),
    [user, loading, redirectError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export async function signInGoogle(): Promise<void> {
  // Popup-only. signInWithRedirect is unreliable on iOS Safari due to
  // Storage Partitioning blocking the third-party context shared with
  // *.firebaseapp.com — auth completes but the credential never propagates
  // back to the app. Popups inherit the user-gesture context and avoid this.
  const provider = new GoogleAuthProvider();
  const auth = firebaseAuth();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: unknown }).code)
        : "";
    // iOS Safari + cross-domain popup often delivers the credential to the
    // app's IndexedDB but fails to postMessage it back to the parent in
    // time, surfacing as auth/popup-closed-by-user despite a successful
    // sign-in. Watch onAuthStateChanged briefly and treat that as success.
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      const recovered = await waitForUser(2000);
      if (recovered) return;
    }
    throw e;
  }
}

function waitForUser(timeoutMs: number): Promise<User | null> {
  return new Promise((resolve) => {
    const auth = firebaseAuth();
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    let done = false;
    const finish = (user: User | null) => {
      if (done) return;
      done = true;
      unsub();
      clearTimeout(timer);
      resolve(user);
    };
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) finish(user);
    });
    const timer = setTimeout(() => finish(auth.currentUser), timeoutMs);
  });
}

export async function signOutCurrent(): Promise<void> {
  await signOut(firebaseAuth());
}
