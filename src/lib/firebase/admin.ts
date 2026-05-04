import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Server-only Firebase Admin SDK initialization. Used by API routes to
 * verify the ID token a signed-in client attaches to its requests.
 *
 * The service account JSON should be set as the FIREBASE_SERVICE_ACCOUNT
 * env var (a single line of JSON; Vercel's UI accepts that).
 */

let _app: App | undefined;

function ensureAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0]!;
    return _app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not set — admin API routes can't verify tokens",
    );
  }
  let parsed: { project_id?: string; client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is missing project_id / client_email / private_key",
    );
  }
  _app = initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // Some env stores escape newlines as \\n — restore them.
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    }),
  });
  return _app;
}

export function adminAuth(): Auth {
  return getAuth(ensureAdminApp());
}

const ADMIN_UID = process.env.ADMIN_UID ?? process.env.NEXT_PUBLIC_ADMIN_UID ?? "";

/**
 * Verifies the bearer token from `Authorization: Bearer <id_token>` and
 * confirms the caller is the configured admin. Throws on any mismatch.
 */
export async function requireAdmin(req: Request): Promise<{ uid: string }> {
  if (!ADMIN_UID) {
    throw new Error("ADMIN_UID is not configured on the server");
  }
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    const e = new Error("missing bearer token");
    (e as Error & { status?: number }).status = 401;
    throw e;
  }
  const idToken = m[1].trim();
  const decoded = await adminAuth().verifyIdToken(idToken);
  if (decoded.uid !== ADMIN_UID) {
    const e = new Error("forbidden");
    (e as Error & { status?: number }).status = 403;
    throw e;
  }
  return { uid: decoded.uid };
}
