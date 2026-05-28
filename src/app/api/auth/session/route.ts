import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebase/admin";
import { createSessionCookie } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { z } from "zod";

const Body = z.object({ idToken: z.string().min(1).max(4096) });

/**
 * POST /api/auth/session  { idToken }
 *
 * Called right after the client signs in with Firebase. We:
 *   1. Verify the ID token with the Admin SDK.
 *   2. Resolve/create our internal User row:
 *        - first try by firebaseUid (returning user)
 *        - then by email (legacy account → attach the uid, preserving data)
 *        - otherwise create a fresh user + mandatory Unassigned bucket
 *   3. Exchange the ID token for an httpOnly session cookie.
 */
export async function POST(req: Request) {
  try {
    // Best-effort throttle: 30 session exchanges per minute per IP.
    if (!rateLimit(`session:${clientIp(req)}`, 30, 60_000)) {
      return apiError(Object.assign(new Error("Too many requests — slow down"), { status: 429 }));
    }

    const { idToken } = Body.parse(await req.json());

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email ?? null;

    let user = await prisma.user.findUnique({ where: { firebaseUid: uid } });

    // Legacy match: an account created under the old password auth has the
    // same email but no firebaseUid yet. Claim it so its data carries over.
    if (!user && email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { firebaseUid: uid },
        });
      }
    }

    // Brand-new user → create with the mandatory Unassigned bucket.
    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            firebaseUid: uid,
            // email is unique + required; fall back to a uid-derived value
            // for providers that don't supply one.
            email: email ?? `${uid}@firebase.local`,
            totalBalance: 0,
          },
        });
        await tx.category.create({
          data: { userId: u.id, name: "Unassigned", isUnassigned: true },
        });
        return u;
      });
    }

    await createSessionCookie(idToken);

    return ok({ id: user.id, email: user.email }, 201);
  } catch (e) {
    // Token verification failures should read as 401, not 500.
    if (e && typeof e === "object" && "code" in e && String((e as { code: string }).code).startsWith("auth/")) {
      return apiError(Object.assign(new Error("Invalid or expired sign-in token"), { status: 401 }));
    }
    return apiError(e);
  }
}
