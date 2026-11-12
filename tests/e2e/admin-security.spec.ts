import { test, expect } from '@playwright/test';

test('anonymous admin navigation redirects to login without requesting privileged data', async ({
  page,
}) => {
  const privileged: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/v1/admin/status'))
      privileged.push(request.url());
  });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Foperations$/);
  await expect(page.getByRole('heading', { name: 'Service status' })).toHaveCount(0);
  expect(privileged).toEqual([]);
});

test('storefront transport cannot forward admin reads or role writes', async ({ request }) => {
  const headers = { authorization: 'Bearer forged-admin', 'x-admin': 'true' };
  const read = await request.get('/api/store/v1/admin/status?admin=true', { headers });
  expect(read.status()).toBe(404);
  const pricing = await request.get(
    '/api/store/v1/operations/pricing-history?from=2026-11-01&to=2026-11-30',
    { headers },
  );
  expect(pricing.status()).toBe(404);
  const write = await request.post('/api/store/v1/admin/roles', {
    headers,
    data: { uid: 'attacker', admin: true },
  });
  expect(write.status()).toBe(404);
});
