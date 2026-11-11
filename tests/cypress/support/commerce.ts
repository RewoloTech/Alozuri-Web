import { privacyChoice, CONSENT_COOKIE } from '../../../packages/shared/src/privacy';
import { unavailableBundles } from '../../../packages/shared/src/featured';
import { searchPageFixture } from '../../fixtures/search';
import type { CartItem, Plan } from '../../../packages/shared/src/index';

export const plan: Plan = {
  id: 'esim-cypress-europe',
  name: 'Europe browser fixture',
  countries: ['FR', 'CH', 'IT'],
  dataGb: 5,
  days: 30,
  priceCents: 1200,
  currency: 'USD',
  dataType: 'fixed',
  activation: 'Test fixture only.',
  networks: [],
  fairUse: 'Fixed data fixture.',
  demo: false,
  syncedAt: new Date().toISOString(),
};
export const localPlan: Plan = {
  ...plan,
  id: 'esim-cypress-france',
  name: 'France browser fixture',
  countries: ['FR'],
  priceCents: 500,
};
export const orderId = 'purchase_' + 'c'.repeat(48);

export function mockCommerce() {
  cy.setCookie(CONSENT_COOKIE, encodeURIComponent(JSON.stringify(privacyChoice(false))));
  cy.intercept('http://127.0.0.1:8189/**', (req) => {
    const url = new URL(req.url);
    const headers = {
      'access-control-allow-origin': 'http://localhost:3100',
      'access-control-allow-headers': 'content-type,authorization,x-order-access',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    };
    if (req.method === 'OPTIONS') {
      req.reply({ statusCode: 204, headers });
      return;
    }
    let body: unknown;
    if (url.pathname === '/v1/config')
      body = {
        paymentMode: 'test',
        cartCheckoutMode: 'test',
        supportedCurrencies: ['USD', 'GBP', 'EUR'],
      };
    else if (url.pathname === '/v1/featured-bundles') body = { bundles: unavailableBundles() };
    else if (url.pathname === '/v1/countries')
      body = {
        countries: [
          { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
          { code: 'CH', name: 'Switzerland', flag: '🇨🇭', region: 'Europe' },
          { code: 'IT', name: 'Italy', flag: '🇮🇹', region: 'Europe' },
        ],
      };
    else if (url.pathname === '/v2/search/plans') {
      req.alias = 'matches';
      const countries = (url.searchParams.get('countries') || '').split(',');
      body = searchPageFixture(
        [plan, localPlan].filter((p) => countries.every((c) => p.countries.includes(c))),
      );
    } else if (url.pathname.startsWith('/v1/packages/'))
      body = { plan: url.pathname.endsWith(localPlan.id) ? localPlan : plan };
    else if (url.pathname === '/v2/quote' || url.pathname === '/v2/checkout') {
      const items = (req.body.items as CartItem[]).map((item) => ({
        plan: item.planId === localPlan.id ? localPlan : plan,
        quantity: item.quantity,
      }));
      const total = items.reduce((sum, i) => sum + i.plan.priceCents * i.quantity, 0);
      const quote = {
        items,
        currency: 'USD',
        subtotalCents: total,
        taxCents: 0,
        totalCents: total,
      };
      if (url.pathname === '/v2/checkout') {
        req.alias = 'checkout';
        body = {
          orderId,
          accessToken: 'private-cypress-fixture',
          clientSecret: 'pi_fixture_secret',
          quote,
          paymentMode: 'test',
        };
      } else body = { quote };
    } else if (url.pathname.startsWith('/v2/orders/')) {
      body = {
        id: orderId,
        email: 'guest@example.com',
        items: [{ plan, quantity: 1 }],
        totalCents: 1200,
        currency: 'USD',
        status: 'paid',
        test: true,
        createdAt: new Date().toISOString(),
        allocations: [{ id: 'order_' + 'd'.repeat(48), plan, status: 'paid' }],
      };
    } else throw new Error('Unmocked commerce request: ' + req.method + ' ' + url.pathname);
    req.reply({ statusCode: 200, headers, body });
  });
}

export function button(label: string | RegExp) {
  return cy.contains('button', label);
}
export function selectCountry(name: string) {
  cy.contains('button', /Choose destination|Change destination|Add stop|Add destination/).click();
  cy.get('input[aria-label="Search countries"]').type(name);
  cy.contains('button', name).click();
}
export function openGuestPayment() {
  // Called after registering a Stripe window stub in each test.
  cy.visit('/plans/' + plan.id);
  button('Add to cart').click();
  cy.get('a[aria-label="Shopping cart, 1 item"]').should('be.visible');
  cy.visit('/checkout');
  cy.contains('label', 'Email address').find('input').type('guest@example.com');
  cy.contains('label', 'Confirm email address').find('input').type('wrong@example.com');
  cy.get('input[type="checkbox"]').check();
  button('Continue to payment').click();
  cy.contains('[role="alert"]', 'Email addresses do not match.').should('be.visible');
  cy.contains('label', 'Confirm email address').find('input').clear().type('guest@example.com');
  button('Continue to payment').click();
  cy.wait('@checkout');
}
