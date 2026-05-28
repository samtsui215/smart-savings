import { getSession } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return ok({ user: null });
  return ok({ user: { firebaseUid: session.firebaseUid, email: session.email } });
}
