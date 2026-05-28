import "server-only";

/**
 * Firebase Admin SDK — server only, Node runtime (never edge/middleware).
 *
 * Initialization is lazy and guarded: importing this module never throws, so
 * the dev server boots even before the service-account env vars are filled
 * in. The error only surfaces when an auth route actually tries to use it.
 *
 * FIREBASE_PRIVATE_KEY is stored in .env with literal "\n" escapes (the key
 * is multi-line); we unescape them at runtime.
 */
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let cachedAuth: Auth | null = null;

export function adminAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw Object.assign(
      new Error(
        "Firebase Admin not configured — set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env",
      ),
      { status: 500 },
    );
  }

  const app: App = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  cachedAuth = getAuth(app);
  return cachedAuth;
}
