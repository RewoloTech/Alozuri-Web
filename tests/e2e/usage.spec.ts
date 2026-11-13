import { test, expect, type Page } from '@playwright/test';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';
import type { EsimUsage } from '../../packages/shared/src/esim-usage';

const gb = 1073741824,
  purchase = 'purchase_' + 'a'.repeat(48),
  unit = 'order_' + 'b'.repeat(48);
const reading: EsimUsage = {
  state: 'available',
  stale: false,
  snapshot: {
    kind: 'fixed',
    usedBytes: 2 * gb,
    totalBytes: 5 * gb,
    remainingBytes: 3 * gb,
    profileStatus: 'IN_USE',
    smdpStatus: 'DISABLED',
    esimTranNo: '26111300000001',
    expiresAt: '2026-12-01T00:00:00.000Z',
    checkedAt: new Date().toISOString(),
  },
};
async function setup(page: Page, load: () => EsimUsage, kind = 'fixed') {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.route('http://127.0.0.1:8189/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3100',
      'Access-Control-Allow-Headers': 'content-type,x-order-access',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const plan = {
      id: 'usage-fixture',
      name: 'France usage plan',
      countries: ['FR'],
      dataGb: 5,
      days: 30,
      currency: 'USD',
      priceCents: 999,
      dataType: kind,
      networks: [],
      activation: 'Starts on first connection.',
      fairUse: 'Supplier plan terms.',
      demo: false,
      syncedAt: new Date().toISOString(),
    };
    let data: unknown = {};
    if (path === '/v1/config')
      data = { supportedCurrencies: ['USD'], paymentMode: 'test', cartCheckoutMode: 'test' };
    else if (path === `/v2/orders/${purchase}`) {
      expect(request.headers()['x-order-access']).toBe('private-usage-fixture');
      data = {
        id: purchase,
        email: 'usage@example.test',
        items: [{ plan, quantity: 1 }],
        totalCents: 999,
        currency: 'USD',
        status: 'paid',
        test: false,
        createdAt: new Date().toISOString(),
        allocations: [{ id: unit, status: 'ready', plan }],
      };
    } else if (path.endsWith('/usage')) {
      expect(request.headers()['x-order-access']).toBe('private-usage-fixture');
      expect(path).toBe(`/v2/orders/${purchase}/units/${unit}/usage`);
      data = { usage: load() };
    }
    await route.fulfill({ json: data, headers });
  });
  await page.goto(`/checkout/success?order=${purchase}#access=private-usage-fixture`);
}
test('private order displays the supplier reading, expiry and delay notice at mobile and desktop widths', async ({
  page,
}) => {
  await setup(page, () => reading);
  const panel = page.getByRole('region', { name: 'Data usage', exact: true });
  await expect(panel).toContainText('Installed · disabled');
  await expect(panel).toContainText('26111300000001');
  await expect(panel).toContainText('3 GB');
  await expect(panel).toContainText('2 GB');
  await expect(panel.getByRole('progressbar', { name: 'Data used' })).toHaveAttribute(
    'max',
    String(5 * gb),
  );
  await expect(panel).toContainText('Last checked:');
  await expect(panel).toContainText('2–3 hours');
  await expect(page).not.toHaveURL(/access=/);
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await panel.screenshot({ path: `/tmp/alozuri-usage-${width}.png` });
  }
});
test('usage can recover from pending data and labels stale readings', async ({ page }) => {
  let value: EsimUsage = { state: 'pending', snapshot: null, stale: false };
  await setup(page, () => value);
  const panel = page.getByRole('region', { name: 'Data usage', exact: true });
  await expect(panel).toContainText('not been reported');
  expect(await panel.getByRole('progressbar').count()).toBe(0);
  value = { ...reading, stale: true };
  await panel.getByRole('button', { name: 'Refresh usage' }).click();
  await expect(panel).toContainText('Installed · disabled');
  await expect(panel).toContainText('26111300000001');
  await expect(panel).toContainText('3 GB');
  await expect(panel).toContainText('older reading');
});
test('missing counters never appear as zero remaining', async ({ page }) => {
  await setup(page, () => ({
    ...reading,
    snapshot: reading.snapshot && {
      ...reading.snapshot,
      totalBytes: null,
      usedBytes: null,
      remainingBytes: null,
      expiresAt: null,
    },
  }));
  const panel = page.getByRole('region', { name: 'Data usage', exact: true });
  await expect(panel).toContainText('Not reported');
  await expect(panel).not.toContainText('0 MB');
  expect(await panel.getByRole('progressbar').count()).toBe(0);
});
for (const kind of ['daily', 'unlimited'] as const)
  test(`${kind} usage does not fabricate a total or remaining high-speed allowance`, async ({
    page,
  }) => {
    await setup(
      page,
      () => ({
        ...reading,
        snapshot: reading.snapshot && {
          ...reading.snapshot,
          kind,
          totalBytes: null,
          remainingBytes: null,
        },
      }),
      kind,
    );
    const panel = page.getByRole('region', { name: 'Data usage', exact: true });
    await expect(panel).toContainText('2 GB');
    await expect(panel).not.toContainText('Remaining data');
    expect(await panel.getByRole('progressbar').count()).toBe(0);
    await expect(panel).toContainText('remaining high-speed balance is not reported');
  });

test('missing installation status is not interpreted as an unused or uninstalled eSIM', async ({
  page,
}) => {
  await setup(page, () => ({
    ...reading,
    snapshot: reading.snapshot && { ...reading.snapshot, smdpStatus: null },
  }));
  const panel = page.getByRole('region', { name: 'Data usage', exact: true });
  await expect(panel).toContainText('Installation');
  await expect(panel).toContainText('Not reported');
  await expect(panel).not.toContainText('Ready to install');
  await expect(panel).toContainText('3 GB');
});
