import type { Plan } from '../../packages/shared/src/index';
import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../packages/shared/src/legal';
import { privacyChoice, CONSENT_COOKIE } from '../../packages/shared/src/privacy';
import { searchPageFixture } from '../fixtures/search';
import { test, expect, type Page } from '@playwright/test';
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(({ page }) => {
  expect(browserErrors.get(page) || []).toEqual([]);
});
const plan: Plan = {
  id: 'esim-browser-plan',
  name: 'Europe connection',
  countries: ['FR', 'CH', 'IT'],
  dataGb: 5,
  days: 30,
  priceCents: 1200,
  currency: 'USD',
  dataType: 'fixed',
  activation: 'Starts on first connection to a supported mobile network.',
  networks: ['Verified supplier network'],
  fairUse: 'Fixed data allowance.',
  supplierNotes: 'Additional fixture plan conditions.',
  demo: false,
  syncedAt: new Date().toISOString(),
};
const second = {
  ...plan,
  id: 'esim-browser-second',
  name: 'France connection',
  countries: ['FR'],
  dataGb: 1,
  priceCents: 500,
};
const orderId = 'purchase_' + 'a'.repeat(48);
async function setup(page: Page) {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.route('http://127.0.0.1:8189/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3100',
          'Access-Control-Allow-Headers': 'content-type,authorization,x-order-access',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
        },
      });
      return;
    }
    let data: unknown = {};
    if (url.pathname === '/v1/config')
      data = {
        paymentMode: 'test',
        cartCheckoutMode: 'test',
        supportedCurrencies: ['USD', 'GBP', 'EUR'],
      };
    else if (url.pathname === '/v1/countries')
      data = {
        countries: [
          { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
          { code: 'CH', name: 'Switzerland', flag: '🇨🇭', region: 'Europe' },
          { code: 'IT', name: 'Italy', flag: '🇮🇹', region: 'Europe' },
        ],
      };
    else if (url.pathname === '/v2/search/plans') {
      const selected = (url.searchParams.get('countries') || '').split(',');
      data = searchPageFixture(
        [plan, second].filter((p) => selected.every((c) => p.countries.includes(c))),
      );
    } else if (url.pathname.startsWith('/v1/packages/'))
      data = { plan: url.pathname.endsWith(second.id) ? second : plan };
    else if (url.pathname === '/v2/quote' || url.pathname === '/v2/checkout') {
      const input = req.postDataJSON();
      if (url.pathname === '/v2/checkout') expect(input.legal).toEqual(CHECKOUT_LEGAL_ACCEPTANCE);
      if (url.pathname === '/v2/checkout') {
        // The deployed API still requires the legacy confirmation property.
        // It must come from the same single delivery-email input.
        if (input.emailConfirmation !== input.email) {
          await route.fulfill({ status: 400, json: { error: 'Invalid request parameters.' } });
          return;
        }
      }
      const items = input.items.map((i: { planId: string; quantity: number }) => ({
        plan: i.planId === second.id ? second : plan,
        quantity: i.quantity,
      }));
      const total = items.reduce(
          (sum: number, i: { plan: typeof plan; quantity: number }) =>
            sum + i.plan.priceCents * i.quantity,
          0,
        ),
        quote = { items, currency: 'USD', subtotalCents: total, taxCents: 0, totalCents: total };
      data =
        url.pathname === '/v2/quote'
          ? { quote }
          : {
              orderId,
              accessToken: 'private-browser-fixture',
              clientSecret: 'pi_browser_secret',
              quote,
              paymentMode: 'test',
            };
    } else if (url.pathname.startsWith('/v2/orders/'))
      data = {
        id: orderId,
        email: 'guest@example.com',
        items: [{ plan, quantity: 1 }],
        totalCents: 1200,
        currency: 'USD',
        status: 'paid',
        test: true,
        createdAt: new Date().toISOString(),
        allocations: [{ id: 'order_' + 'b'.repeat(48), plan, status: 'paid' }],
      };
    await route.fulfill({
      json: data,
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
    });
  });
}
async function selectCountry(page: Page, name: string) {
  await page
    .getByRole('button', { name: /Choose destination|Change destination|Add stop|Add destination/ })
    .click();
  await page.getByRole('textbox', { name: 'Search countries' }).fill(name);
  await page
    .getByRole('button', { name: new RegExp(name) })
    .last()
    .click();
}
test('destination directory and picker show each country once even when a legacy API sends aliases', async ({
  page,
}) => {
  await setup(page);
  await page.route('http://127.0.0.1:8189/v1/countries', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: {
        countries: [
          { code: 'AN', name: 'Curaçao', flag: '🇦🇳', region: 'Americas' },
          { code: 'CW', name: 'Curaçao', flag: '🇨🇼', region: 'Americas' },
          { code: 'CW', name: 'Curaçao', flag: '🇨🇼', region: 'Americas' },
          { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
        ],
      },
    }),
  );
  await page.goto('/destinations');
  await expect(page.locator('.country-tile')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search destinations' }).fill('Curacao');
  const curacao = page.locator('.country-tile');
  await expect(curacao).toHaveCount(1);
  await expect(curacao).toHaveAttribute('href', '/destinations/cw');
  await expect(curacao).toContainText('🇨🇼');
  await page.goto('/');
  await page.getByRole('button', { name: /Choose destination/ }).click();
  await page.getByRole('textbox', { name: 'Search countries' }).fill('Curacao');
  await expect(page.getByRole('button', { name: '🇨🇼 Curaçao', exact: true })).toHaveCount(1);
});

test('single and multi destination selection survives mode changes, refresh and navigation', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/');
  await selectCountry(page, 'France');
  await expect(page.getByRole('button', { name: 'Single destination' })).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Multi-country trip' }).click();
  await selectCountry(page, 'Switzerland');
  await selectCountry(page, 'Italy');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await expect(page.getByText('1 plan. Every stop covered.')).toBeVisible();
  await page.getByRole('button', { name: 'Single destination' }).click();
  await expect(page.getByText(/Choose one country for a single-destination/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Search countries' }).fill('France');
  await page.getByRole('button', { name: /🇫🇷 France/ }).click();
  await expect(page.getByRole('button', { name: 'Single destination' })).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Multi-country trip' }).click();
  await expect(page.getByRole('button', { name: 'Remove Switzerland' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Italy' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove Switzerland' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Italy' }).click();
  await expect(page.getByRole('button', { name: 'Remove Italy' })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Remove Italy' })).toBeVisible();
});
test('cart persists, aggregates quantities and remains usable at mobile widths', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/plans/' + plan.id);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.goto('/plans/' + second.id);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('link', { name: 'Shopping cart, 3 items' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Shopping cart, 3 items' })).toBeVisible();
  await page.getByRole('button', { name: 'Increase quantity for Europe connection' }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 4 items' })).toBeVisible();
  await page.getByRole('button', { name: 'Decrease quantity for Europe connection' }).click();
  await page.getByRole('button', { name: 'Remove France connection', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 2 items' })).toBeVisible();
  for (const width of [375, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('link', { name: 'Secure checkout' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/cart-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Remove Europe connection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore destinations' })).toBeVisible();
});

async function mockStripe(page: Page, wallets = true) {
  await page.addInitScript(
    ({ wallets }) => {
      let calls = 0;
      function create(
        type: string,
        options?: {
          fields?: { billingDetails?: { email?: string } };
          paymentMethods?: { applePay?: string; googlePay?: string };
          paymentMethodOrder?: string[];
        },
      ) {
        if (type === 'payment' && options?.fields?.billingDetails?.email !== 'never')
          throw new Error('Payment Element must reuse the delivery email.');
        if (
          type === 'expressCheckout' &&
          (options?.paymentMethods?.applePay !== 'always' ||
            options?.paymentMethods?.googlePay !== 'always' ||
            options?.paymentMethodOrder?.join(',') !== 'apple_pay,google_pay,link')
        )
          throw new Error(
            'Express checkout must enable broader supported wallet coverage and prioritize Apple/Google Pay.',
          );
        let node: HTMLElement | null = null;
        const callbacks = new Map<string, (e: unknown) => void>();
        return {
          on: (name: string, cb: (e: unknown) => void) => {
            callbacks.set(name, cb);
            if (name === 'ready')
              setTimeout(
                () =>
                  cb(
                    type === 'expressCheckout'
                      ? {
                          availablePaymentMethods: wallets
                            ? { applePay: true, googlePay: true }
                            : null,
                        }
                      : {},
                  ),
                0,
              );
          },
          off: (name: string) => callbacks.delete(name),
          update: () => {},
          destroy: () => {
            if (node) node.innerHTML = '';
          },
          mount: (target: HTMLElement) => {
            node = target;
            if (type === 'expressCheckout') {
              if (wallets)
                for (const name of ['Apple Pay', 'Google Pay']) {
                  const b = document.createElement('button');
                  b.type = 'button';
                  b.textContent = name;
                  b.onclick = () => callbacks.get('confirm')?.({ paymentFailed: () => {} });
                  target.append(b);
                }
            } else {
              const label = document.createElement('label');
              label.textContent = 'Card number';
              const input = document.createElement('input');
              input.setAttribute('aria-label', 'Card number');
              label.append(input);
              target.append(label);
            }
          },
        };
      }
      const stripe = {
        _registerWrapper: () => {},
        registerAppInfo: () => {},
        createToken: () => {},
        createPaymentMethod: () => {},
        confirmCardPayment: () => {},
        elements: () => ({ create, submit: async () => ({}) }),
        confirmPayment: async (params: {
          confirmParams?: { payment_method_data?: { billing_details?: { email?: string } } };
        }) => {
          if (
            params.confirmParams?.payment_method_data?.billing_details?.email !==
            'guest@example.com'
          )
            throw new Error('Stripe confirmation must receive the delivery email.');
          calls++;
          return calls === 1
            ? { error: { message: 'Your card was declined. Try another payment method.' } }
            : { paymentIntent: { status: 'succeeded' } };
        },
      };
      Object.assign(window, { Stripe: Object.assign(() => stripe, { version: 'endive' }) });
    },
    { wallets },
  );
}
async function openCheckout(page: Page) {
  await setup(page);
  await page.goto('/plans/' + plan.id);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.goto('/checkout');
  await expect(page.locator('input[type="email"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('guest@example.com');
  const choices = page.getByRole('checkbox');
  await expect(choices).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  for (const checkbox of await choices.all()) {
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
  }
  await expect(page.locator('.checkout-policy-notice')).toContainText(
    'By placing your order, you agree to our Terms & Conditions',
  );
  await expect(page.getByText('Your agreement and supply choices')).toHaveCount(0);
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const checkbox = await choices.boundingBox();
    const text = await page.locator('label.checkbox-label > span').boundingBox();
    if (!checkbox || !text) throw new Error('Device compatibility row must be visible');
    expect(checkbox.x + checkbox.width).toBeLessThan(text.x);
    expect(Math.abs(checkbox.y - text.y)).toBeLessThanOrEqual(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/alozuri-checkout-consent-mobile.png', fullPage: true });
  if (viewport) await page.setViewportSize(viewport);
  await page.getByRole('button', { name: 'Continue to payment' }).click();
}
for (const wallet of ['Apple Pay', 'Google Pay'])
  test(`guest payment retries a decline using ${wallet} without another order`, async ({
    page,
  }) => {
    await mockStripe(page);
    let checkouts = 0;
    page.on('request', (r) => {
      if (r.url().endsWith('/v2/checkout') && r.method() === 'POST') checkouts++;
    });
    await openCheckout(page);
    await expect(page.getByRole('button', { name: 'Apple Pay', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Google Pay', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Card number' }).fill('4242424242424242');
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(
      page.getByText('Your card was declined. Try another payment method.'),
    ).toBeVisible();
    await page.getByRole('button', { name: wallet, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your test order', exact: true })).toBeVisible();
    expect(checkouts).toBe(1);
    await expect(page.getByRole('link', { name: 'Shopping cart, 0 items' })).toBeVisible();
  });
test('unsupported wallets are hidden and card checkout remains available', async ({ page }) => {
  await mockStripe(page, false);
  await openCheckout(page);
  await expect(page.getByRole('textbox', { name: 'Card number' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apple Pay', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Google Pay', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Pay / })).toBeEnabled();
  for (const width of [375, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/checkout-${width}.png`, fullPage: true });
  }
});

test('country picker supports native keyboard activation and returns focus after selection', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/v1/countries', async (route) =>
    route.fulfill({
      json: {
        countries: [
          { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe' },
          { code: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮', region: 'Africa' },
        ],
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose destination' }).click();
  const search = page.getByRole('textbox', { name: 'Search countries' });
  await search.fill('UK');
  await search.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove United Kingdom' })).toBeVisible();
  await page.getByRole('button', { name: 'Change destination' }).click();
  await search.fill('ivory coast');
  await search.press('ArrowDown');
  await expect(page.getByRole('dialog').getByRole('button', { name: /Côte/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/countries=CI/);
  await expect(page.locator('.country-chip')).toHaveText(/Côte/);
  await expect(page.getByRole('button', { name: 'Change destination' })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Change destination' }).click();
  await search.press('Escape');
  await expect(page.getByRole('button', { name: 'Change destination' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Change destination' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('Buy now goes straight to a simple guest checkout with clear terms links and the verified payment total', async ({
  page,
}) => {
  await setup(page);
  await mockStripe(page, false);
  await page.goto('/plans/' + plan.id);
  const conditions = page.locator('details.plan-conditions');
  await expect(conditions).not.toHaveAttribute('open', '');
  await expect(page.getByText(plan.activation, { exact: true })).toBeVisible();
  await conditions.getByText('Plan conditions', { exact: true }).click();
  await expect(conditions).toContainText('Additional fixture plan conditions.');
  await page.getByRole('link', { name: 'Buy now', exact: true }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/checkout' && url.searchParams.get('buy') === plan.id,
  );
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('guest@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByRole('button', { name: 'Pay $12.00', exact: true })).toBeEnabled();
  const notice = page.locator('.checkout-policy-notice');
  await expect(notice).toHaveCount(1);
  for (const path of ['/terms', '/refund-policy', '/privacy', '/esim-compatibility'])
    await expect(notice.locator(`a[href="${path}"]`)).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Pay $12.00', exact: true })).toBeVisible();
    if (width === 390)
      await page.screenshot({ path: '/tmp/alozuri-simple-payment-mobile.png', fullPage: true });
    if (width === 1440)
      await page.screenshot({ path: '/tmp/alozuri-simple-payment-desktop.png', fullPage: true });
  }
});

test('normalising an old regional URL keeps single-country search local without trapping Back', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/help');
  await page.goto('/?mode=country&countries=FR&coverage=all');
  await expect(page).toHaveURL((url) => url.searchParams.get('coverage') === 'local');
  await expect(page.getByText('Also show regional and global plans')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/help$/);
});

test('an empty data filter explains existing multi-country coverage and can show the regional bundle', async ({
  page,
}) => {
  await setup(page);
  const queries: URLSearchParams[] = [];
  await page.route('http://127.0.0.1:8189/v2/search/plans*', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: searchPageFixture(
        [plan],
        Number(params.get('minGb')) >= 50 ? { plans: [], total: 0 } : {},
      ),
    });
  });
  await page.goto('/?mode=trip&countries=FR,CH&allowance=50');
  await expect(page.locator('.country-chip')).toHaveCount(2);
  await expect(page.getByRole('combobox', { name: 'Data allowance' })).toHaveValue('50');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await expect(
    page.getByRole('heading', { name: 'No plans match this data allowance' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      '1 plan covers all your selected countries, but none match the selected data allowance.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show all data plans', exact: true }).click();
  await expect(page.getByRole('heading', { name: plan.name, exact: true })).toBeVisible();
  expect(queries.at(-1)?.get('coverage')).toBe('all');
  expect(queries.at(-1)?.get('minGb')).toBe('0');
  await expect(page.getByRole('combobox', { name: 'Data allowance' })).toHaveValue('all');
});

test('trip mode persists with one or zero countries through refresh and explicit tab changes', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/?mode=trip&countries=FR,CH&trip=FR,CH');
  await expect(page.locator('.country-chip')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove Switzerland', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Multi-country trip', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'Single destination', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.country-chip')).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Multi-country trip', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Remove France', exact: true }).click();
  await expect(page.locator('.country-chip')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Multi-country trip', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await selectCountry(page, 'France');
  await page.getByRole('button', { name: 'Single destination', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Single destination', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.country-chip')).toHaveText(/France/);
});

test('rapid quantity updates keep the summary stable and checkout available while confirming prices', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/plans/' + plan.id);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.goto('/cart');
  const checkout = page.getByRole('link', { name: 'Secure checkout →', exact: true });
  await expect(checkout).toHaveAttribute('aria-disabled', 'false');
  const summary = page.locator('.commerce-summary');
  await summary.evaluate((node) => node.setAttribute('data-stability-marker', 'same-summary'));
  const before = await summary.boundingBox();
  let requests = 0;
  await page.route('http://127.0.0.1:8189/v2/quote', async (route) => {
    requests++;
    const input = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const items = input.items.map((item: { planId: string; quantity: number }) => ({
      plan,
      quantity: item.quantity,
    }));
    const total = items.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity * plan.priceCents,
      0,
    );
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: {
        quote: { items, currency: 'USD', subtotalCents: total, taxCents: 0, totalCents: total },
      },
    });
  });
  await page
    .getByRole('button', { name: 'Increase quantity for ' + plan.name })
    .click({ clickCount: 2, delay: 30 });
  await expect(page.locator('.quantity-controls output')).toHaveText('3');
  await expect(summary).toHaveAttribute('data-stability-marker', 'same-summary');
  await expect(summary.locator('.commerce-total')).toContainText('$36.00');
  await expect(checkout).toHaveAttribute('aria-disabled', 'false');
  await expect(summary).toHaveAttribute('aria-busy', 'true');
  const pending = await summary.boundingBox();
  expect(pending?.height).toBe(before?.height);
  await expect(summary).toHaveAttribute('aria-busy', 'false');
  await expect(checkout).toHaveAttribute('aria-disabled', 'false');
  await expect(summary).toHaveAttribute('data-stability-marker', 'same-summary');
  expect(requests).toBe(1);
  await page.screenshot({ path: '/tmp/alozuri-stable-cart-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/alozuri-stable-cart-mobile.png', fullPage: true });
});

test('customers can open checkout during a slow cart check, but payment waits for the verified total', async ({
  page,
}) => {
  await setup(page);
  await mockStripe(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/plans/' + plan.id);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  let release!: () => void;
  const waitForQuote = new Promise<void>((resolve) => {
    release = resolve;
  });
  let quotes = 0,
    payments = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/v2/checkout')) payments++;
  });
  await page.route('http://127.0.0.1:8189/v2/quote', async (route) => {
    quotes++;
    await waitForQuote;
    await route.fallback();
  });
  await page.goto('/cart');
  await expect.poll(() => quotes).toBeGreaterThan(0);
  const checkout = page.getByRole('link', { name: 'Secure checkout →', exact: true });
  await expect(checkout).toHaveAttribute('aria-disabled', 'false');
  await checkout.click();
  await expect(page).toHaveURL(/\/checkout$/);
  const checking = page.getByRole('button', { name: 'Confirming your total…' });
  await expect(checking).toBeVisible();
  await expect(checking).toBeDisabled();
  await expect(checking).toHaveAttribute('aria-busy', 'true');
  await expect(checking).toHaveCSS('opacity', '1');
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('guest@example.com');
  await page.getByRole('checkbox').check();
  await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(payments).toBe(0);
  await page.screenshot({ path: '/tmp/alozuri-checkout-progress-mobile.png', fullPage: true });
  release();
  const proceed = page.getByRole('button', { name: 'Continue to payment', exact: true });
  await expect(proceed).toBeEnabled();
  await expect(page.locator('.commerce-total')).toContainText('$12.00');
  await proceed.click();
  await expect(page.getByRole('button', { name: 'Pay $12.00', exact: true })).toBeEnabled();
  expect(payments).toBe(1);
});

test('failed price verification provides a retry and never starts payment with an unverified total', async ({
  page,
}) => {
  await setup(page);
  await mockStripe(page, false);
  let attempts = 0,
    payments = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/v2/checkout')) payments++;
  });
  await page.route('http://127.0.0.1:8189/v2/quote', async (route) => {
    if (++attempts === 1)
      await route.fulfill({ status: 503, json: { error: 'Prices temporarily unavailable.' } });
    else await route.fallback();
  });
  await page.goto('/checkout?buy=' + plan.id);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Prices temporarily unavailable.',
  );
  await expect(
    page.getByRole('button', { name: 'Continue to payment', exact: true }),
  ).toBeDisabled();
  expect(payments).toBe(0);
  await page.getByRole('button', { name: 'Retry checkout', exact: true }).click();
  await expect(page.locator('#checkout-next-step')).toContainText(
    'Confirm that your device supports eSIM',
  );
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('guest@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pay $12.00', exact: true })).toBeEnabled();
  expect(payments).toBe(1);
});

test('a stalled total check stops waiting and offers a safe retry', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('http://127.0.0.1:8189/v2/quote', async (route) => {
    await stalled;
    await route.fallback();
  });
  let payments = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/v2/checkout')) payments++;
  });
  await page.goto('/checkout?buy=' + plan.id);
  await expect(page.getByRole('button', { name: 'Confirming your total…' })).toBeDisabled();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Confirming your total took too long.',
    { timeout: 12000 },
  );
  await expect(page.getByRole('button', { name: 'Retry checkout', exact: true })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Continue to payment', exact: true }),
  ).toBeDisabled();
  expect(payments).toBe(0);
  release();
});

test('the entire data allowance field opens its native picker, including the label and arrow', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/?mode=country&countries=FR');
  const field = page.locator('.data-field');
  const select = page.getByRole('combobox', { name: 'Data allowance' });
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await field.scrollIntoViewIfNeeded();
    for (const target of ['label', 'value', 'arrow', 'padding']) {
      const point = await field.evaluate((element, target) => {
        const rect = element.getBoundingClientRect();
        const child =
          target === 'label'
            ? element.querySelector('.field-label')
            : target === 'arrow'
              ? element.querySelector('svg')
              : null;
        const childRect = child?.getBoundingClientRect();
        const x = childRect
          ? childRect.x + childRect.width / 2
          : target === 'padding'
            ? rect.x + 5
            : rect.x + rect.width / 2;
        const y = childRect
          ? childRect.y + childRect.height / 2
          : target === 'padding'
            ? rect.y + 5
            : rect.bottom - 20;
        return {
          x,
          y,
          hitsSelect: document.elementFromPoint(x, y) === element.querySelector('select'),
        };
      }, target);
      expect(point.hitsSelect, `${target} at ${width}px reaches the native select`).toBe(true);
      await page.mouse.click(point.x, point.y);
      await expect
        .poll(() => select.evaluate((element) => element.matches(':open')), {
          message: `${target} at ${width}px opens the picker`,
        })
        .toBe(true);
      // Close the platform picker with its trigger; headless macOS does not
      // forward Playwright's Escape key to the native popup consistently.
      await page.mouse.click(point.x, point.y);
      await expect.poll(() => select.evaluate((element) => element.matches(':open'))).toBe(false);
      await expect(select).toBeFocused();
    }
    await select.selectOption('5');
    await expect(select).toHaveValue('5');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await field.screenshot({ path: `/tmp/alozuri-allowance-${width}.png` });
  }
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => select.evaluate((element) => element.matches(':open'))).toBe(true);
  await select.click();
  await expect.poll(() => select.evaluate((element) => element.matches(':open'))).toBe(false);
  await select.selectOption('all');
  await expect(select).toHaveValue('all');
});

test('allowance filters show 50 GB and fair-use plans and restore selection after reload', async ({
  page,
}) => {
  await setup(page);
  const fifty = { ...plan, id: 'fifty', name: 'Europe 50 GB', dataGb: 50 };
  const daily = {
    ...plan,
    id: 'daily',
    name: 'Europe daily',
    dataGb: 2,
    dataType: 'daily' as const,
    dailyPolicy: 'reduced' as const,
    fairUse: '2 GB high-speed per day, then 384 Kbps.',
  };
  await page.route('**/v2/search/plans*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    expect(q.get('countries')).toBe('FR,CH,IT');
    const unlimited = q.get('dataType') === 'unlimited';
    if (!unlimited) expect(q.get('minGb')).toBe('50');
    await route.fulfill({ json: searchPageFixture(unlimited ? [daily] : [fifty]) });
  });
  await page.goto('/?mode=trip&countries=FR,CH,IT');
  const allowance = page.getByRole('combobox', { name: 'Data allowance' });
  await allowance.selectOption('50');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await expect(page.getByRole('heading', { name: fifty.name, exact: true })).toBeVisible();
  await allowance.selectOption('unlimited');
  await expect(page.getByRole('heading', { name: daily.name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: fifty.name, exact: true })).toHaveCount(0);
  await expect(page.getByText('Unlimited · 2 GB/day high-speed', { exact: true })).toBeVisible();
  await expect(page.getByText(daily.fairUse, { exact: true })).toBeVisible();
  await page.reload();
  await expect(allowance).toHaveValue('unlimited');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await expect(page.getByRole('heading', { name: daily.name, exact: true })).toBeVisible();
});

test('a delayed allowance response cannot replace a newer selection', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  let finish!: () => void;
  const oldHandled = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const seen = page.waitForRequest(
    (r) =>
      r.url().includes('/v2/search/plans') && new URL(r.url()).searchParams.get('minGb') === '50',
  );
  await page.route('**/v2/search/plans*', async (route) => {
    const latest = new URL(route.request().url()).searchParams.get('dataType') === 'unlimited';
    if (!latest) await gate;
    await route.fulfill({
      json: searchPageFixture([
        {
          ...plan,
          id: latest ? 'latest' : 'stale',
          name: latest ? 'Latest unlimited result' : 'Stale 50 GB result',
          dataGb: latest ? 2 : 50,
          dataType: latest ? 'daily' : 'fixed',
          ...(latest ? { dailyPolicy: 'reduced' as const } : {}),
        },
      ]),
    });
    if (!latest) finish();
  });
  await page.goto('/?mode=trip&countries=FR,CH,IT');
  await page.getByRole('combobox', { name: 'Data allowance' }).selectOption('50');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await seen;
  await page.getByRole('combobox', { name: 'Data allowance' }).selectOption('unlimited');
  await expect(page.getByRole('heading', { name: 'Latest unlimited result' })).toBeVisible();
  release();
  await oldHandled;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByRole('heading', { name: 'Latest unlimited result' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stale 50 GB result' })).toHaveCount(0);
});

test('single-country search excludes regional plans even from an old wider-coverage URL', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/v2/search/plans*', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('coverage')).toBe('local');
    await route.fulfill({ json: searchPageFixture([second]) });
  });
  await page.goto('/?mode=country&countries=FR&coverage=all');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await expect(page.getByRole('heading', { name: second.name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: plan.name, exact: true })).toHaveCount(0);
  await expect(page.getByText('Also show regional and global plans')).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.searchParams.get('coverage') === 'local');
});

const pagedPlans = Array.from({ length: 25 }, (_, i) => ({
  ...plan,
  id: 'paged-' + i,
  name: 'Paged plan ' + i,
  dataGb: i === 24 ? 50 : 5,
  priceCents: 100 + i,
}));
test('pagination preserves server sort, total counts and facets without losing or duplicating plans', async ({
  page,
}) => {
  await setup(page);
  const cursors: (string | null)[] = [];
  await page.route('**/v2/search/plans*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    expect(q.get('pageSize')).toBe('12');
    expect(q.get('sort')).toBe('price');
    const cursor = q.get('cursor');
    cursors.push(cursor);
    const offset = cursor === 'page2' ? 12 : cursor === 'page3' ? 24 : 0;
    await route.fulfill({
      json: searchPageFixture(pagedPlans.slice(offset, offset + 12), {
        total: 25,
        nextCursor: offset === 0 ? 'page2' : offset === 12 ? 'page3' : null,
        facets: searchPageFixture(pagedPlans).facets,
      }),
    });
  });
  await page.goto('/?mode=trip&countries=FR,CH,IT&sort=price');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(12);
  await expect(page.getByText('Showing 12 of 25 matching plans')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Sort plans' })).toHaveValue('price');
  await expect(page.locator('.data-field option[value="50"]')).toContainText('(1)');
  await page.getByRole('button', { name: /Show more plans/ }).click();
  await expect(page.locator('.plan-card')).toHaveCount(24);
  await page.getByRole('button', { name: /Show more plans/ }).click();
  await expect(page.locator('.plan-card')).toHaveCount(25);
  await expect(page.getByRole('button', { name: /Show more plans/ })).toHaveCount(0);
  expect(new Set(await page.locator('.plan-card h3').allTextContents()).size).toBe(25);
  expect(cursors).toEqual([null, 'page2', 'page3']);
});

test('catalogue revision changes clear old pages and require a fresh search', async ({ page }) => {
  await setup(page);
  let refreshed = false;
  await page.route('**/v2/search/plans*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.has('cursor')) {
      refreshed = true;
      await route.fulfill({
        status: 409,
        json: { error: 'The catalogue changed. Refresh your search.' },
      });
      return;
    }
    await route.fulfill({
      json: searchPageFixture(refreshed ? [pagedPlans[24]] : pagedPlans.slice(0, 12), {
        total: refreshed ? 1 : 25,
        nextCursor: refreshed ? null : 'stale',
        revision: (refreshed ? '1' : '0').repeat(64),
      }),
    });
  });
  await page.goto('/?mode=trip&countries=FR,CH,IT');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(12);
  await page.getByRole('button', { name: /Show more plans/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'The catalogue changed' })).toBeVisible();
  await expect(page.locator('.plan-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: pagedPlans[24].name, exact: true })).toBeVisible();
});

test('payment currency locks and equal-amount currency changes use separate checkout attempts', async ({
  page,
}) => {
  await setup(page);
  await mockStripe(page, false);
  const attempts: { currency: string; requestId: string; expectedTotalCents: number }[] = [];
  await page.route('**/v1/packages/' + second.id + '*', async (route) => {
    const currency = new URL(route.request().url()).searchParams.get('currency') || 'USD';
    await route.fulfill({ json: { plan: { ...second, currency, priceCents: 500 } } });
  });
  await page.route(/\/v2\/(quote|checkout)$/, async (route) => {
    const input = route.request().postDataJSON();
    const row = { ...second, currency: input.currency, priceCents: 500 };
    const quote = {
      items: [{ plan: row, quantity: input.items[0].quantity }],
      currency: input.currency,
      subtotalCents: 500 * input.items[0].quantity,
      taxCents: 0,
      totalCents: 500 * input.items[0].quantity,
    };
    const checkout = route.request().url().endsWith('/checkout');
    if (checkout) attempts.push(input);
    await route.fulfill({
      json: checkout
        ? {
            orderId,
            accessToken: 'private-browser-fixture',
            clientSecret: 'pi_browser_secret',
            quote,
            paymentMode: 'test',
          }
        : { quote },
    });
  });
  await page.goto('/plans/' + second.id);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  for (const currency of ['USD', 'EUR']) {
    await page.goto('/cart');
    const selector = page.getByRole('combobox', { name: 'Currency', exact: true });
    await selector.selectOption(currency);
    await expect(page.locator('.commerce-total')).toContainText(currency);
    await expect(page.getByRole('link', { name: /Secure checkout/ })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    await page.getByRole('link', { name: /Secure checkout/ }).click();
    await page
      .getByRole('textbox', { name: 'Email address', exact: true })
      .fill('guest@example.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByRole('button', { name: /^Pay / })).toBeEnabled();
    await expect(selector).toBeDisabled();
  }
  expect(attempts).toHaveLength(2);
  expect(attempts.map((a) => a.currency)).toEqual(['USD', 'EUR']);
  expect(attempts.map((a) => a.expectedTotalCents)).toEqual([500, 500]);
  expect(attempts[0].requestId).not.toBe(attempts[1].requestId);
});

test('GBP/EUR repricing updates search, quantities and the verified payment amount', async ({
  page,
}) => {
  await setup(page);
  await mockStripe(page, false);
  const displayed = (currency: string): Plan => ({
    ...second,
    currency: currency === 'GBP' ? 'GBP' : currency === 'EUR' ? 'EUR' : 'USD',
    priceCents: currency === 'GBP' ? 999 : currency === 'EUR' ? 1199 : 1500,
  });
  await page.route('**/v2/search/plans*', async (route) =>
    route.fulfill({
      json: searchPageFixture([
        displayed(new URL(route.request().url()).searchParams.get('currency') || 'USD'),
      ]),
    }),
  );
  await page.route('**/v1/packages/' + second.id + '*', async (route) =>
    route.fulfill({
      json: {
        plan: displayed(new URL(route.request().url()).searchParams.get('currency') || 'USD'),
      },
    }),
  );
  await page.route(/\/v2\/(quote|checkout)$/, async (route) => {
    const input = route.request().postDataJSON();
    const p = displayed(input.currency),
      quantity = input.items[0].quantity;
    const quote = {
      items: [{ plan: p, quantity }],
      currency: p.currency,
      subtotalCents: p.priceCents * quantity,
      taxCents: 0,
      totalCents: p.priceCents * quantity,
    };
    const checkout = route.request().url().endsWith('/checkout');
    if (checkout) {
      expect(input.currency).toBe('EUR');
      expect(input.expectedTotalCents).toBe(2398);
    }
    await route.fulfill({
      json: checkout
        ? {
            orderId,
            accessToken: 'private-browser-fixture',
            clientSecret: 'pi_browser_secret',
            quote,
            paymentMode: 'test',
          }
        : { quote },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mode=country&countries=FR');
  await page.getByRole('button', { name: 'Find my eSIM' }).click();
  const currency = page.getByRole('combobox', { name: 'Currency', exact: true });
  await currency.selectOption('GBP');
  await expect(page.locator('.plan-card strong')).toContainText('£9.99');
  await page.locator('.plan-card a').click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.goto('/cart');
  await expect(page.locator('.commerce-total')).toContainText('£9.99');
  await currency.selectOption('EUR');
  await expect(page.locator('.commerce-total')).toContainText('€11.99');
  await page.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(page.locator('.commerce-total')).toContainText('€23.98');
  await expect(page.getByRole('link', { name: /Secure checkout/ })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
  await page.getByRole('link', { name: /Secure checkout/ }).click();
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('guest@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByRole('button', { name: 'Pay €23.98', exact: true })).toBeEnabled();
  await expect(currency).toBeDisabled();
});

test('plan cards keep equal heights and align prices and actions despite wrapped content', async ({
  page,
}) => {
  await setup(page);
  const names = [
    'France 500MB/Day',
    'France 1GB/Day',
    'France 1GB/Day with extended supplier conditions',
    'France 1GB/Day FUP1Mbps',
    'France 500MB/Day with additional coverage details',
    'France 5GB',
  ];
  const plans: Plan[] = names.map((name, i) => ({
    ...second,
    id: 'aligned-plan-' + i,
    name,
    dataGb: i === 5 ? 5 : i === 0 || i === 4 ? 500 / 1024 : 1,
    dataType: i === 5 ? 'fixed' : 'daily',
    ...(i === 5 ? {} : { dailyPolicy: 'reduced' as const }),
    days: i === 5 ? 30 : 1,
    fairUse:
      i === 0 || i === 4
        ? '500 MB high-speed per day, then reduced speed (512 Kbps). Additional supplier conditions apply to this plan.'
        : '1 GB high-speed per day, then reduced speed (1 Mbps).',
  }));
  await page.route('http://127.0.0.1:8189/v2/search/plans**', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: searchPageFixture(plans),
    }),
  );
  await page.goto('/?mode=country&countries=FR');
  const cards = page.locator('.plan-grid .plan-card');
  await page.getByRole('button', { name: 'Find my eSIM', exact: true }).click();
  await expect(cards).toHaveCount(6);
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () =>
        cards.evaluateAll((elements) => {
          const rows = new Map<number, { price: number; button: number }[]>();
          const heights: number[] = [];
          for (const card of elements) {
            const box = card.getBoundingClientRect(),
              price = card.querySelector('.plan-bottom strong')?.getBoundingClientRect(),
              button = card.querySelector('.plan-bottom .button')?.getBoundingClientRect();
            if (!price || !button) return false;
            heights.push(box.height);
            const row = rows.get(Math.round(box.top)) ?? [];
            row.push({ price: price.top, button: button.top });
            rows.set(Math.round(box.top), row);
          }
          return (
            Math.max(...heights) - Math.min(...heights) < 1 &&
            [...rows.values()].every(
              (row) =>
                Math.max(...row.map((p) => p.price)) - Math.min(...row.map((p) => p.price)) < 1 &&
                Math.max(...row.map((p) => p.button)) - Math.min(...row.map((p) => p.button)) < 1,
            )
          );
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 1440)
      await page
        .locator('.plan-grid')
        .screenshot({ path: '/tmp/alozuri-aligned-plan-cards-desktop.png' });
    if (width === 390)
      await cards.first().screenshot({ path: '/tmp/alozuri-aligned-plan-card-mobile.png' });
  }
});
