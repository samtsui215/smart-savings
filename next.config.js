/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 *
 * Tuned to keep Firebase Authentication working:
 *  - connect-src allows the Identity Toolkit / Secure Token endpoints the
 *    Firebase client SDK calls during sign-in + token refresh.
 *  - frame-src allows the auth helper iframe Firebase hosts on your
 *    *.firebaseapp.com authDomain, plus Google's account chooser.
 *  - script/style 'unsafe-inline' is required because Next.js injects inline
 *    bootstrap scripts and we use inline styles (Tailwind/Recharts). This is
 *    the main place to tighten later with nonces.
 *  - 'unsafe-eval' is dev-only (React Fast Refresh / HMR needs it); the
 *    production policy omits it.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Force HTTPS for 2 years incl. subdomains. Ignored by browsers over plain
  // http (e.g. localhost), so safe to always send.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Anti-clickjacking (belt-and-suspenders with frame-ancestors).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry ids) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Turn off device APIs we never use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Limit cross-origin window handles (the Firebase popup still works as it
  // opens same-origin-ish via the SDK).
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js"
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
