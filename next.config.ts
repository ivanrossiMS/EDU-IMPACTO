import type { NextConfig } from 'next';

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Force HTTPS for 1 year (production only)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Disable browser DNS prefetch
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions policy — restrict dangerous APIs
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content-Security-Policy — restrict to known sources
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-* needed for Next.js dev; tighten in prod
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://viacep.com.br",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // ── Performance ─────────────────────────────────────────────────
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },

  // ── Images ──────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],
  },

  // ── Compiler ────────────────────────────────────────────────────
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // ── Security Headers ────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // Cache static assets aggressively
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // ── Redirects ───────────────────────────────────────────────────
  async redirects() {
    return [
      // Redirect root to dashboard cleanly
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
