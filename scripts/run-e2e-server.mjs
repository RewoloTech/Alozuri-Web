// Isolate Next's generated files and dev lock from the developer's running server.
import { mkdtempSync, cpSync, mkdirSync, symlinkSync, rmSync, existsSync } from 'node:fs';
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
]) {
  mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
  cpSync(path.join(source, file), path.join(target, file), { recursive: true });
}
if (existsSync(path.join(source, 'apps/api/package.json'))) {
  mkdirSync(path.join(target, 'apps/api'), { recursive: true });
  cpSync(path.join(source, 'apps/api/package.json'), path.join(target, 'apps/api/package.json'));
}
symlinkSync(path.join(source, 'node_modules'), path.join(target, 'node_modules'), 'dir');
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
