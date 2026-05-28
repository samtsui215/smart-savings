/**
 * Edge middleware: CSRF defense + auth gate.
 *
 * 1. CSRF — state-changing API requests (POST/PUT/PATCH/DELETE) must come
 *    from our own origin. Browsers always send an Origin header on such
 *    cross-site requests, so we reject any whose Origin host doesn't match
 *    the request host (or an explicit ALLOWED_ORIGINS allowlist). This sits
 *    on top of the SameSite=Lax session cookie as defense in depth.
 *
 * 2. Auth gate — Firebase session cookies can only be *verified* with the
 *    Admin SDK, which is Node-only and can't run at the edge. Middleware
 *    therefore does a cheap presence check; the real cryptographic
 *    verification happens in route handlers / server components via
 *    requireSession(). A forged or expired cookie passes this gate but is
 *    rejected the moment a route actually reads it.
 */
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "sa_session";

const PUBLIC_PAGES = new Set(["/", "/login", "/register"]);
const PUBLIC_API_PREFIX = "/api/auth/";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // No Origin header: not a cross-site browser request. Same-origin GETs
    // and non-browser clients land here. We only reach this function for
    // mutating requests, where modern browsers DO send Origin — so a missing
    // Origin on a mutation is unusual; allow it (curl/tests) but it can't be
    // forged by a malicious site (which would carry the attacker's Origin).
    return true;
  }
  try {
    const o = new URL(origin);
    const host = req.headers.get("host");
    if (host && o.host === host) return true;
    return allowedOrigins().includes(o.origin);
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // 1. CSRF: block cross-origin state-changing API calls.
  if (isApi && MUTATING.has(req.method) && !isSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // 2. Public routes need no session.
  if (PUBLIC_PAGES.has(pathname) || pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next();
  }

  // 3. Auth gate (cookie presence; real verification happens in-route).
  const hasCookie = Boolean(req.cookies.get(COOKIE_NAME)?.value);
  if (!hasCookie) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
