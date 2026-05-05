import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazily initialize so module evaluation during SSR/SSG (e.g. /_not-found
// prerender) doesn't trigger getAuth and crash with auth/invalid-api-key
// when env values are missing in that build context. Real init happens on
// the client where the NEXT_PUBLIC_* vars are inlined.

let _app: FirebaseApp | undefined;
function ensureApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(config);
  return _app;
}

let _auth: Auth | undefined;
export function firebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(ensureApp());
  return _auth;
}

let _firestore: Firestore | undefined;
export function firestore(): Firestore {
  if (!_firestore) _firestore = getFirestore(ensureApp());
  return _firestore;
}

let _storage: FirebaseStorage | undefined;
export function storage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(ensureApp());
  return _storage;
}

export const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID ?? "";
