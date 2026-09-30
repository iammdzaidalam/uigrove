import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// Dev needs eval for hot reload and the analytics debug script
const scriptSrc = isProd
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

// The shadcn CLI and registry browsers fetch these from anywhere
const registryHeaders = [
  { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  productionBrowserSourceMaps: false,
  compiler: { removeConsole: isProd },
  images: { qualities: [70, 75] },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/r/:path*', headers: registryHeaders },
    ]
  },
}

export default nextConfig
