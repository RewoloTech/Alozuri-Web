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
  await expect(page.getByText(`Signed in as ${email}.`, { exact: false })).toBeVisible();
  await expect(page.locator('.commerce-total')).toContainText('$12.00');
  const result = await page.request.get(
    'http://127.0.0.1:9099/emulator/v1/projects/demo-alozuri/oobCodes',
  );
  const codes = z
    .object({ oobCodes: z.array(z.object({ email: z.string(), oobCode: z.string() })) })
    .parse(await result.json());
  const code = codes.oobCodes.find((item) => item.email === email)?.oobCode;
  expect(code).toBeTruthy();
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
            allocations: units
              .slice(0, 3)
              .map((id, index) => ({
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
