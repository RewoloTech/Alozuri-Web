import { test, expect, type Page } from '@playwright/test';
import { z } from 'zod';
import { mergeCartItems, type CartItem, type Plan } from '../../packages/shared/src/index';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';
import { demoPlans } from '../../packages/shared/src/demo';

test.skip(
  process.env.E2E_CART_AUTH_EMULATOR !== 'true',
  'Run npm run test:cart:browser with the isolated Auth emulator.',
);
const plan: Plan = {
  ...demoPlans[0],
  id: 'cart-auth-plan',
  name: 'Cart regression plan',
  priceCents: 1200,
  currency: 'USD',
  demo: false,
};
const itemsSchema = z.array(z.object({ planId: z.string(), quantity: z.number().int() }));
type AccountCart = { items: CartItem[]; version: number; merges: Set<string> };
async function setup(page: Page, delayed = false, interrupted = false) {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.addInitScript(() => localStorage.setItem('alozuri-currency', 'USD'));
  const accounts = new Map<string, AccountCart>();
  const profiles = new Map<
    string,
    {
      uid: string;
      email: string;
      emailVerified: boolean;
      displayName: string | null;
      firstName: string;
      lastName: string;
      providerIds: string[];
      createdAt: string;
      lastSignInAt: string;
      updatedAt: string;
    }
  >();
  const profileWrites: unknown[] = [];
  const merges: { uid: string; items: CartItem[]; mergeId: string }[] = [];
  const checkouts: { items: CartItem[]; expectedTotalCents: number; currency: string }[] = [];
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let firstHeld = false;
  const lines = (items: CartItem[]) => items.map((item) => ({ plan, quantity: item.quantity }));
  await page.route('http://127.0.0.1:8189/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3100',
      'Access-Control-Allow-Headers': 'content-type,authorization,x-order-access',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let data: unknown;
    if (url.pathname === '/v1/config')
      data = { supportedCurrencies: ['USD'], paymentMode: 'test', cartCheckoutMode: 'test' };
    else if (url.pathname === '/v1/packages/' + plan.id) data = { plan };
    else if (url.pathname === '/v1/countries') data = { countries: [] };
    else if (
      url.pathname === '/v2/profile' ||
      url.pathname === '/v2/orders' ||
      url.pathname.endsWith('/usage')
    ) {
      const jwt = request.headers().authorization?.slice(7).split('.')[1];
      if (!jwt) throw new Error('Profile and account reads require a real emulator user');
      const identity = z
        .object({ user_id: z.string(), email: z.string(), email_verified: z.boolean() })
        .parse(JSON.parse(Buffer.from(jwt, 'base64url').toString()));
      const uid = identity.user_id;
      if (url.pathname === '/v2/profile') {
        const timestamp = new Date().toISOString();
        const profile = profiles.get(uid) ?? {
          uid,
          email: identity.email,
          emailVerified: identity.email_verified,
          displayName: null,
          firstName: '',
          lastName: '',
          providerIds: ['password'],
          createdAt: timestamp,
          lastSignInAt: timestamp,
          updatedAt: timestamp,
        };
        profile.emailVerified = identity.email_verified;
        if (request.method() === 'PATCH') {
          const fields = z
            .object({ firstName: z.string(), lastName: z.string() })
            .strict()
            .parse(request.postDataJSON());
          profileWrites.push(fields);
          Object.assign(profile, fields, {
            displayName: fields.firstName + ' ' + fields.lastName,
            updatedAt: timestamp,
          });
        }
        profiles.set(uid, profile);
        data = { profile };
      } else {
        expect(identity.email_verified).toBe(true);
        const purchaseId = 'purchase_' + 'a'.repeat(48),
          unitId = 'order_' + 'b'.repeat(48),
          gb = 1073741824;
        data = url.pathname.endsWith('/usage')
          ? {
              usage: {
                state: 'available',
                stale: false,
                snapshot: {
                  kind: 'fixed',
                  usedBytes: gb,
                  totalBytes: 5 * gb,
                  remainingBytes: 4 * gb,
                  profileStatus: 'IN_USE',
                  expiresAt: null,
                  checkedAt: new Date().toISOString(),
                },
              },
            }
          : {
              orders: [
                {
                  id: purchaseId,
                  email: identity.email,
                  items: [{ plan, quantity: 1 }],
                  totalCents: 1200,
                  currency: 'USD',
                  status: 'paid',
                  test: false,
                  createdAt: new Date().toISOString(),
                  allocations: [{ id: unitId, plan, status: 'ready' }],
                },
              ],
            };
      }
    } else if (url.pathname === '/v1/orders') data = { orders: [] };
    else if (url.pathname === '/v2/quote' || url.pathname === '/v2/checkout') {
      const input = z
        .object({
          items: itemsSchema,
          currency: z.string(),
          expectedTotalCents: z.number().optional(),
        })
        .parse(request.postDataJSON());
      const total = input.items.reduce((sum, item) => sum + item.quantity * plan.priceCents, 0);
      if (url.pathname === '/v2/checkout') {
        checkouts.push({
          items: input.items,
          expectedTotalCents: input.expectedTotalCents ?? -1,
          currency: input.currency,
        });
        expect(input.expectedTotalCents).toBe(total);
        return route.fulfill({
          status: 400,
          headers,
          json: { error: 'Controlled test stopped before creating a payment.' },
        });
      }
      data = {
        quote: {
          items: lines(input.items),
          subtotalCents: total,
          taxCents: 0,
          totalCents: total,
          currency: 'USD',
        },
      };
    } else if (url.pathname.startsWith('/v2/cart')) {
      const jwt = request.headers().authorization?.slice(7).split('.')[1];
      if (!jwt) throw new Error('Cart request must use a real emulator-authenticated user');
      const claims = z
        .object({ user_id: z.string(), email_verified: z.literal(true) })
        .parse(JSON.parse(Buffer.from(jwt, 'base64url').toString()));
      const uid = claims.user_id;
      let account = accounts.get(uid);
      if (!account) {
        account = {
          items: delayed || interrupted ? [{ planId: plan.id, quantity: 1 }] : [],
          version: 0,
          merges: new Set(),
        };
        accounts.set(uid, account);
      }
      if (request.method() === 'POST') {
        const input = z
          .object({ items: itemsSchema, mergeId: z.uuid() })
          .parse(request.postDataJSON());
        merges.push({ uid, ...input });
        if (!account.merges.has(input.mergeId)) {
          account.items = mergeCartItems(account.items, input.items);
          account.merges.add(input.mergeId);
          account.version++;
        }
        const snapshot = { items: lines(account.items), version: account.version };
        if (interrupted) {
          interrupted = false;
          return route.fulfill({
            status: 503,
            headers,
            json: { error: 'Merge response interrupted.' },
          });
        }
        if (delayed && !firstHeld) {
          firstHeld = true;
          await hold;
        }
        return route.fulfill({ headers, json: snapshot });
      }
      if (request.method() === 'PUT') {
        const input = z
          .object({ items: itemsSchema, version: z.number().int() })
          .parse(request.postDataJSON());
        if (input.version !== account.version)
          return route.fulfill({ status: 409, headers, json: { error: 'Cart version conflict' } });
        account.items = input.items;
        account.version++;
      }
      data = { items: lines(account.items), version: account.version };
    } else data = { bundles: [] };
    await route.fulfill({ headers, json: data });
  });
  return { accounts, merges, checkouts, release, profiles, profileWrites };
}
async function signup(page: Page) {
  const email = `cart-${crypto.randomUUID()}@example.test`,
    password = 'cart-emulator-password';
  await page.goto('/plans/' + plan.id);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('link', { name: 'Shopping cart, 1 item', exact: true }).click();
  await expect(page.locator('.commerce-total')).toContainText('$12.00');
  await page.getByRole('link', { name: 'Secure checkout →', exact: true }).click();
  await expect(page.locator('.commerce-total')).toContainText('$12.00');
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill(email);
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account and stay at checkout', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toHaveValue(
    email,
  );
  await expect(page.locator('.commerce-total')).toContainText('$12.00');
  // Delivery email is filled before signup; wait for the asynchronous verification send.
  let code: string | undefined;
  await expect
    .poll(async () => {
      const result = await page.request.get(
        'http://127.0.0.1:9099/emulator/v1/projects/demo-alozuri/oobCodes',
      );
      const codes = z
        .object({ oobCodes: z.array(z.object({ email: z.string(), oobCode: z.string() })) })
        .parse(await result.json());
      code = codes.oobCodes.find((item) => item.email === email)?.oobCode;
      return Boolean(code);
    })
    .toBe(true);
  if (!code) throw new Error('Emulator verification email was not available.');
  const verified = await page.request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-emulator-key',
    { data: { oobCode: code } },
  );
  expect(verified.status()).toBe(200);
  await page.goto('/verify-email?next=%2Fcart');
  await page.getByRole('button', { name: 'I’ve verified my email', exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  return { email, password };
}
async function logout(page: Page) {
  await page.getByRole('button', { name: 'My account', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Log in/ })).toBeVisible();
}
async function login(page: Page, email: string, password: string) {
  await page.goto('/login?next=%2Fcart');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
}
async function checkout(
  page: Page,
  checkouts: { expectedTotalCents: number; items: CartItem[] }[],
) {
  await page.getByRole('link', { name: 'Secure checkout →', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Controlled test stopped');
  expect(checkouts.at(-1)?.expectedTotalCents).toBe(1200);
  expect(checkouts.at(-1)?.items).toEqual([{ planId: plan.id, quantity: 1 }]);
}
for (const width of [390, 1440])
  test(`real guest signup, verification, reload and login keep one cart item and the exact checkout amount at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    const user = await signup(page);
    await expect(page.locator('.quantity-controls output')).toHaveText('1');
    await expect(page.locator('.commerce-total')).toContainText('$12.00');
    await page.reload();
    await expect(page.locator('.quantity-controls output')).toHaveText('1');
    await expect(
      page.getByRole('link', { name: 'Secure checkout →', exact: true }),
    ).toHaveAttribute('aria-disabled', 'false');
    expect(new Set(state.merges.map((merge) => merge.mergeId)).size).toBe(1);
    await logout(page);
    await login(page, user.email, user.password);
    await expect(page.locator('.quantity-controls output')).toHaveText('1');
    await expect(page.locator('.commerce-total')).toContainText('$12.00');
    await checkout(page, state.checkouts);
  });
test('a delayed pre-signout merge cannot restore two items after the customer reduces the new session to one', async ({
  page,
}) => {
  const state = await setup(page, true);
  const user = await signup(page);
  await expect.poll(() => state.merges.length).toBeGreaterThan(0);
  await logout(page);
  await login(page, user.email, user.password);
  await expect(page.locator('.quantity-controls output')).toHaveText('2');
  await page.getByRole('button', { name: 'Decrease quantity for ' + plan.name }).click();
  await expect.poll(() => [...state.accounts.values()][0].items[0].quantity).toBe(1);
  state.release();
  await expect(page.locator('.quantity-controls output')).toHaveText('1');
  await expect(page.locator('.commerce-total')).toContainText('$12.00');
  await checkout(page, state.checkouts);
});

test('choosing the saved account cart after an interrupted guest merge does not merge it again on reload', async ({
  page,
}) => {
  const state = await setup(page, false, true);
  await signup(page);
  await expect(page.locator('main [role="alert"]')).toContainText('Merge response interrupted.');
  await expect(page.getByRole('link', { name: 'Secure checkout →', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('button', { name: 'Use saved account cart', exact: true }).click();
  await expect(page.locator('.quantity-controls output')).toHaveText('2');
  await expect(page.getByRole('link', { name: 'Secure checkout →', exact: true })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
  await expect(page.locator('.commerce-total')).toContainText('$24.00');
  expect(state.merges.at(-1)?.items).toEqual([]);
  expect([...state.accounts.values()][0].items).toEqual([{ planId: plan.id, quantity: 2 }]);
  await page.getByRole('button', { name: 'Decrease quantity for ' + plan.name }).click();
  await expect.poll(() => [...state.accounts.values()][0].items[0].quantity).toBe(1);
  await checkout(page, state.checkouts);
});

test('verified customers can navigate usage, orders and profile, update names and never retain private usage after logout', async ({
  page,
}) => {
  const state = await setup(page);
  await signup(page);
  await page.getByRole('button', { name: 'My account', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Account navigation' })
    .getByRole('link', { name: 'Data usage', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Data usage', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Data usage', exact: true })).toContainText('4 GB');
  const navigation = page.getByRole('navigation', { name: 'Account sections' });
  await expect(navigation.getByRole('link', { name: 'Data usage' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const links = await navigation.getByRole('link').all();
    for (const link of links) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await navigation.screenshot({ path: `/tmp/alozuri-account-sections-${width}.png` });
  }
  await navigation.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Data usage', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .getByRole('navigation', { name: 'Account sections' })
    .getByRole('link', { name: 'Profile', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'First name', exact: true }).fill('Mary Jane');
  await page.getByRole('textbox', { name: 'Last name', exact: true }).fill('Smith');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Your name has been updated.' }),
  ).toBeVisible();
  expect(state.profileWrites.at(-1)).toEqual({ firstName: 'Mary Jane', lastName: 'Smith' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/alozuri-user-profile-390.png', fullPage: true });
  await expect.poll(() => [...state.profiles.values()][0].firstName).toBe('Mary Jane');
  await page
    .getByRole('navigation', { name: 'Account sections' })
    .getByRole('link', { name: 'Data usage', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Data usage', exact: true })).toContainText('4 GB');
  await logout(page);
  await page.goto('/account/usage');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Data usage', exact: true })).toHaveCount(0);
});

test('Data usage shows separate eSIM readings without opening orders, and explains pending and refunded units', async ({
  page,
}) => {
  await setup(page);
  await signup(page);
  const purchase = 'purchase_' + 'a'.repeat(48);
  const units = ['b', 'c', 'd', 'e'].map((character) => 'order_' + character.repeat(48));
  const usageRequests: string[] = [];
  await page.route('http://127.0.0.1:8189/v2/orders', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const common = {
      email: 'fixture@example.test',
      items: [{ plan, quantity: 3 }],
      totalCents: 3600,
      currency: 'USD',
      createdAt: '2026-11-11T12:00:00.000Z',
    };
    await route.fulfill({
      json: {
        orders: [
          {
            ...common,
            id: purchase,
            status: 'paid',
            test: false,
            allocations: units.slice(0, 3).map((id, index) => ({
              id,
              plan: { ...plan, name: `Travel eSIM ${index + 1}` },
              status: index === 2 ? 'paid' : 'ready',
            })),
          },
          {
            ...common,
            id: 'purchase_' + 'b'.repeat(48),
            status: 'paid',
            test: true,
            allocations: [{ id: 'order_' + 'f'.repeat(48), plan, status: 'ready' }],
          },
          {
            ...common,
            id: 'purchase_' + 'c'.repeat(48),
            status: 'refunded',
            test: false,
            allocations: [{ id: units[3], plan, status: 'refunded' }],
          },
        ],
      },
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
    });
  });
  await page.route('http://127.0.0.1:8189/v2/orders/**/usage', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const path = new URL(route.request().url()).pathname;
    usageRequests.push(path);
    const amount = path.includes(units[0]) ? 1 : 2,
      gb = 1073741824;
    await route.fulfill({
      json: {
        usage: {
          state: 'available',
          stale: false,
          snapshot: {
            kind: 'fixed',
            usedBytes: amount * gb,
            totalBytes: 5 * gb,
            remainingBytes: (5 - amount) * gb,
            profileStatus: 'IN_USE',
            expiresAt: null,
            checkedAt: '2026-11-12T12:00:00.000Z',
          },
        },
      },
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
    });
  });
  await page.goto('/account/usage');
  const cards = page.locator('.usage-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).getByRole('region', { name: 'Data usage', exact: true })).toContainText(
    '4 GB',
  );
  await expect(cards.nth(1).getByRole('region', { name: 'Data usage', exact: true })).toContainText(
    '3 GB',
  );
  await expect(cards.nth(2)).toContainText('Your eSIM is being prepared.');
  await expect(cards.nth(3)).toContainText('cancelled or refunded');
  expect(usageRequests.sort()).toEqual(
    units
      .slice(0, 2)
      .map((unit) => `/v2/orders/${purchase}/units/${unit}/usage`)
      .sort(),
  );
  expect(new URL(page.url()).pathname).toBe('/account/usage');
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const card = cards.first(),
      action = card.getByRole('link', { name: 'View order and installation' });
    const reading = await card
      .getByRole('region', { name: 'Data usage', exact: true })
      .boundingBox();
    const button = await action.boundingBox();
    expect(button!.y - (reading!.y + reading!.height)).toBeGreaterThanOrEqual(16);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    if (width === 390 || width === 1440)
      await card.screenshot({ path: `/tmp/alozuri-usage-direct-${width}.png` });
  }
  await page.reload();
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toContainText('4 GB');
});

test('Operations uses normal login, admin-only navigation, date reports and revoked access', async ({
  page,
}) => {
  test.setTimeout(90000);
  const state = await setup(page);
  const user = await signup(page);
  void state;
  let financialReads = 0;
  let pricingReads = 0;
  const pricingQueries: URLSearchParams[] = [];
  const { londonMonth } = await import('../../packages/shared/src/financial');
  const period = londonMonth();
  const saleDate = period.from.slice(0, 8) + '12';
  const previousDate = period.from.slice(0, 8) + '11';
  let provisional = false;
  let currentAdmin: (uid: string) => Promise<boolean> = async () => false;
  const queries: URLSearchParams[] = [];
  const savedPromotions: import('zod').infer<
    typeof import('../../apps/api/src/lib/promotions').promotionInput
  >[] = [];
  await page.route('http://127.0.0.1:8189/v1/operations/**', async (route) => {
    const request = route.request();
    const headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3100',
      'Access-Control-Allow-Headers': 'content-type,authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const token = request.headers().authorization?.slice(7).split('.')[1];
    const claims = token ? JSON.parse(Buffer.from(token, 'base64url').toString()) : {};
    if (claims.admin !== true || !(await currentAdmin(claims.user_id)))
      return route.fulfill({
        status: 403,
        headers,
        json: { error: 'Administrator access required.' },
      });
    const url = new URL(request.url());
    if (url.pathname.endsWith('/promotions/packages'))
      return route.fulfill({
        headers,
        json: { rows: [{ id: 'plan-uk', name: 'United Kingdom connection' }] },
      });
    if (url.pathname.endsWith('/promotions/preview')) {
      const { contributionPreview } = await import('../../apps/api/src/lib/promotion-routes');
      const percent = z
        .object({ discountPercent: z.number() })
        .parse(request.postDataJSON()).discountPercent;
      return route.fulfill({ headers, json: contributionPreview(1000, 100000, percent) });
    }
    if (url.pathname.endsWith('/promotions')) {
      if (request.method() !== 'GET') {
        const { promotionInput } = await import('../../apps/api/src/lib/promotions');
        const promotion = promotionInput.parse(request.postDataJSON());
        const old = savedPromotions.findIndex((p) => p.code === promotion.code);
        if (old >= 0) savedPromotions[old] = promotion;
        else savedPromotions.push(promotion);
        return route.fulfill({ headers, json: { saved: true } });
      }
      return route.fulfill({
        headers,
        json: {
          rows: savedPromotions
            .filter(
              (p) =>
                p.code.startsWith(url.searchParams.get('q') ?? '') &&
                (!url.searchParams.has('active') ||
                  String(p.active) === url.searchParams.get('active')),
            )
            .map((p) => ({ ...p, redemptionCount: 0, reservedCount: 0, totals: {} })),
          nextCursor: null,
        },
      });
    }
    if (url.pathname.endsWith('/access'))
      return route.fulfill({ headers, json: { authorized: true } });
    if (url.pathname.endsWith('/status'))
      return route.fulfill({
        headers,
        json: {
          mode: 'catalogue',
          paymentsEnabled: true,
          supplierConnected: true,
          catalogueCount: 10,
        },
      });

    if (url.pathname.endsWith('/supplier-credit')) {
      const input = request.postDataJSON();
      expect(input.amountUsd).toBe('5.0000');
      expect(input.reference).toBe('Supplier refund receipt');
      expect(input.expectedVersion).toBe(0);
      expect(input.requestId).toBeTruthy();
      return route.fulfill({ headers, json: { saved: true } });
    }
    if (url.pathname.endsWith('/orders/search')) {
      const q = url.searchParams.get('q');
      const next = Boolean(url.searchParams.get('cursor'));
      return route.fulfill({
        headers,
        json: {
          query: q,
          rows:
            q === '26111399999999'
              ? []
              : [
                  {
                    id: 'purchase_' + (next ? 'e' : 'f').repeat(48),
                    reference: next ? 'AZ-EEEE-EEEE-EEEE-EEEE' : 'AZ-FFFF-FFFF-FFFF-FFFF',
                    email: 'sample@example.test',
                    createdAt: `${saleDate}T12:00:00.000Z`,
                    amountMinor: 2000,
                    currency: 'GBP',
                    paymentStatus: 'paid',
                    plans: [{ name: 'France connection', quantity: 2 }],
                    esims: [
                      {
                        id: 'order_' + 'a'.repeat(48),
                        name: 'France connection',
                        supplier: { id: 'esimaccess', name: 'eSIM Access' },
                        esimTranNo: '26111300000001',
                      },
                    ],
                  },
                ],
          nextCursor: q === 'sample@example.test' && !next ? 'next-fixture' : null,
        },
      });
    }
    if (url.pathname.includes('/esims')) {
      if (url.searchParams.get('q') === '26111399999999')
        return route.fulfill({
          status: 404,
          headers,
          json: { error: 'eSIM transaction not found.' },
        });
      return route.fulfill({
        headers,
        json: {
          purchaseId: 'purchase_' + 'f'.repeat(48),
          stripePayment: {
            paymentIntentId: 'pi_StripeReferenceFixture',
            dashboardUrl: 'https://dashboard.stripe.com/payments/pi_StripeReferenceFixture',
          },
          createdAt: `${saleDate}T12:00:00.000Z`,
          amountMinor: 2000,
          currency: 'GBP',
          fulfilmentStatus: 'fulfilled',
          items: [{ name: 'France connection', quantity: 2 }],
          reference: 'AZ-FFFF-FFFF-FFFF-FFFF',
          email: 'sample@example.test',
          paymentStatus: 'paid',
          units: [
            {
              id: 'order_' + 'a'.repeat(48),
              name: 'France connection',
              fulfilmentStatus: 'ready',
              supplier: { id: 'esimaccess', name: 'eSIM Access' },
              amountMinor: 1000,
              currency: 'GBP',
              supplierCost: {
                originalUnits: 50000,
                verified: true,
                creditUnits: 0,
                version: 0,
                reference: null,
              },
              supplierOrderNo: 'B-SUPPORT-FIXTURE',
              esimTranNo: '26111300000001',
              usage: {
                state: 'available',
                stale: false,
                snapshot: {
                  kind: 'fixed',
                  usedBytes: 1073741824,
                  totalBytes: 5 * 1073741824,
                  remainingBytes: 4 * 1073741824,
                  profileStatus: 'IN_USE',
                  smdpStatus: 'DISABLED',
                  esimTranNo: '26111300000001',
                  expiresAt: null,
                  checkedAt: new Date().toISOString(),
                },
              },
            },
          ],
        },
      });
    }
    if (url.pathname.endsWith('/pricing-history')) {
      pricingReads++;
      pricingQueries.push(url.searchParams);
      const { pricingMovement } = await import('../../apps/api/src/lib/pricing-history');
      const base = {
        id: 'point1',
        packageId: 'france-price',
        name: 'France connection',
        countries: ['FR', 'DE', 'IT', 'ES'],
        identitySource: 'snapshot',
        recordedAt: `${saleDate}T12:00:00.000Z`,
        kind: 'catalogue_sync',
        supplierCurrency: 'USD',
        supplierScale: 10000,
        sellingCurrency: 'USD',
      };
      const rows = [
        {
          ...base,
          ...pricingMovement(
            { wholesaleUnits: 10000, priceCents: 300 },
            { wholesaleUnits: 11000, priceCents: 300, active: true },
          ),
        },
        {
          ...base,
          id: 'point2',
          packageId: 'japan-price',
          name: 'Japan connection',
          countries: ['JP'],
          ...pricingMovement(
            { wholesaleUnits: 20000, priceCents: 400 },
            { wholesaleUnits: 10000, priceCents: 300, active: false },
          ),
        },
        {
          ...base,
          id: 'point3',
          ...pricingMovement(
            { wholesaleUnits: 10000, priceCents: 300 },
            { wholesaleUnits: 10000, priceCents: 300, active: true },
          ),
        },
      ].filter(
        (row) =>
          (!url.searchParams.get('packageId') ||
            row.packageId === url.searchParams.get('packageId')) &&
          saleDate >= url.searchParams.get('from')! &&
          saleDate <= url.searchParams.get('to')!,
      );
      return route.fulfill({
        headers,
        json: {
          from: url.searchParams.get('from'),
          to: url.searchParams.get('to'),
          timezone: 'Europe/London',
          packageId: url.searchParams.get('packageId'),
          rows,
          nextCursor: null,
        },
      });
    }
    financialReads++;
    queries.push(url.searchParams);
    const { initialFinancial, calculateFinancial, summarize } =
      await import('../../apps/api/src/lib/financial-calculations');
    const row = initialFinancial(
      'purchase_' + 'f'.repeat(48),
      'purchases',
      {
        uid: 'synthetic-operator-order',
        email: 'sample@example.test',
        createdAt: `${saleDate}T12:00:00.000Z`,
        paidAt: `${saleDate}T12:01:00.000Z`,
        status: 'paid',
        orderReference: 'AZ-FFFF-FFFF-FFFF-FFFF',
        test: false,
        currency: 'GBP',
        totalCents: 2000,
        items: [
          {
            quantity: 2,
            wholesaleUnits: 50000,
            plan: {
              name: 'France connection',
              countries: ['FR', 'DE', 'IT', 'ES'],
              priceCents: 1000,
              currency: 'GBP',
            },
          },
        ],
      },
      { source: 'fixture', asOf: saleDate, numerator: '8', denominator: '10' },
    );
    row.supplier.purchasedUnits = 100000;
    row.supplier.verifiedUnits = provisional ? null : 100000;
    row.fulfilmentStatus = 'fulfilled';
    row.stripe.observedAt = `${saleDate}T12:02:00.000Z`;
    row.selling.refundedMinor = 0;
    row.stripe.revenueGbp = 2000;
    row.stripe.feesGbp = 50;
    const ready = calculateFinancial(row);
    const rows =
      url.searchParams.get('from')! <= saleDate && url.searchParams.get('to')! >= saleDate
        ? [ready]
        : [];
    await route.fulfill({
      headers,
      json: {
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
        timezone: 'Europe/London',
        currency: 'GBP',
        summary: summarize(rows),
        trends: (await import('../../apps/api/src/lib/financial-trends')).financialTrends(
          rows,
          url.searchParams.get('from')!,
          url.searchParams.get('to')!,
        ),
        rows,
        nextCursor: null,
      },
    });
  });
  await page.goto('/operations');
  await expect(page.locator('.operations-page').getByRole('alert')).toContainText(
    'Administrator access is required',
  );
  expect(financialReads).toBe(0);
  expect(pricingReads).toBe(0);
  await page.getByRole('button', { name: 'My account', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Operations', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Only the isolated Auth emulator is given a role; production credentials are never used.
  const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } =
    await import('firebase-admin/app');
  const { getAuth: getAdminAuth } = await import('firebase-admin/auth');
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  const app = initializeAdmin({ projectId: 'demo-alozuri' }, 'operations-browser-fixture');
  const auth = getAdminAuth(app);
  currentAdmin = async (uid) => {
    const account = await auth.getUser(uid);
    return account.emailVerified && account.customClaims?.admin === true && !account.disabled;
  };
  try {
    const account = await auth.getUserByEmail(user.email);
    await auth.setCustomUserClaims(account.uid, { admin: true });
    await logout(page);
    await login(page, user.email, user.password);
    await page.getByRole('button', { name: 'My account', exact: true }).click();
    await page.getByRole('link', { name: 'Operations', exact: true }).click();
    await expect(page).toHaveURL(/\/operations$/);
    await expect(page.getByRole('heading', { name: 'Total Sales', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Financial transactions' })).toContainText(
      'France connection',
    );
    const transactions = page.getByRole('region', { name: 'Financial transactions' });
    const supportDetails = transactions.locator('.operations-esim-details').first();
    await supportDetails.locator(':scope > summary').click();
    await expect(supportDetails).toContainText('26111300000001');
    await expect(supportDetails).toContainText('Installed · disabled');
    await expect(supportDetails).toContainText('4 GB');
    await supportDetails.locator(':scope > summary').click();
    const lookup = page.getByRole('region', { name: 'Order search' });
    await lookup.getByLabel('Search orders', { exact: true }).fill('sample@example.test');
    await lookup.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(
      lookup.getByRole('button', { name: 'Open order AZ-FFFF-FFFF-FFFF-FFFF' }),
    ).toBeVisible();
    await expect(lookup.locator('.operations-provider-reference').first()).toContainText(
      'eSIM Access',
    );
    await expect(lookup.locator('.operations-provider-reference').first()).toContainText(
      '26111300000001',
    );
    await expect(lookup.getByText('Installed · disabled', { exact: true })).toHaveCount(0);
    await lookup.getByRole('button', { name: 'Open order AZ-FFFF-FFFF-FFFF-FFFF' }).click();
    await expect(lookup).toContainText('Installed · disabled');
    await expect(lookup).toContainText('eSIM Access');
    await expect(lookup).toContainText('Order total: £20.00 (GBP)');
    await expect(lookup.getByRole('link', { name: 'Open payment in Stripe' })).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/payments/pi_StripeReferenceFixture',
    );
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await lookup.getByRole('button', { name: 'Copy Stripe payment ID', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'pi_StripeReferenceFixture',
    );
    await expect(lookup).toContainText('pi_StripeReferenceFixture');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await lookup
      .getByRole('button', { name: 'Copy order reference AZ-FFFF-FFFF-FFFF-FFFF', exact: true })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'AZ-FFFF-FFFF-FFFF-FFFF',
    );
    await lookup
      .getByRole('button', {
        name: 'Copy supplier order number for France connection',
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('B-SUPPORT-FIXTURE');
    await lookup
      .getByRole('button', {
        name: 'Copy eSIM Tran No for France connection',
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('26111300000001');
    const creditEditor = lookup.locator('.operations-supplier-credit').first();
    await creditEditor.locator('summary').click();
    await creditEditor.getByLabel('Total supplier refund received (USD)').fill('5.0000');
    await creditEditor
      .getByLabel('Supplier refund reference / evidence')
      .fill('Supplier refund receipt');
    await creditEditor.getByRole('button', { name: 'Record supplier credit', exact: true }).click();
    await expect(creditEditor.getByRole('status')).toContainText('Supplier credit recorded');
    await expect(creditEditor).toContainText('Net supplier cost : USD 0.0000');
    for (const width of [375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 || width === 1440)
        await lookup.screenshot({ path: `/tmp/alozuri-order-search-${width}.png` });
    }
    await lookup.getByRole('button', { name: 'Next results', exact: true }).click();
    await expect(lookup).toContainText('AZ-EEEE-EEEE-EEEE-EEEE');
    await expect(lookup.getByText('Installed · disabled', { exact: true })).toHaveCount(0);
    await lookup.getByRole('button', { name: 'Previous results', exact: true }).click();
    await expect(lookup).toContainText('AZ-FFFF-FFFF-FFFF-FFFF');
    await lookup.getByLabel('Search orders', { exact: true }).fill('26111399999999');
    await lookup.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(lookup.getByText('No matching orders found.', { exact: true })).toBeVisible();
    await expect(lookup.getByText('Installed · disabled', { exact: true })).toHaveCount(0);
    const countryDetails = transactions.locator('.operations-countries').first();
    await expect(countryDetails).not.toHaveAttribute('open', '');
    await expect(countryDetails.getByText('France, Germany, Italy, Spain')).not.toBeVisible();
    await countryDetails.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(countryDetails.getByText('France, Germany, Italy, Spain')).toBeVisible();
    await countryDetails.locator('summary').click();
    await expect(transactions.getByRole('row').filter({ hasText: 'AZ-UNPAID' })).toHaveCount(0);
    for (const width of [320, 375, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const fromBox = await page.getByLabel('From Date', { exact: true }).boundingBox();
      const toBox = await page.getByLabel('To Date', { exact: true }).boundingBox();
      if (!fromBox || !toBox) throw new Error('Date fields must be visible');
      expect(fromBox.y + fromBox.height <= toBox.y || fromBox.x + fromBox.width <= toBox.x).toBe(
        true,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({ path: `/tmp/alozuri-operations-${width}.png`, fullPage: true });
    }
    await page.getByLabel('From Date', { exact: true }).fill(period.from);
    await page.getByLabel('To Date', { exact: true }).fill(saleDate);
    await expect.poll(() => queries.at(-1)?.get('to')).toBe(saleDate);
    await page.getByLabel('To Date', { exact: true }).fill(previousDate);
    await expect(page.getByText('No orders in this date range.', { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('heading', { name: 'Total Sales', exact: true })
        .locator('..')
        .locator('strong'),
    ).toHaveText('0');
    await page.getByLabel('To Date', { exact: true }).fill(saleDate);
    await expect(page.getByRole('region', { name: 'Financial transactions' })).toContainText(
      'France connection',
    );
    provisional = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Profit', exact: true }).locator('..').locator('strong'),
    ).toHaveText('£11.50');
    await expect(page.getByRole('region', { name: 'Financial transactions' })).toContainText(
      'Quoted USD 10.0000 · actual charge unverified',
    );
    await expect(page.getByRole('region', { name: 'Financial transactions' })).toContainText(
      'fulfilled · Provisional',
    );

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `/tmp/alozuri-supplier-estimates-${width}.png`,
        fullPage: true,
      });
    }
    await page.getByRole('tab', { name: 'Trends', exact: true }).click();
    const trendsPanel = page.getByRole('tabpanel', { name: 'Trends', exact: true });
    await expect(trendsPanel.getByRole('heading', { name: 'Revenue over time' })).toBeVisible();
    await expect(trendsPanel.getByRole('heading', { name: 'Profit over time' })).toBeVisible();
    await expect(trendsPanel.getByRole('heading', { name: 'Top-selling plans' })).toBeVisible();
    await expect(
      trendsPanel.getByRole('region', { name: 'Profit over time', exact: true }),
    ).toContainText('£11.50');
    await expect(
      trendsPanel.getByRole('region', { name: 'Profit over time', exact: true }),
    ).toContainText('Provisional');
    await expect(
      trendsPanel.getByRole('region', { name: 'Top-selling plans', exact: true }),
    ).toContainText('2 sold');
    const bar = trendsPanel
      .getByRole('region', { name: 'Revenue over time chart' })
      .getByRole('button')
      .nth(10);
    await bar.focus();
    await page.keyboard.press('ArrowRight');
    await expect(
      trendsPanel
        .getByRole('region', { name: 'Revenue over time chart' })
        .getByRole('button')
        .nth(11),
    ).toBeFocused();
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 || width === 1440)
        await trendsPanel.screenshot({ path: `/tmp/alozuri-trends-${width}.png` });
    }
    await trendsPanel.getByLabel('To Date', { exact: true }).fill(previousDate);
    await expect(
      trendsPanel.getByRole('region', { name: 'Top-selling plans', exact: true }),
    ).toContainText('No paid orders');
    await trendsPanel.getByLabel('To Date', { exact: true }).fill(saleDate);
    await expect(
      trendsPanel.getByRole('region', { name: 'Top-selling plans', exact: true }),
    ).toContainText('2 sold');
    await page.getByRole('tab', { name: 'Pricing History', exact: true }).click();
    const pricingPanel = page.getByRole('tabpanel', { name: 'Pricing History', exact: true });
    await expect(
      pricingPanel.getByRole('region', { name: 'Catalogue pricing history' }),
    ).toContainText('France connection');
    const pricingCountries = pricingPanel.locator('.operations-countries').first();
    await expect(pricingCountries.getByText('France, Germany, Italy, Spain')).not.toBeVisible();
    await pricingCountries.locator('summary').click();
    await expect(pricingCountries.getByText('France, Germany, Italy, Spain')).toBeVisible();
    await pricingCountries.locator('summary').click();
    await expect(pricingPanel.getByText('↑ Increased', { exact: true })).toBeVisible();
    await expect(pricingPanel.getByText('↓ Decreased', { exact: true })).toBeVisible();
    await expect(pricingPanel.getByText('— Unchanged', { exact: true })).toBeVisible();
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `/tmp/alozuri-pricing-history-${width}.png`,
          fullPage: true,
        });
    }
    await pricingPanel
      .getByRole('button', { name: 'View price history for France connection', exact: true })
      .first()
      .click();
    await expect(
      pricingPanel.getByRole('region', { name: 'Package price trend' }),
    ).not.toContainText('Japan connection');
    expect(pricingQueries.at(-1)?.get('packageId')).toBe('france-price');
    await pricingPanel.getByLabel('To Date', { exact: true }).fill(previousDate);
    await expect(
      pricingPanel.getByText('No pricing history recorded in this date range.', { exact: false }),
    ).toBeVisible();
    await pricingPanel.getByLabel('To Date', { exact: true }).fill(saleDate);
    await expect(pricingPanel.getByRole('region', { name: 'Package price trend' })).toContainText(
      'France connection',
    );
    await pricingPanel.getByRole('button', { name: 'All packages', exact: true }).click();
    await expect(
      pricingPanel.getByRole('region', { name: 'Catalogue pricing history' }),
    ).toContainText('Japan connection');
    await page.getByRole('tab', { name: 'Pricing History', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(
      page.getByRole('tab', { name: 'Financial Overview', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Total Sales', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Financial Overview', exact: true }).focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Promotions', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const promotionsPanel = page.getByRole('tabpanel', { name: 'Promotions', exact: true });
    await expect(promotionsPanel.getByText('No promotions found.', { exact: true })).toBeVisible();
    await expect(
      promotionsPanel.getByRole('button', { name: 'Save promotion', exact: true }),
    ).toBeEnabled();
    await promotionsPanel.getByRole('button', { name: 'Save promotion', exact: true }).click();
    await expect(promotionsPanel.getByRole('alert')).toContainText('Set the start date');
    await expect(promotionsPanel.getByRole('alert')).toContainText('Preview impact');
    await promotionsPanel.getByLabel('Code', { exact: true }).fill('SUMMER10');
    await promotionsPanel.getByLabel('Starts at (UTC)').fill(period.from + 'T00:00');
    await promotionsPanel.getByLabel('Expires at (UTC)').fill(period.to + 'T23:59');
    await promotionsPanel.getByLabel('Maximum paid uses (optional)').fill('5');
    await promotionsPanel.getByRole('button', { name: 'Find packages', exact: true }).click();
    await promotionsPanel
      .getByRole('combobox', { name: 'Package', exact: true })
      .selectOption('plan-uk');
    await promotionsPanel.getByRole('button', { name: 'Preview impact', exact: true }).click();
    await expect(promotionsPanel.getByRole('status')).toContainText(
      'Critical: zero or negative contribution',
    );
    await expect(
      promotionsPanel.getByRole('button', { name: 'Save promotion', exact: true }),
    ).toBeEnabled();
    for (const width of [375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({ path: `/tmp/alozuri-promotions-${width}.png`, fullPage: true });
    }
    await promotionsPanel.getByRole('button', { name: 'Save promotion', exact: true }).click();
    await expect(
      promotionsPanel.getByRole('heading', { name: 'SUMMER10 · 10% · Active', exact: true }),
    ).toBeVisible();
    expect(savedPromotions[0].startsAt).toBe(period.from + 'T00:00:00.000Z');
    await promotionsPanel
      .getByRole('button', { name: 'Edit / change status', exact: true })
      .click();
    await promotionsPanel.getByLabel('Active', { exact: true }).uncheck();
    await promotionsPanel.getByRole('button', { name: 'Preview impact', exact: true }).click();
    await expect(
      promotionsPanel.getByRole('button', { name: 'Save promotion', exact: true }),
    ).toBeEnabled();
    await promotionsPanel.getByRole('button', { name: 'Save promotion', exact: true }).click();
    await expect(
      promotionsPanel.getByRole('heading', { name: 'SUMMER10 · 10% · Inactive', exact: true }),
    ).toBeVisible();
    await promotionsPanel
      .getByRole('combobox', { name: 'Status', exact: true })
      .selectOption('true');
    await expect(promotionsPanel.getByText('No promotions found.', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Promotions', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByRole('tab', { name: 'Financial Overview', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await auth.setCustomUserClaims(account.uid, {});
    await page.reload();
    await expect(page.locator('.operations-page').getByRole('alert')).toContainText(
      'Administrator access is required',
    );
    await expect(page.getByRole('heading', { name: 'Total Sales', exact: true })).toHaveCount(0);
  } finally {
    await deleteAdmin(app);
  }
});
