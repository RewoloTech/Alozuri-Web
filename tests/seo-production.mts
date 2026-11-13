// Disposable production build: synthetic catalogue only; no production credentials or writes needed.
import { mkdtemp, cp, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createSeoApi } from './fixtures/seo-api.ts';
const source = process.cwd(),
  target = await mkdtemp(path.join(tmpdir(), 'alozuri-seo-production-'));
const api = createSeoApi();
await new Promise<void>((r) => api.listen(3190, '127.0.0.1', r));
let server: ReturnType<typeof spawn> | undefined;
const env = {
  ...process.env,
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3190',
  NEXT_PUBLIC_SITE_URL: 'https://alozuri.com',
  NEXT_PUBLIC_DEMO_MODE: 'false',
  NEXT_PUBLIC_PAYMENT_MODE: 'live',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-seo-build',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-alozuri',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123:web:test',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-alozuri.firebaseapp.com',
  VOYASPAN_STATIC_EXPORT: 'false',
  GOOGLE_SITE_VERIFICATION: 'seo-google-fixture',
  BING_SITE_VERIFICATION: 'seo-bing-fixture',
};
const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: target, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Production build failed ' + code)),
    );
  });
try {
  for (const file of [
    'package.json',
    'package-lock.json',
    'tsconfig.base.json',
    'apps/web/package.json',
    'apps/web/tsconfig.json',
    'apps/web/next.config.ts',
    'apps/web/postcss.config.mjs',
    'apps/web/src',
    'apps/web/public',
    'apps/api/package.json',
    'packages/shared/package.json',
    'packages/shared/src',
  ]) {
    await mkdir(path.dirname(path.join(target, file)), { recursive: true });
    await cp(path.join(source, file), path.join(target, file), { recursive: true });
  }
  await symlink(path.join(source, 'node_modules'), path.join(target, 'node_modules'), 'dir');
  await run([
    path.join(source, 'node_modules/next/dist/bin/next'),
    'build',
    'apps/web',
    '--webpack',
  ]);
  server = spawn(
    process.execPath,
    [path.join(source, 'node_modules/next/dist/bin/next'), 'start', 'apps/web', '-p', '3160'],
    { cwd: target, env, stdio: 'inherit' },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://localhost:3160/robots.txt');
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const get = async (p: string) =>
    fetch('http://localhost:3160' + p, {
      headers: { 'user-agent': 'Googlebot' },
      redirect: 'manual',
    });
  const robots = await (await get('/robots.txt')).text();
  for (const bot of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'GPTBot'])
    assert.ok(robots.includes(bot));
  assert.ok(robots.includes('Disallow: /operations'));
  assert.ok(robots.includes('Sitemap: https://alozuri.com/sitemap.xml'));
  const map = await (await get('/sitemap.xml')).text();
  for (const p of [
    '/destinations/us',
    '/destinations/europe',
    '/guides/holiday-data-budget',
    '/plans/seo-us',
  ])
    assert.ok(map.includes('https://alozuri.com' + p));
  assert.ok(!map.includes('/operations'));
  assert.ok(!map.includes('/checkout'));
  for (const p of [
    '/',
    '/destinations',
    '/destinations/us',
    '/destinations/gb',
    '/destinations/europe',
    '/guides',
    '/guides/holiday-data-budget',
    '/plans/seo-us',
  ]) {
    const r = await get(p),
      html = await r.text();
    assert.equal(r.status, 200, p);
    assert.ok(!r.headers.get('x-robots-tag')?.includes('noindex'), p);
    assert.ok(html.includes('name="robots" content="index, follow"'), p);
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, p);
    assert.ok(
      html.includes('rel="canonical" href="https://alozuri.com' + (p === '/' ? '' : p) + '"') ||
        (p === '/' && html.includes('rel="canonical" href="https://alozuri.com/"')),
      p,
    );
    assert.ok(html.includes('property="og:image"'));
    assert.ok(html.includes('name="twitter:card"'));
    const scripts = [
      ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
    ].map((m) => JSON.parse(m[1]));
    assert.ok(scripts.length > 0, p);
    for (const script of scripts) assert.equal(script['@context'], 'https://schema.org');
    if (p === '/plans/seo-us') {
      assert.ok(html.includes('$12.00'));
      const product = scripts.find((s) => s['@type'] === 'Product');
      assert.equal(product.offers.price, '12.00');
      assert.equal(product.offers.priceCurrency, 'USD');
      assert.equal('aggregateRating' in product, false);
    }
    if (p === '/') {
      assert.ok(html.includes('name="google-site-verification" content="seo-google-fixture"'));
      assert.ok(html.includes('name="msvalidate.01" content="seo-bing-fixture"'));
    }
    console.info('PASS public production metadata/HTML/schema', p);
  }
  for (const p of ['/operations', '/account/orders', '/checkout', '/cart', '/api/currency'])
    assert.ok((await get(p)).headers.get('x-robots-tag')?.includes('noindex'), p);
  assert.ok(
    (await get('/destinations/us?countries=US')).headers.get('x-robots-tag')?.includes('noindex'),
  );
  const alias = await get('/destinations/US');
  assert.ok([200, 308].includes(alias.status));
  if (alias.status === 200)
    assert.ok(
      (await alias.text()).includes('rel="canonical" href="https://alozuri.com/destinations/us"'),
    );

  assert.equal((await get('/plans/seo-nonexistent')).status, 404);
  assert.equal((await get('/guides/does-not-exist')).status, 404);
  console.info(
    'PASS production sitemap, robots, private/filter headers, ownership verification and removed URLs',
  );
  if (process.env.SEO_LIGHTHOUSE === 'true') {
    await new Promise<void>((resolve, reject) => {
      const audit = spawn(
        'npx',
        [
          '--yes',
          'lighthouse',
          'http://localhost:3160/',
          '--output=json',
          '--output-path=/tmp/alozuri-seo-local-lighthouse.json',
          '--only-categories=accessibility,seo',
          '--chrome-flags=--headless --no-sandbox',
          '--quiet',
        ],
        { cwd: target, env: { ...env, CHROME_PATH: chromium.executablePath() }, stdio: 'inherit' },
      );
      audit.on('error', reject);
      audit.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('Lighthouse failed ' + code)),
      );
    });
    console.info(
      'PASS local production Lighthouse run (see /tmp/alozuri-seo-local-lighthouse.json)',
    );
  }
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise<void>((r) => server!.once('exit', () => r()));
    server.kill('SIGTERM');
    await exited;
  }
  await new Promise<void>((r) => api.close(() => r()));
  await rm(target, { recursive: true, force: true });
}
