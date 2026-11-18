import { test, expect, jest, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
const mockApi = jest.fn<(path: string, init: RequestInit) => Promise<unknown>>();
const mockPush = jest.fn();
jest.mock('@/lib/api', () => ({ api: (path: string, init: RequestInit) => mockApi(path, init) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next-intl', () => ({ useLocale: () => 'en' }));
jest.mock('@/components/currency-provider', () => ({ useCurrency: () => ({ currency: 'USD' }) }));
const { BuyAgain } = jest.requireActual<typeof import('../../apps/web/src/components/buy-again')>(
  '../../apps/web/src/components/buy-again',
);
afterEach(() => {
  cleanup();
  mockApi.mockReset();
  mockPush.mockReset();
});
const profile = {
  id: 'owned-profile',
  maskedIccid: '•••• 3019',
  expiresAt: '2030-01-01',
  purchasedAt: '2026-01-01',
  packageName: 'France',
};
for (const count of [0, 1, 2])
  test(`Buy Again handles ${count} eligible profiles and prepares existing checkout`, async () => {
    mockApi.mockResolvedValueOnce({
      profiles: Array.from({ length: count }, (_, i) => ({ ...profile, id: profile.id + i })),
    });
    mockApi.mockResolvedValueOnce({ id: 'quote', productId: 'product' });
    render(<BuyAgain orderId="source" />);
    fireEvent.click(screen.getByRole('button', { name: 'Buy Again' }));
    const next = await screen.findByRole('button', { name: 'Continue to checkout' });
    if (count === 2) {
      expect(next.hasAttribute('disabled')).toBe(true);
      fireEvent.click(screen.getAllByRole('radio')[0]);
    }
    await waitFor(() => expect(next.hasAttribute('disabled')).toBe(false));
    fireEvent.click(next);
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/checkout?buy=product&repeatQuote=quote'),
    );
    const payload = JSON.parse(String(mockApi.mock.calls[1][1].body));
    expect(payload.profileOrderId).toBe(count ? 'owned-profile0' : undefined);
  });
test('supplier availability errors remain retryable without starting payment', async () => {
  mockApi.mockRejectedValue(new Error('Synthetic provider failure'));
  render(<BuyAgain orderId="source" />);
  fireEvent.click(screen.getByRole('button', { name: 'Buy Again' }));
  await screen.findByRole('alert');
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Buy Again' }).hasAttribute('disabled')).toBe(false);
});
