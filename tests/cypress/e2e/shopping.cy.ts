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
    selectCountry('Switzerland');
    selectCountry('Italy');
    button('Multi-country trip').should('have.class', 'active');
    button('Find my eSIM').click();
    cy.wait('@matches').its('request.url').should('include', 'FR');
    cy.contains('1 plans. Every stop covered.').should('be.visible');
    cy.contains(localPlan.name).should('not.exist');
    button('Single destination').click();
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
