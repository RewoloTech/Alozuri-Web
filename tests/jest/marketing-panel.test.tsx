import { test, expect, jest, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
const mockApi = jest.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
jest.mock('@/lib/api', () => ({
  apiBlob: () => Promise.reject(new Error('Controlled unavailable preview')),
  api: (path: string, init?: RequestInit) => mockApi(path, init),
}));
jest.mock('@/components/promotions', () => ({
  PromotionsPanel: () => <div>Existing discount editor</div>,
}));
const { MarketingPanel } = jest.requireActual<
  typeof import('../../apps/web/src/components/marketing-panel')
>('../../apps/web/src/components/marketing-panel');
const empty = {
  campaigns: [],
  banners: [],
  promotions: [],
  overview: {
    marginWarnings: 0,
    activePromotions: 0,
    scheduledPromotions: 0,
    announcements: 0,
    homepageBanners: 0,
    upcomingExpirations: [],
  },
  performance: { since: new Date().toISOString(), truncated: false, excludedRecords: 0, rows: [] },
};
afterEach(() => {
  cleanup();
  mockApi.mockReset();
});
function setup() {
  mockApi.mockImplementation(async (path, init) => (init?.method ? { saved: true } : empty));
  render(<MarketingPanel uid="owner" />);
}
test('existing editor remains the default and campaigns save UTC schedules through Operations', async () => {
  setup();
  expect(screen.getByText('Existing discount editor')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Campaign Management' }));
  fireEvent.change(screen.getByLabelText('Campaign ID'), { target: { value: 'summer' } });
  fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'Summer' } });
  fireEvent.click(screen.getByLabelText('Active (subject to schedule)'));
  fireEvent.click(screen.getByRole('button', { name: 'Save campaign' }));
  await waitFor(() =>
    expect(
      mockApi.mock.calls.some(([p, i]) => p.endsWith('/campaigns') && i?.method === 'PUT'),
    ).toBe(true),
  );
  const call = mockApi.mock.calls.find(
    ([p, i]) => p.endsWith('/campaigns') && i?.method === 'PUT',
  )!;
  const body = JSON.parse(String(call[1]?.body));
  expect(body.active).toBe(true);
  expect(body.startsAt.endsWith('Z')).toBe(true);
});
test('banner editor stores translated copy, CTA and separate desktop/mobile image uploads', async () => {
  setup();
  await screen.findByText('Active promotions');
  fireEvent.click(screen.getByRole('button', { name: 'Website Banners' }));
  fireEvent.change(screen.getByLabelText('Banner ID'), { target: { value: 'home' } });
  fireEvent.change(screen.getByLabelText('Internal name'), { target: { value: 'Home' } });
  fireEvent.change(screen.getByLabelText('Placement'), { target: { value: 'homepage' } });
  fireEvent.change(screen.getByLabelText('Heading / announcement message'), {
    target: { value: 'Travel offers' },
  });
  fireEvent.change(screen.getByLabelText('CTA label'), { target: { value: 'Explore' } });
  fireEvent.change(screen.getByLabelText('CTA destination URL'), {
    target: { value: '/destinations' },
  });
  mockApi.mockImplementation(async (path, init) =>
    path.endsWith('/images')
      ? { path: '/v1/marketing/images/fixture' }
      : init?.method
        ? { saved: true }
        : empty,
  );
  for (const label of ['Desktop image', 'Mobile image']) {
    fireEvent.change(screen.getByLabelText(label, { exact: true }), {
      target: { files: [new File(['fixture'], 'test.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect((screen.getByLabelText(label + ' URL') as HTMLInputElement).value).toContain(
        '/api/store/v1/marketing/images/fixture',
      ),
    );
  }
  fireEvent.change(screen.getByLabelText('Content language'), { target: { value: 'ro' } });
  fireEvent.change(screen.getByLabelText('Heading / announcement message'), {
    target: { value: 'Oferte' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save banner' }));
  await waitFor(() =>
    expect(mockApi.mock.calls.some(([p, i]) => p.endsWith('/banners') && i?.method === 'PUT')).toBe(
      true,
    ),
  );
  const call = mockApi.mock.calls.find(([p, i]) => p.endsWith('/banners') && i?.method === 'PUT')!;
  const body = JSON.parse(String(call[1]?.body));
  expect(body.translations.ro.heading).toBe('Oferte');
  expect(body.translations.en.heading).toBe('Travel offers');
  expect(body.mobileImage).toContain('/api/store');
  expect(body.desktopImage).toContain('/api/store');
});
