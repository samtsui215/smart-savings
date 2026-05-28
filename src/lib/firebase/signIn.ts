"use client";

/**
 * Client-side sign-in helpers shared by the login + register pages.
 *
 * Each flow ends the same way: get the Firebase ID token, hand it to our
 * /api/auth/session endpoint (which mints the httpOnly session cookie and
 * upserts our User row), then the caller redirects.
 *
 * Errors are normalised to friendly messages — Firebase's raw codes
 * ("auth/invalid-credential" etc.) aren't user-facing copy.
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "./client";
import { api } from "@/lib/api";

async function establishSession(cred: UserCredential): Promise<void> {
  const idToken = await cred.user.getIdToken();
  await api("/api/auth/session", { method: "POST", json: { idToken } });
}

export async function emailLogin(email: string, password: string): Promise<void> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  await establishSession(cred);
}

export async function emailRegister(email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await establishSession(cred);
}

export async function googleSignIn(): Promise<void> {
  const cred = await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
  await establishSession(cred);
}

export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "That email already has an account — try signing in.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google popup — allow popups and retry.";
    case "auth/configuration-not-found":
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled in Firebase yet.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase isn't configured yet — fill in the NEXT_PUBLIC_FIREBASE_* env vars.";
    default:
      return (e as Error)?.message ?? "Something went wrong. Please try again.";
  }
}
