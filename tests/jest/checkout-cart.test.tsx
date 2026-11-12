import { useEffect } from 'react';
import { test, expect, jest, afterEach } from '@jest/globals';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore, restoreCart, cartSyncFailure } from '../../apps/web/src/lib/store';
import { demoPlans } from '../../packages/shared/src/demo';

const plan = { ...demoPlans[0], id: 'reviewed-cart-plan', demo: false, priceCents: 1200 };
const quote = {
  items: [{ plan, quantity: 1 }],
  subtotalCents: 1200,
  taxCents: 0,
  totalCents: 1200,
  currency: 'USD',
};
const mockLock = jest.fn();
const mockCheckout = jest.fn(() => ({
  clientSecret: 'pi_fixture_secret',
  orderId: 'purchase_fixture',
  accessToken: 'fixture',
  quote,
}));
jest.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
jest.mock('@/components/currency-provider', () => ({
  useCurrency: () => ({ currency: 'USD', ready: true, refresh: 0, lock: mockLock }),
}));
jest.mock('@/components/stripe-checkout', () => ({ stripeCheckoutMode: 'test' }));
jest.mock('@/lib/firebase', () => ({ firebaseConfigured: false }));
jest.mock('@/lib/checkout-account', () => ({ checkoutAccountActions: {} }));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => {} }),
}));
jest.mock('@stripe/stripe-js/pure', () => ({ loadStripe: async () => ({}) }));
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  PaymentElement: ({ onReady }: { onReady: () => void }) => {
    useEffect(onReady, [onReady]);
    return <div>Card details</div>;
  },
  ExpressCheckoutElement: () => null,
  useStripe: () => ({}),
  useElements: () => ({}),
}));
jest.mock('@/lib/api', () => ({
  api: async (path: string) =>
    path === '/v1/config'
      ? { cartCheckoutMode: 'test' }
      : path === '/v2/quote'
        ? { quote }
        : mockCheckout(),
}));
const { Checkout } = jest.requireActual<typeof import('../../apps/web/src/components/checkout')>(
  '../../apps/web/src/components/checkout',
);
afterEach(cleanup);

test('account/cart changes after payment preparation cannot double the reviewed payment summary', async () => {
  const store = makeStore();
  store.dispatch(restoreCart(quote.items));
  const view = render(
    <Provider store={store}>
      <Checkout />
    </Provider>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
    target: { value: 'buyer@example.test' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  const button = await screen.findByRole('button', { name: 'Continue to payment' });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  fireEvent.submit(button.closest('form')!);
  await screen.findByText('Card details');
  await act(async () => {
    store.dispatch(restoreCart([{ plan, quantity: 2 }]));
  });
  expect(view.container.querySelector('.commerce-total')?.textContent).toContain('$12.00');
  expect(view.container.querySelector('.summary-line')?.textContent).toContain('Qty 1');
  expect(screen.getByRole('button', { name: 'Pay $12.00' })).toBeTruthy();
});

test('an unresolved account cart sync failure blocks payment creation even on forced form submission', async () => {
  const store = makeStore();
  store.dispatch(restoreCart(quote.items));
  render(
    <Provider store={store}>
      <Checkout />
    </Provider>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
    target: { value: 'buyer@example.test' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  const button = await screen.findByRole('button', { name: 'Continue to payment' });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  await act(async () => {
    store.dispatch(cartSyncFailure('Account cart could not be synced.'));
  });
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.submit(button.closest('form')!);
  expect(mockCheckout).not.toHaveBeenCalled();
  expect(screen.queryByText('Card details')).toBeNull();
});
