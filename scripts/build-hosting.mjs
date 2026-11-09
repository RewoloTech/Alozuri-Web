import { spawnSync } from 'node:child_process';
// Firebase browser configuration is public. Never add Admin, supplier or payment credentials here.
const publicFirebaseConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyBuTJAM6BSziqZG_jJbo_rmT8Argbz6Z9E',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'voyaspan.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'voyaspan',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'voyaspan.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '311577510613',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:311577510613:web:b4174b7fac62edfd23185c',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-XZR0S4SYP4',
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
    NEXT_PUBLIC_SITE_URL: 'https://voyaspan-cf6b7.web.app',
  },
});
process.exit(result.status ?? 1);
