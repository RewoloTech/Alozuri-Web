import { spawnSync } from 'node:child_process';
// Hosting release currently publishes only the sample storefront. Never enable charges here.
const result = spawnSync('npm', ['run', 'build:web'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VOYASPAN_STATIC_EXPORT: 'true',
    NEXT_PUBLIC_DEMO_MODE: 'true',
    NEXT_PUBLIC_API_URL: '',
    NEXT_PUBLIC_SITE_URL: 'https://voyaspan-cf6b7.web.app',
  },
});
process.exit(result.status ?? 1);
