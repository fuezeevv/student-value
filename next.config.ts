import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env.SV_DEPLOYMENT_TARGET === "container"
    ? { output: "standalone" as const }
    : {}),
  outputFileTracingExcludes: {
    "/*": [
      "./.env*",
      "./secrets/**",
      "./.test-work/**",
      "./tests/**",
      "./prisma/test-fixtures.ts",
      "./node_modules/puppeteer*/**",
      "./node_modules/@puppeteer/**",
      "./node_modules/vitest/**",
      "./node_modules/@vitest/**",
      "./node_modules/eslint*/**",
      "./node_modules/@eslint*/**",
    ],
  },
  // Public build target, never a secret. Baked into the server artifact so runtime
  // configuration cannot accidentally disable Vercel's production guards.
  env: { SV_DEPLOYMENT_TARGET: process.env.SV_DEPLOYMENT_TARGET ?? "node" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
