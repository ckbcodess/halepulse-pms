import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking — this app should never be embedded in an iframe
          { key: 'X-Frame-Options',        value: 'DENY' },

          // Stop browsers from MIME-sniffing away from the declared content-type
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          // Limit referrer data sent to third-party sites
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },

          // Disable access to camera, microphone, geolocation — not needed for a PMS
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },

          // Enforce HTTPS for 1 year once visited (Vercel always serves HTTPS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },

          // Content Security Policy
          // 'unsafe-inline' is required by Next.js for inline styles/scripts
          // 'unsafe-eval' is required by Next.js App Router in dev; removed in prod via env check
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mcp.figma.com",   // Next.js requires these; mcp.figma.com for Figma capture (temp)
              "style-src 'self' 'unsafe-inline'",                    // Tailwind inline styles
              "img-src 'self' data: blob: https:",                   // allow tenant logos via https
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https:",                           // API + Vercel analytics
              "frame-ancestors 'none'",                              // same as X-Frame-Options DENY
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

// Offline support (Phase 1): compile the service worker from src/app/sw.ts.
// Disabled in dev because service workers + Turbopack dev don't mix cleanly —
// verify offline against a production build (next build && next start).
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);
