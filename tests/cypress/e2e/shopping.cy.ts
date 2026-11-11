import type { Interception } from 'cypress/types/net-stubbing';
import type { Plan } from '../../../packages/shared/src/index';
import { searchPageFixture } from '../../fixtures/search';
import {
  button,
  localPlan,
  mockCommerce,
  openGuestPayment,
  plan,
  selectCountry,
} from '../support/commerce';
import { installStripeStub } from '../support/stripe';

describe('destination search', () => {
  beforeEach(mockCommerce);
  it('requires an explicit single destination and preserves complete trip coverage across navigation', () => {
    cy.visit('/');
    selectCountry('France');
    button('Single destination').should('have.class', 'active');
    button('Multi-country trip').click();
    button('Multi-country trip').should('have.class', 'active');
    selectCountry('Switzerland');
    selectCountry('Italy');
    button('Multi-country trip').should('have.class', 'active');
    button('Find my eSIM').click();
    cy.wait('@matches').its('request.url').should('include', 'FR');
    cy.contains('1 plan. Every stop covered.').should('be.visible');
    cy.contains(localPlan.name).should('not.exist');
    button('Single destination').click();
    button('Single destination').should('have.class', 'active');
    cy.contains('Choose one country for a single-destination').should('be.visible');
    cy.get('input[aria-label="Search countries"]').type('France');
    cy.contains('button', '🇫🇷 France').click();
    button('Single destination').should('have.class', 'active');
    button('Multi-country trip').click();
    cy.get('button[aria-label="Remove Italy"]').should('be.visible');
    cy.reload();
    cy.get('button[aria-label="Remove Switzerland"]').should('be.visible');
    cy.get('button[aria-label="Remove Italy"]').click().should('not.exist');
    cy.go('back');
    cy.get('button[aria-label="Remove Italy"]').should('be.visible');
    cy.go('forward');
    cy.get('button[aria-label="Remove Italy"]').should('not.exist');
  });
});

describe('cart', () => {
  beforeEach(mockCommerce);
  it('persists quantities, recalculates totals, supports mobile widths and removes all items', () => {
    cy.visit('/plans/' + plan.id);
    button('Add to cart').click().click();
    cy.visit('/plans/' + localPlan.id);
    button('Add to cart').click();
    cy.get('a[aria-label="Shopping cart, 3 items"]').click();
    cy.location('pathname').should('eq', '/cart');
    cy.contains('h1', 'Your cart').should('be.visible');
    cy.reload();
    cy.get('a[aria-label="Shopping cart, 3 items"]').should('be.visible');
    cy.get(`button[aria-label="Increase quantity for ${plan.name}"]`).click();
    cy.get('a[aria-label="Shopping cart, 4 items"]').should('be.visible');
    cy.contains('$41.00').should('be.visible');
    cy.get(`button[aria-label="Decrease quantity for ${plan.name}"]`).click();
    cy.get(`button[aria-label="Remove ${localPlan.name}"]`).click();
    cy.get('a[aria-label="Shopping cart, 2 items"]').should('be.visible');
    for (const width of [375, 390, 768]) {
      cy.viewport(width, 900);
      cy.contains('a', 'Secure checkout').should('be.visible');
      cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
    }
    cy.get(`button[aria-label="Remove ${plan.name}"]`).click();
    cy.contains('h1', 'Your cart is empty').should('be.visible');
    cy.contains('a', 'Explore destinations').should('be.visible');
  });
});

for (const wallet of ['Apple Pay', 'Google Pay']) {
  describe(`${wallet} checkout contract`, () => {
    beforeEach(() => {
      mockCommerce();
      cy.on('window:before:load', (win) => installStripeStub(win, true));
    });
    it('validates guest email and retries a decline without creating another order', () => {
      openGuestPayment();
      button('Apple Pay').should('be.visible');
      button('Google Pay').should('be.visible');
      button('Pay securely').click();
      cy.contains('[role="alert"]', 'Your card was declined.').should('be.visible');
      button(wallet).click();
      cy.contains('h1', 'Your test order').should('be.visible');
      cy.get('@checkout.all').should('have.length', 1);
      cy.get('a[aria-label="Shopping cart, 0 items"]').should('be.visible');
    });
  });
}

describe('card fallback', () => {
  beforeEach(() => {
    mockCommerce();
    cy.on('window:before:load', (win) => installStripeStub(win, false));
  });
  it('hides unsupported wallets and keeps a usable mobile card checkout', () => {
    openGuestPayment();
    cy.contains('button', 'Apple Pay').should('not.exist');
    cy.contains('button', 'Google Pay').should('not.exist');
    cy.get('input[aria-label="Card number"]').should('be.visible');
    button('Pay securely').should('be.enabled');
    for (const width of [375, 390, 768]) {
      cy.viewport(width, 900);
      cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
    }
  });
});

describe('data allowance filters', () => {
  beforeEach(mockCommerce);
  it('filters 50 GB and unlimited plans, refreshes results and restores the allowance from the URL', () => {
    const fifty = { ...plan, id: 'fifty-gb', name: 'Europe 50 GB fixture', dataGb: 50 };
    const daily = {
      ...plan,
      id: 'daily-unlimited',
      name: 'Europe daily fixture',
      dataGb: 2,
      dataType: 'daily' as const,
      dailyPolicy: 'reduced' as const,
      fairUse: '2 GB high-speed per day, then 384 Kbps.',
    };
    cy.intercept('GET', 'http://127.0.0.1:8189/v2/search/plans*', (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get('countries')).to.eq('FR,CH,IT');
      const unlimited = url.searchParams.get('dataType') === 'unlimited';
      if (!unlimited) expect(url.searchParams.get('minGb')).to.eq('50');
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: searchPageFixture(unlimited ? [daily] : [fifty]),
      });
    }).as('dataFilter');
    cy.visit('/?mode=trip&countries=FR,CH,IT');
    cy.contains('label', 'DATA ALLOWANCE').find('select').select('50');
    button('Find my eSIM').click();
    cy.wait('@dataFilter');
    cy.contains('h3', fifty.name).should('be.visible');
    cy.contains('label', 'DATA ALLOWANCE').find('select').select('unlimited');
    cy.wait('@dataFilter');
    cy.contains('h3', fifty.name).should('not.exist');
    cy.contains('Unlimited · 2 GB/day high-speed').should('be.visible');
    cy.contains('2 GB high-speed per day, then 384 Kbps.').should('be.visible');
    cy.viewport(375, 900);
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(375));
    cy.screenshot('unlimited-filter-mobile');
    cy.reload();
    cy.contains('label', 'DATA ALLOWANCE').find('select').should('have.value', 'unlimited');
    button('Find my eSIM').click();
    cy.wait('@dataFilter');
    cy.contains('h3', daily.name).should('be.visible');
  });
});

describe('allowance request ordering', () => {
  beforeEach(mockCommerce);
  it('does not let a slow 50 GB response overwrite a newer unlimited selection', () => {
    cy.intercept('GET', 'http://127.0.0.1:8189/v2/search/plans*', (req) => {
      const unlimited = new URL(req.url).searchParams.get('dataType') === 'unlimited';
      req.alias = unlimited ? 'newUnlimited' : 'oldFifty';
      req.reply({
        delay: unlimited ? 0 : 800,
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: searchPageFixture([
          {
            ...plan,
            id: unlimited ? 'new' : 'old',
            name: unlimited ? 'Latest unlimited result' : 'Stale 50 GB result',
            dataGb: unlimited ? 2 : 50,
            dataType: unlimited ? 'daily' : 'fixed',
            ...(unlimited ? { dailyPolicy: 'reduced' } : {}),
          },
        ]),
      });
    });
    cy.visit('/?mode=trip&countries=FR,CH,IT');
    cy.contains('label', 'DATA ALLOWANCE').find('select').select('50');
    button('Find my eSIM').click();
    cy.contains('label', 'DATA ALLOWANCE').find('select').select('unlimited');
    cy.wait('@newUnlimited');
    cy.wait('@oldFifty');
    cy.contains('h3', 'Latest unlimited result').should('be.visible');
    cy.contains('h3', 'Stale 50 GB result').should('not.exist');
  });
});

describe('single-country plans', () => {
  beforeEach(mockCommerce);
  it('shows local plans first and includes regional bundles only when requested', () => {
    cy.intercept('GET', 'http://127.0.0.1:8189/v2/search/plans*', (req) => {
      const localOnly = new URL(req.url).searchParams.get('coverage') === 'local';
      req.alias = localOnly ? 'localOnly' : 'includeRegions';
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: searchPageFixture(localOnly ? [localPlan] : [localPlan, plan]),
      });
    });
    cy.visit('/');
    button('Multi-country trip').click();
    button('Multi-country trip').should('have.class', 'active');
    button('Single destination').click();
    button('Single destination').should('have.class', 'active');
    selectCountry('France');
    button('Find my eSIM').click();
    cy.wait('@localOnly');
    cy.contains('h3', localPlan.name).should('be.visible');
    cy.contains('h3', plan.name).should('not.exist');
    cy.contains('label', 'Include regional and global plans').find('input').check();
    cy.wait('@includeRegions');
    cy.contains('h3', plan.name).should('be.visible');
    cy.contains('Multi-country coverage').should('be.visible');
  });
});

describe('paged and accessible search', () => {
  beforeEach(mockCommerce);
  const rows = Array.from({ length: 25 }, (_, i) => ({
    ...plan,
    id: 'paged-' + i,
    name: 'Paged plan ' + i,
    dataGb: i === 24 ? 50 : 5,
    priceCents: 100 + i,
  }));
  it('loads every page once and keeps server sort, facets and total counts', () => {
    cy.intercept('GET', 'http://127.0.0.1:8189/v2/search/plans*', (req) => {
      const q = new URL(req.url).searchParams,
        cursor = q.get('cursor');
      expect(q.get('pageSize')).to.eq('12');
      const offset = cursor === 'page2' ? 12 : cursor === 'page3' ? 24 : 0;
      req.alias = 'pagedSearch';
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: searchPageFixture(rows.slice(offset, offset + 12), {
          total: 25,
          nextCursor: offset === 0 ? 'page2' : offset === 12 ? 'page3' : null,
          facets: searchPageFixture(rows).facets,
        }),
      });
    });
    cy.visit('/?mode=trip&countries=FR,CH,IT');
    button('Find my eSIM').click();
    cy.wait('@pagedSearch');
    cy.get('.plan-card').should('have.length', 12);
    cy.contains('Showing 12 of 25 matching plans').should('be.visible');
    cy.contains('label', 'DATA ALLOWANCE').find('option[value="50"]').should('contain', '(1)');
    button('Show more plans').click();
    cy.wait('@pagedSearch');
    cy.get('.plan-card').should('have.length', 24);
    button('Show more plans').click();
    cy.wait('@pagedSearch');
    cy.get('.plan-card').should('have.length', 25);
    cy.contains('button', 'Show more plans').should('not.exist');
    cy.get('.plan-card h3').then((headings) =>
      expect(new Set([...headings].map((h) => h.textContent)).size).to.eq(25),
    );
  });
  it('requires a fresh search after a catalogue revision changes instead of mixing pages', () => {
    let refreshed = false;
    cy.intercept('GET', 'http://127.0.0.1:8189/v2/search/plans*', (req) => {
      const q = new URL(req.url).searchParams;
      req.alias = 'revisionSearch';
      if (q.has('cursor')) {
        refreshed = true;
        req.reply({
          statusCode: 409,
          headers: { 'access-control-allow-origin': 'http://localhost:3100' },
          body: { error: 'The catalogue changed. Refresh your search.' },
        });
        return;
      }
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: searchPageFixture(refreshed ? [rows[24]] : rows.slice(0, 12), {
          total: refreshed ? 1 : 25,
          nextCursor: refreshed ? null : 'stale',
          revision: (refreshed ? '1' : '0').repeat(64),
        }),
      });
    });
    cy.visit('/?mode=trip&countries=FR,CH,IT');
    button('Find my eSIM').click();
    cy.wait('@revisionSearch');
    button('Show more plans').click();
    cy.wait('@revisionSearch');
    cy.contains('[role="alert"]', 'The catalogue changed').should('be.visible');
    cy.get('.plan-card').should('not.exist');
    button('Refresh results').click();
    cy.wait('@revisionSearch');
    cy.get('.plan-card').should('have.length', 1);
    cy.contains('h3', rows[24].name).should('be.visible');
  });
  it('supports country aliases, keyboard selection and Escape with focus restoration', () => {
    cy.intercept('GET', 'http://127.0.0.1:8189/v1/countries', {
      headers: { 'access-control-allow-origin': 'http://localhost:3100' },
      body: {
        countries: [
          { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe' },
          { code: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮', region: 'Africa' },
        ],
      },
    }).as('aliasCountries');
    cy.visit('/');
    cy.wait('@aliasCountries');
    cy.contains('button', 'Choose destination')
      .click()
      .should('have.attr', 'aria-expanded', 'true');
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('input[aria-label="Search countries"]').type('UK{enter}');
    cy.get('button[aria-label="Remove United Kingdom"]').should('be.visible');
    cy.contains('button', 'Change destination').click();
    cy.get('input[aria-label="Search countries"]').type('ivory coast').type('{downarrow}');
    cy.contains('.country-options button', 'Côte d’Ivoire').should('be.focused').click();
    cy.get('button[aria-label="Remove Côte d’Ivoire"]').should('be.visible');
    cy.contains('button', 'Change destination').click();
    cy.get('input[aria-label="Search countries"]').type('{esc}');
    cy.contains('button', 'Change destination')
      .should('be.focused')
      .and('have.attr', 'aria-expanded', 'false');
  });
});

describe('server-authoritative customer currencies', () => {
  beforeEach(() => {
    mockCommerce();
    cy.on('window:before:load', (win) => installStripeStub(win, false));
  });
  it('reprices search, cart quantities and checkout in GBP/EUR and locks currency during payment', () => {
    cy.viewport(390, 844);
    const displayed = (currency: string): Plan => ({
      ...localPlan,
      currency: currency === 'GBP' ? 'GBP' : currency === 'EUR' ? 'EUR' : 'USD',
      priceCents: currency === 'GBP' ? 999 : currency === 'EUR' ? 1199 : 1500,
    });
    cy.intercept('GET', 'http://127.0.0.1:8189/v2/search/plans*', (req) => {
      const currency = new URL(req.url).searchParams.get('currency') || 'USD';
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: searchPageFixture([displayed(currency)]),
      });
    });
    cy.intercept('GET', 'http://127.0.0.1:8189/v1/packages/' + localPlan.id + '*', (req) => {
      const currency = new URL(req.url).searchParams.get('currency') || 'USD';
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: { plan: displayed(currency) },
      });
    });
    cy.intercept('POST', /http:\/\/127\.0\.0\.1:8189\/v2\/(quote|checkout)$/, (req) => {
      const currency = req.body.currency,
        quantity = req.body.items[0].quantity;
      const p = displayed(currency);
      const quote = {
        items: [{ plan: p, quantity }],
        currency,
        subtotalCents: p.priceCents * quantity,
        taxCents: 0,
        totalCents: p.priceCents * quantity,
      };
      const checkout = req.url.endsWith('/checkout');
      if (checkout) {
        req.alias = 'currencyCheckout';
        expect(req.body.expectedTotalCents).to.eq(2398);
        expect(currency).to.eq('EUR');
      }
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: checkout
          ? {
              orderId: 'purchase_' + 'c'.repeat(48),
              accessToken: 'private-currency-test',
              clientSecret: 'pi_currency_secret',
              paymentMode: 'test',
              quote,
            }
          : { quote },
      });
    });
    cy.visit('/?mode=country&countries=FR');
    button('Find my eSIM').click();
    cy.get('select[aria-label="Currency"]').select('GBP');
    cy.get('.plan-card strong').should('contain', '£9.99');
    cy.get('.plan-card a').click();
    button('Add to cart').click();
    cy.visit('/cart');
    cy.get('.commerce-total').should('contain', 'GBP').and('contain', '£9.99');
    cy.get('select[aria-label="Currency"]').select('EUR');
    cy.get('.commerce-total').should('contain', 'EUR').and('contain', '€11.99');
    cy.get('button[aria-label^="Increase quantity"]').click();
    cy.get('.commerce-total').should('contain', '€23.98');
    cy.contains('a', 'Secure checkout').click();
    cy.contains('label', 'Email address').find('input').type('currency@example.com');
    cy.contains('label', 'Confirm email address').find('input').type('currency@example.com');
    cy.get('input[type="checkbox"]').check();
    button('Continue to payment').click();
    cy.wait('@currencyCheckout');
    cy.get('select[aria-label="Currency"]').should('be.disabled').and('have.value', 'EUR');
    button('Pay securely').should('be.visible');
    cy.screenshot('currency-eur-checkout-mobile', { capture: 'fullPage' });
  });
});

describe('currency-specific checkout idempotency', () => {
  beforeEach(() => {
    mockCommerce();
    cy.on('window:before:load', (win) => installStripeStub(win, false));
  });
  it('uses a new checkout attempt when currencies round to the same numeric total', () => {
    cy.intercept('POST', /http:\/\/127\.0\.0\.1:8189\/v2\/(quote|checkout)$/, (req) => {
      const currency = req.body.currency;
      const p = { ...localPlan, currency, priceCents: 500 };
      const quote = {
        items: [{ plan: p, quantity: 1 }],
        currency,
        subtotalCents: 500,
        taxCents: 0,
        totalCents: 500,
      };
      const checkout = req.url.endsWith('/checkout');
      if (checkout) req.alias = 'sameAmountCheckout';
      req.reply({
        headers: { 'access-control-allow-origin': 'http://localhost:3100' },
        body: checkout
          ? {
              orderId: 'purchase_' + 'c'.repeat(48),
              accessToken: 'private-currency-test',
              clientSecret: 'pi_same_amount_secret',
              paymentMode: 'test',
              quote,
            }
          : { quote },
      });
    });
    const start = () => {
      cy.contains('label', 'Email address').find('input').type('currency@example.com');
      cy.contains('label', 'Confirm email address').find('input').type('currency@example.com');
      cy.get('input[type="checkbox"]').check();
      button('Continue to payment').click();
      cy.wait('@sameAmountCheckout');
      button('Pay securely').should('be.visible');
    };
    cy.visit('/plans/' + localPlan.id);
    button('Add to cart').click();
    cy.visit('/checkout');
    start();
    cy.visit('/cart');
    cy.get('select[aria-label="Currency"]').select('EUR');
    cy.get('.commerce-total').should('contain', 'EUR');
    cy.contains('a', 'Secure checkout').click();
    start();
    cy.get<Interception[]>('@sameAmountCheckout.all').then((requests) => {
      expect(requests).to.have.length(2);
      const [first, second] = requests;
      expect(first.request.body.currency).to.eq('USD');
      expect(second.request.body.currency).to.eq('EUR');
      expect(first.request.body.requestId).not.to.eq(second.request.body.requestId);
    });
  });
});
