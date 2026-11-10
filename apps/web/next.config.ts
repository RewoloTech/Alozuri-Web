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
              ],
            },
          ];
        },
      }),
};
export default config;
