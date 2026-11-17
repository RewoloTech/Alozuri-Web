import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Locale } from '../../packages/shared/src/i18n/locales';
import type { Messages } from '../../packages/shared/src/i18n/messages';
import { LOCALE_COOKIE, LOCALE_EXPLICIT_COOKIE } from '../../packages/shared/src/i18n/locales';

let mockPath = '/';
let mockAuth: {
  user: { uid: string } | null;
  profile: { locale: Locale } | null;
  loading: boolean;
  profileLoading: boolean;
} = { user: null, profile: null, loading: false, profileLoading: false };
const mockRefreshProfile = jest.fn();
const mockReplace = jest.fn<(url: string, options?: { scroll?: boolean }) => void>();
const mockRouter = { replace: mockReplace };
const mockApi = jest.fn<(path: string, init: RequestInit, uid: string) => Promise<unknown>>();
let mockJapaneseLoad: Promise<Messages> | undefined;
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => mockRouter,
}));
jest.mock('../../apps/web/src/components/auth-provider', () => ({
  useAuth: () => ({ ...mockAuth, refreshProfile: mockRefreshProfile }),
}));
jest.mock('@/lib/api', () => ({ api: (...args: Parameters<typeof mockApi>) => mockApi(...args) }));
jest.mock('@alozuri/shared/i18n/catalogs', () => {
  const actual = jest.requireActual<typeof import('../../packages/shared/src/i18n/catalogs')>(
    '../../packages/shared/src/i18n/catalogs',
  );
  return {
    loadMessages: (locale: Locale) =>
      locale === 'ja' && mockJapaneseLoad ? mockJapaneseLoad : actual.loadMessages(locale),
  };
});
const { LanguageProvider, useLanguage } = jest.requireActual<
  typeof import('../../apps/web/src/components/language-provider')
>('../../apps/web/src/components/language-provider');
const { loadMessages } = jest.requireActual<
  typeof import('../../packages/shared/src/i18n/catalogs')
>('../../packages/shared/src/i18n/catalogs');
function Consumer() {
  const { locale, changeLanguage, prepareNavigation, error } = useLanguage();
  return (
    <>
      <output data-testid="locale">{locale}</output>
      <output data-testid="error">{error}</output>
      <button onClick={() => prepareNavigation('/cart', '/de/cart')}>Navigate to cart</button>
      {(['en', 'fr', 'ja'] as const).map((value) => (
        <button key={value} onClick={() => void changeLanguage(value)}>
          {value}
        </button>
      ))}
    </>
  );
}
const tree = () => (
  <LanguageProvider>
    <Consumer />
  </LanguageProvider>
);
function path(value: string) {
  mockPath = value;
  window.history.replaceState(null, '', value);
}
beforeEach(() => {
  for (const name of [LOCALE_COOKIE, LOCALE_EXPLICIT_COOKIE])
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  path('/');
  mockAuth = { user: null, profile: null, loading: false, profileLoading: false };
  mockJapaneseLoad = undefined;
  mockReplace.mockReset();
  mockApi.mockReset().mockResolvedValue({});
  mockRefreshProfile.mockReset();
  Object.defineProperty(navigator, 'languages', { configurable: true, value: ['de-DE'] });
});
afterEach(cleanup);

test('automatic detection yields to an account; manual English survives login, logout and remount', async () => {
  let view = render(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('de'));
  expect(document.cookie).toContain(`${LOCALE_EXPLICIT_COOKIE}=0`);
  path('/de');
  mockAuth = { ...mockAuth, user: { uid: 'customer' }, profile: { locale: 'fr' } };
  view.rerender(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('fr'));
  path('/fr');
  view.rerender(tree());
  fireEvent.click(screen.getByRole('button', { name: 'en' }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith(
      '/v2/profile/language',
      { method: 'PATCH', body: '{"locale":"en"}' },
      'customer',
    ),
  );
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'));
  expect(document.cookie).toContain(`${LOCALE_EXPLICIT_COOKIE}=1`);
  path('/');
  mockAuth = { ...mockAuth, user: null, profile: null };
  view.rerender(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'));
  mockAuth = { ...mockAuth, user: { uid: 'customer' }, profile: { locale: 'de' } };
  view.rerender(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'));
  view.unmount();
  view = render(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'));
  expect(mockReplace.mock.calls.at(-1)?.[0]).toBe('/');
});

test('manual choice during dictionary loading cannot be cancelled by a later account response', async () => {
  const japanese = await loadMessages('ja');
  let release!: (value: Messages) => void;
  mockJapaneseLoad = new Promise((resolve) => {
    release = resolve;
  });
  const view = render(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('de'));
  path('/de');
  view.rerender(tree());
  fireEvent.click(screen.getByRole('button', { name: 'ja' }));
  mockAuth = { ...mockAuth, user: { uid: 'customer' }, profile: { locale: 'fr' } };
  view.rerender(tree());
  await act(async () => {
    release(japanese);
  });
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('ja'));
  expect(document.cookie).toContain(`${LOCALE_COOKIE}=ja`);
  expect(document.cookie).toContain(`${LOCALE_EXPLICIT_COOKIE}=1`);
});

test('fresh localized links, English aliases and history navigation override the previous choice', async () => {
  document.cookie = `${LOCALE_COOKIE}=en; Path=/`;
  document.cookie = `${LOCALE_EXPLICIT_COOKIE}=1; Path=/`;
  const view = render(tree());
  await waitFor(() => expect(document.documentElement.lang).toBe('en-GB'));
  path('/fr/help');
  view.rerender(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('fr'));
  expect(document.cookie).toContain(`${LOCALE_COOKIE}=fr`);
  // /en/help is canonicalized server-side to /help with explicit English cookies.
  document.cookie = `${LOCALE_COOKIE}=en; Path=/`;
  document.cookie = `${LOCALE_EXPLICIT_COOKIE}=1; Path=/`;
  path('/help');
  view.rerender(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'));
  path('/fr/help');
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  view.rerender(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('fr'));
});

test('the last manual selection wins even when an earlier catalogue resolves later', async () => {
  const japanese = await loadMessages('ja');
  let release!: (value: Messages) => void;
  mockJapaneseLoad = new Promise((resolve) => {
    release = resolve;
  });
  render(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('de'));
  fireEvent.click(screen.getByRole('button', { name: 'ja' }));
  fireEvent.click(screen.getByRole('button', { name: 'en' }));
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'));
  await act(async () => {
    release(japanese);
  });
  expect(screen.getByTestId('locale').textContent).toBe('en');
  expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
});

test('a saved language applies to an in-flight login destination without reopening the login page', async () => {
  path('/login');
  const view = render(tree());
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('de'));
  path('/de/login');
  view.rerender(tree());
  fireEvent.click(screen.getByRole('button', { name: 'Navigate to cart' }));
  mockAuth = { ...mockAuth, user: { uid: 'customer' }, profile: { locale: 'fr' } };
  view.rerender(tree());
  await waitFor(() => expect(mockReplace).toHaveBeenLastCalledWith('/fr/cart', { scroll: false }));
  path('/fr/cart');
  view.rerender(tree());
  await act(async () => {});
  expect(document.cookie).toContain(`${LOCALE_EXPLICIT_COOKIE}=0`);
  const calls = mockReplace.mock.calls.length;
  path('/fr/help');
  view.rerender(tree());
  await act(async () => {});
  expect(mockReplace.mock.calls).toHaveLength(calls);
  expect(screen.getByTestId('locale').textContent).toBe('fr');
});
