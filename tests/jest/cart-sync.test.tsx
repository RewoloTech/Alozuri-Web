import { beforeEach, afterEach, describe, test, expect, jest } from '@jest/globals';
import { act, render, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { StrictMode } from 'react';
import { makeStore, addToCart, quantityChanged } from '../../apps/web/src/lib/store';
import { preserveCartEdits } from '../../apps/web/src/lib/cart-sync-state';
import { demoPlans } from '../../packages/shared/src/demo';
import type { CartLine } from '../../packages/shared/src/index';

type Session = { user: { uid: string; emailVerified: boolean } | null; loading: boolean };
let mockSession: Session = { user: null, loading: false };
const mockApi =
  jest.fn<
    (path: string, init?: RequestInit, authenticated?: boolean | string) => Promise<unknown>
  >();
jest.mock('@/components/auth-provider', () => ({ useAuth: () => mockSession }));
jest.mock('@/lib/api', () => ({
  api: (...args: Parameters<typeof mockApi>) => mockApi(...args),
  demoMode: false,
}));
const { CartSync } = jest.requireActual<typeof import('../../apps/web/src/components/cart-sync')>(
  '../../apps/web/src/components/cart-sync',
);
const plan = { ...demoPlans[0], demo: false };
const lines = (quantity: number): CartLine[] => [{ plan, quantity }];
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
beforeEach(() => {
  localStorage.clear();
  mockSession = { user: null, loading: false };
  mockApi.mockReset();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('cart identity changes', () => {
  test('a late merge from an earlier sign-in cannot double the current customer cart', async () => {
    localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
    let resolveOld!: (value: unknown) => void;
    const old = new Promise<unknown>((resolve) => {
      resolveOld = resolve;
    });
    mockApi.mockImplementation(async (path, init) => {
      if (path === '/v2/cart/merge') {
        const input = JSON.parse(String(init?.body));
        return input.items.length ? old : { items: lines(1), version: 3 };
      }
      throw new Error('Unexpected API operation');
    });
    const store = makeStore();
    const view = () => (
      <Provider store={store}>
        <CartSync />
      </Provider>
    );
    const rendered = render(view());
    await flush();
    mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
    rendered.rerender(view());
    await flush();
    expect(mockApi).toHaveBeenCalledTimes(1);
    mockSession = { user: null, loading: false };
    rendered.rerender(view());
    await flush();
    mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
    rendered.rerender(view());
    await flush();
    expect(store.getState().cart.items[0].quantity).toBe(1);
    await act(async () => resolveOld({ items: lines(2), version: 1 }));
    expect(store.getState().cart.items[0].quantity).toBe(1);
    expect(store.getState().cart.version).toBe(3);
  });
  test('signing out during a pending account merge releases the guest cart controls', async () => {
    localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
    mockApi.mockImplementation(() => new Promise(() => {}));
    const store = makeStore();
    const view = () => (
      <Provider store={store}>
        <CartSync />
      </Provider>
    );
    const rendered = render(view());
    await flush();
    mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
    rendered.rerender(view());
    await flush();
    expect(store.getState().cart.syncing).toBe(true);
    mockSession = { user: null, loading: false };
    rendered.rerender(view());
    await flush();
    expect(store.getState().cart.syncing).toBe(false);
  });
  test('Firebase verification on the same User object synchronises once and never adds twice', async () => {
    localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
    const user = { uid: 'alice', emailVerified: false };
    mockSession = { user, loading: false };
    mockApi.mockResolvedValue({ items: lines(1), version: 1 });
    const store = makeStore();
    const view = () => (
      <Provider store={store}>
        <CartSync />
      </Provider>
    );
    const rendered = render(view());
    await flush();
    expect(mockApi).not.toHaveBeenCalled();
    user.emailVerified = true;
    mockSession = { user, loading: false };
    rendered.rerender(view());
    await flush();
    expect(mockApi).toHaveBeenCalledTimes(1);
    rendered.rerender(view());
    await flush();
    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(store.getState().cart.items[0].quantity).toBe(1);
  });
});

test('guest signup in Strict Mode never merges the same guest item twice', async () => {
  localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
  mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
  mockApi.mockResolvedValue({ items: lines(1), version: 1 });
  const store = makeStore();
  const mounted = render(
    <StrictMode>
      <Provider store={store}>
        <CartSync />
      </Provider>
    </StrictMode>,
  );
  await flush();
  mounted.rerender(
    <StrictMode>
      <Provider store={store}>
        <CartSync />
      </Provider>
    </StrictMode>,
  );
  await flush();
  expect(mockApi).toHaveBeenCalledTimes(1);
  expect(store.getState().cart.items).toEqual(lines(1));
});

test('an interrupted merge keeps its request identity and adds only subsequent customer edits', async () => {
  jest.useFakeTimers();
  localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
  mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
  let merges = 0;
  mockApi.mockImplementation(async (path) => {
    if (path === '/v2/cart/merge') {
      if (++merges === 1) throw new Error('Interrupted after server merge');
      return { items: lines(1), version: 1 };
    }
    return { items: lines(2), version: 2 };
  });
  const store = makeStore();
  render(
    <Provider store={store}>
      <CartSync />
    </Provider>,
  );
  await flush();
  expect(store.getState().cart.syncFailed).toBe(true);
  await act(async () => {
    store.dispatch(addToCart(plan));
  });
  await flush();
  expect(store.getState().cart.items).toEqual(lines(2));
  const requests = mockApi.mock.calls
    .filter(([path]) => path === '/v2/cart/merge')
    .map(([, init]) => JSON.parse(String(init?.body)));
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[0].items[0].quantity).toBe(1);
  await act(async () => {
    jest.advanceTimersByTime(701);
  });
  await flush();
  expect(store.getState().cart.syncFailed).toBe(false);
  expect(store.getState().cart.items[0].quantity).toBe(2);
});

test('local edits made during a slow initial merge survive without adding the entire cart again', async () => {
  localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
  mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
  let finish!: (result: unknown) => void;
  mockApi.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const store = makeStore();
  render(
    <Provider store={store}>
      <CartSync />
    </Provider>,
  );
  await flush();
  await act(async () => {
    store.dispatch(addToCart(plan));
  });
  await act(async () => finish({ items: lines(1), version: 1 }));
  expect(store.getState().cart.items[0].quantity).toBe(2);
});

test('serialised saves preserve a newer quantity while an older write is pending', async () => {
  jest.useFakeTimers();
  localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
  mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
  let finish!: (result: unknown) => void;
  mockApi.mockImplementation(async (path) =>
    path === '/v2/cart/merge'
      ? { items: lines(1), version: 1 }
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const store = makeStore();
  render(
    <Provider store={store}>
      <CartSync />
    </Provider>,
  );
  await flush();
  await act(async () => {
    store.dispatch(quantityChanged({ id: plan.id, quantity: 2 }));
    jest.advanceTimersByTime(701);
  });
  await flush();
  // Start the first save after the effect has registered its debounce.
  await act(async () => {
    jest.advanceTimersByTime(701);
  });
  await flush();
  expect(store.getState().cart.syncing).toBe(true);
  await act(async () => {
    store.dispatch(quantityChanged({ id: plan.id, quantity: 3 }));
  });
  await act(async () => finish({ items: lines(2), version: 2 }));
  expect(store.getState().cart.items[0].quantity).toBe(3);
  await act(async () => {
    jest.advanceTimersByTime(701);
  });
  await flush();
  const writes = mockApi.mock.calls
    .filter(([path]) => path === '/v2/cart')
    .map(([, init]) => JSON.parse(String(init?.body)));
  expect(writes.map((write) => write.items[0].quantity)).toEqual([2, 3]);
  expect(writes.map((write) => write.version)).toEqual([1, 2]);
});

test('cart rebase preserves account quantities, local removals and limits without duplication', () => {
  expect(preserveCartEdits(lines(3), [{ planId: plan.id, quantity: 1 }], lines(2))).toEqual(
    lines(4),
  );
  expect(preserveCartEdits(lines(2), [{ planId: plan.id, quantity: 1 }], [])).toEqual(lines(1));
  expect(() => preserveCartEdits(lines(5), [{ planId: plan.id, quantity: 1 }], lines(2))).toThrow(
    /limit/,
  );
});

test('an old account save cannot overwrite another account or its latest version', async () => {
  jest.useFakeTimers();
  localStorage.setItem('alozuri-cart', JSON.stringify(lines(1)));
  mockSession = { user: { uid: 'alice', emailVerified: true }, loading: false };
  let finish!: (result: unknown) => void;
  mockApi.mockImplementation(async (path, _init, uid) => {
    if (path === '/v2/cart/merge') return { items: lines(1), version: uid === 'bob' ? 10 : 1 };
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const store = makeStore();
  const view = () => (
    <Provider store={store}>
      <CartSync />
    </Provider>
  );
  const rendered = render(view());
  await flush();
  await act(async () => {
    store.dispatch(quantityChanged({ id: plan.id, quantity: 2 }));
  });
  await act(async () => {
    jest.advanceTimersByTime(701);
  });
  await flush();
  expect(store.getState().cart.syncing).toBe(true);
  mockSession = { user: { uid: 'bob', emailVerified: true }, loading: false };
  rendered.rerender(view());
  await flush();
  expect(store.getState().cart.items).toEqual(lines(1));
  expect(store.getState().cart.version).toBe(10);
  await act(async () => finish({ items: lines(2), version: 2 }));
  expect(store.getState().cart.items).toEqual(lines(1));
  expect(store.getState().cart.version).toBe(10);
  expect(mockApi.mock.calls.find(([path]) => path === '/v2/cart')?.[2]).toBe('alice');
});
