import { spawnSync } from 'node:child_process';
// Firebase browser configuration is public. Never add Admin, supplier or payment credentials here.
const publicFirebaseConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyA2V-oXF0NZhveO0JkyVN0uF3PtoL7eQaw',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'alozuri.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'alozuri',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'alozuri.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '259378235356',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:259378235356:web:c0ed788084546d350ff119',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-ZVWR8NWVWF',
};
// Hosting release currently publishes only the sample storefront. Never enable charges here.
const result = spawnSync('npm', ['run', 'build:web'], {
  stdio: 'inherit',
  env: {
    ...publicFirebaseConfig,
    ...process.env,
    VOYASPAN_STATIC_EXPORT: 'true',
    NEXT_PUBLIC_DEMO_MODE: 'true',
    NEXT_PUBLIC_API_URL: '',
    NEXT_PUBLIC_SITE_URL: 'https://alozuri.web.app',
  },
});
process.exit(result.status ?? 1);
