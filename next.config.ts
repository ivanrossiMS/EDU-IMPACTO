import type { NextConfig } from 'next'; 

const securityHeaders = [
  // Allow framing for same-origin and Capacitor Native WebViews
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
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Content-Security-Policy — allow Capacitor native schemes and inline scripts
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self' capacitor: http://localhost:* https://localhost:*",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' capacitor: http://localhost:* https://localhost:* https://cdn.onesignal.com https://api.onesignal.com https://onesignal.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://onesignal.com https://cdn.onesignal.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: capacitor:",
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in capacitor:",
      "connect-src 'self' capacitor: http://localhost:* https://localhost:* https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://viacep.com.br https://*.onesignal.com https://script.google.com https://*.googleusercontent.com https://www.googleapis.com https://*.google.com",
      "worker-src 'self' blob: capacitor: https://cdn.onesignal.com https://onesignal.com",
      "frame-src 'self' capacitor: https://onesignal.com",
      "frame-ancestors 'self' capacitor: http://localhost:* https://localhost:*",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // ── Performance ─────────────────────────────────────────────────
  experimental: {
    // Otimiza imports para melhor tree-shaking e bundle menor
    optimizePackageImports: [
      'lucide-react',
      '@supabase/supabase-js',
      'framer-motion',
      'recharts',
      'date-fns',
    ],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // ── Images ──────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: '*.picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.unsplash.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
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
    const headersConfig = [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
    
    // Cache static assets aggressively ONLY in production.
    // In development, this breaks Next.js Fast Refresh and causes massive lag.
    if (process.env.NODE_ENV === 'production') {
      headersConfig.push({
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      });
    }

    return headersConfig;
  },

  // ── Rewrites para Catracas iDFace (Modo iDCloud Personalizado) ───
  async rewrites() {
    return [
      { source: '/push.fcgi', destination: '/api/portaria/webhook' },
      { source: '/idcloud.fcgi', destination: '/api/portaria/webhook' },
      { source: '/push', destination: '/api/portaria/webhook' },
      { source: '/idcloud', destination: '/api/portaria/webhook' },
      { source: '/get_actions.fcgi', destination: '/api/portaria/webhook' },
      { source: '/set_result.fcgi', destination: '/api/portaria/webhook' },
    ];
  },
};

export default nextConfig;
