import type { NextConfig } from 'next';
import path from 'node:path';
const staticExport = process.env.VOYASPAN_STATIC_EXPORT === 'true';
const config: NextConfig = {
  ...(staticExport ? { output: 'export' as const } : {}),
  transpilePackages: ['@voyaspan/shared'],
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  poweredByHeader: false,
  ...(staticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-Frame-Options', value: 'DENY' },
                {
                  key: 'Content-Security-Policy',
                  value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
                },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ...(process.env.NODE_ENV === 'production'
                  ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
                  : []),
              ],
            },
            ...['mode', 'countries', 'allowance', 'coverage', 'sort', 'cursor'].map((key) => ({
              source: '/:path*',
              has: [{ type: 'query' as const, key }],
              headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
            })),
            ...[
              '/checkout/:path*',
              '/account/:path*',
              '/dashboard/:path*',
              '/admin/:path*',
              '/login',
              '/register',
              '/forgot-password',
              '/verify-email',
              '/cart',
            ].map((source) => ({
              source,
              headers: [
                { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
                { key: 'Referrer-Policy', value: 'no-referrer' },
                { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
              ],
            })),
          ];
        },
      }),
};
export default config;
