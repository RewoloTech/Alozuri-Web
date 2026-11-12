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
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let data: unknown;
    if (url.pathname === '/v1/config')
      data = { supportedCurrencies: ['USD'], paymentMode: 'test', cartCheckoutMode: 'test' };
    else if (url.pathname === '/v1/packages/' + plan.id) data = { plan };
    else if (url.pathname === '/v1/countries') data = { countries: [] };
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
  return { accounts, merges, checkouts, release };
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
