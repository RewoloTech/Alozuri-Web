// Isolate Next's generated files and dev lock from the developer's running server.
import {
  mkdtempSync,
  cpSync,
  mkdirSync,
  symlinkSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const source = process.cwd(),
  target = mkdtempSync(path.join(tmpdir(), 'alozuri-e2e-'));
for (const file of [
  'package.json',
  'package-lock.json',
  'tsconfig.base.json',
  'apps/web/package.json',
  'apps/web/tsconfig.json',
  'apps/web/next.config.ts',
  'apps/web/postcss.config.mjs',
  'packages/shared/package.json',
  'packages/shared/src',
  'apps/web/src',
  'apps/web/public',
]) {
  mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
  cpSync(path.join(source, file), path.join(target, file), { recursive: true });
}
if (existsSync(path.join(source, 'apps/api/package.json'))) {
  mkdirSync(path.join(target, 'apps/api'), { recursive: true });
  cpSync(path.join(source, 'apps/api/package.json'), path.join(target, 'apps/api/package.json'));
}
symlinkSync(path.join(source, 'node_modules'), path.join(target, 'node_modules'), 'dir');
// Component fixtures exist only in this temporary test app, never the deployed source.
for (const name of ['account-menu', 'checkout-account']) {
  const fixture = path.join(target, `apps/web/src/app/e2e-fixtures/${name}/page.tsx`);
  mkdirSync(path.dirname(fixture), { recursive: true });
  cpSync(path.join(source, `tests/fixtures/${name}.tsx`), fixture);
}
// Real Firebase Auth is connected only inside this disposable test app.
// Production source and the developer's running app are never pointed at emulators.
if (process.env.E2E_CART_AUTH_EMULATOR === 'true') {
  const file = path.join(target, 'apps/web/src/lib/firebase.ts');
  let content = readFileSync(file, 'utf8').replace(
    'import { getAuth }',
    'import { getAuth, connectAuthEmulator }',
  );
  content = content.replace(
    'export function authClient() {',
    'let connected = false;\nexport function authClient() {',
  );
  content = content.replace(
    '  return getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));',
    `  const auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
  if (!connected) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connected = true; }
  return auth;`,
  );
  writeFileSync(file, content);
  Object.assign(process.env, {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-emulator-key',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-alozuri',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-alozuri.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456:web:cart-fixture',
  });
}
const child = spawn(
  process.execPath,
  [path.join(source, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--port', '3100'],
  { cwd: path.join(target, 'apps/web'), env: process.env, stdio: 'inherit' },
);
const cleanup = () => {
  try {
    rmSync(target, { recursive: true, force: true });
  } catch {}
};
child.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
