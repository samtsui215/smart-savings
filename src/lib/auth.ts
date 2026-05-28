import "server-only";

/**
 * Session auth backed by Firebase.
 *
 * Flow:
 *   1. Client signs in with the Firebase JS SDK and obtains an ID token.
 *   2. Client POSTs that token to /api/auth/session.
 *   3. We verify it with the Admin SDK and exchange it for a Firebase
 *      *session cookie* (httpOnly), which we store. Session cookies are the
 *      recommended pattern for SSR — they're revocable and outlive the
 *      short-lived ID token.
 *   4. Every request re-verifies the session cookie via the Admin SDK.
 *
 * Note: verification needs the Admin SDK (Node only), so middleware can't do
 * it — middleware only checks cookie presence and real verification happens
 * here, in route handlers and server components.
 */
import { cookies } from "next/headers";
import { adminAuth } from "./firebase/admin";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "sa_session";
const SESSION_TTL_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

export interface FirebaseSession {
  firebaseUid: string;
  email: string | null;
}

/** Verify the session cookie. Returns the Firebase identity, or null. */
export async function getSession(): Promise<FirebaseSession | null> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    // checkRevoked=true so a signed-out / disabled user is rejected promptly.
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return { firebaseUid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export interface AppSession {
  userId: string;        // our internal Category/Transaction owner id
  firebaseUid: string;
  email: string | null;
}

/**
 * Like getSession, but also resolves our internal User row and returns its
 * id. Throws a 401-shaped error if unauthenticated or the user row is missing
 * (the row is created by /api/auth/session on first login, so any
 * authenticated request after that resolves fine).
 */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) throw unauthorized();

  const user = await prisma.user.findUnique({
    where: { firebaseUid: session.firebaseUid },
    select: { id: true, email: true },
  });
  if (!user) throw unauthorized();

  return { userId: user.id, firebaseUid: session.firebaseUid, email: user.email };
}

function unauthorized(): Error & { status: number } {
  return Object.assign(new Error("Unauthorized"), { status: 401 });
}

/**
 * Exchange a freshly-minted Firebase ID token for a session cookie and store
 * it. Called by /api/auth/session after verifying the token.
 */
export async function createSessionCookie(idToken: string): Promise<void> {
  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_TTL_MS,
  });
  cookies().set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}
