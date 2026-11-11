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
const plan = {
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
      function create(type: string) {
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
        confirmPayment: async () => {
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
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('guest@example.com');
  await page.getByRole('textbox', { name: 'Confirm email address' }).fill('different@example.com');
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
  await expect(page.getByText('Email addresses do not match.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Confirm email address' }).fill('guest@example.com');
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
  await search.fill('ivory coast');
  await search.press('ArrowDown');
  await expect(page.getByRole('dialog').getByRole('button', { name: /Côte/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/countries=CI/);
  await expect(page.locator('.country-chip')).toHaveText(/Côte/);
  await expect(page.getByRole('button', { name: 'Change destination' })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  await page.getByRole('textbox', { name: 'Confirm email address' }).fill('guest@example.com');
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

test('rapid quantity updates keep the summary and checkout control mounted until the latest quote is verified', async ({
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
  await expect(checkout).toHaveAttribute('aria-disabled', 'true');
  await expect(summary).toHaveAttribute('aria-busy', 'true');
  await checkout.click({ force: true });
  await expect(page).toHaveURL(/\/cart$/);
  const pending = await summary.boundingBox();
  expect(pending?.height).toBe(before?.height);
  await expect(checkout).toHaveAttribute('aria-disabled', 'false');
  await expect(summary).toHaveAttribute('data-stability-marker', 'same-summary');
  expect(requests).toBe(1);
  await page.screenshot({ path: '/tmp/alozuri-stable-cart-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/alozuri-stable-cart-mobile.png', fullPage: true });
});
