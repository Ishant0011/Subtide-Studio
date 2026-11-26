import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

function buildContentSecurityPolicy(isDevelopmentServer: boolean): string {
  const supabaseOrigin = (() => {
    try {
      const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return raw ? new URL(raw).origin : null;
    } catch {
      return null;
    }
  })();

  const supabaseWsOrigin = supabaseOrigin
    ? supabaseOrigin.replace(/^http/, "ws")
    : null;

  const connectSources = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
    ...(supabaseWsOrigin ? [supabaseWsOrigin] : []),
  ];

  const mediaSources = [
    "'self'",
    "blob:",
    "https://*.supabase.co",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
  ];

  const imgSources = [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
  ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    // Next's development runtime evaluates modules for its source maps.
    isDevelopmentServer
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSources.join(" ")}`,
    "font-src 'self' data:",
    `media-src ${mediaSources.join(" ")}`,
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
  ].join("; ");
}

function buildSecurityHeaders(isDevelopmentServer: boolean) {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(isDevelopmentServer) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(process.env.NODE_ENV === "production"
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]
      : []),
  ];
}

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, private",
  },
  { key: "Pragma", value: "no-cache" },
];

const nextConfig = (phase: string): NextConfig => ({
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(phase === PHASE_DEVELOPMENT_SERVER),
      },
      {
        source: "/api/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/admin/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/projects/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/upload/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
});

export default nextConfig;
