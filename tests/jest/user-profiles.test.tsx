import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react';
import type { UserProfile } from '../../packages/shared/src/user-profile';
type FakeUser = { uid: string; emailVerified: boolean };
let mockUser: FakeUser | null = null;
let mockListener: ((user: FakeUser | null) => void) | null = null;
const mockApi =
  jest.fn<(path: string, init: RequestInit, uid: string) => Promise<{ profile: UserProfile }>>();
jest.mock('@/lib/api', () => ({
  demoMode: false,
  api: (...args: Parameters<typeof mockApi>) => mockApi(...args),
}));
jest.mock('@/lib/firebase', () => ({
  firebaseConfigured: true,
  authClient: () => ({ currentUser: mockUser }),
}));
jest.mock('firebase/auth', () => ({
  onIdTokenChanged: (_auth: unknown, listener: (user: FakeUser | null) => void) => {
    mockListener = listener;
    listener(mockUser);
    return () => {
      mockListener = null;
    };
  },
  signOut: async () => {
    mockUser = null;
    mockListener?.(null);
  },
}));
const { AuthProvider, useAuth } = jest.requireActual<
  typeof import('../../apps/web/src/components/auth-provider')
>('../../apps/web/src/components/auth-provider');
function profile(uid: string): UserProfile {
  return {
    uid,
    email: uid + '@example.test',
    emailVerified: true,
    displayName: uid,
    firstName: uid,
    lastName: '',
    providerIds: ['password'],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastSignInAt: null,
    updatedAt: '2026-11-12T00:00:00.000Z',
  };
}
function Consumer() {
  const { profile, profileError, refreshProfile } = useAuth();
  return (
    <>
      <p data-testid="profile">{profile?.uid ?? 'none'}</p>
      <p role="status">{profileError}</p>
      <button onClick={refreshProfile}>Retry profile</button>
    </>
  );
}
const mount = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
beforeEach(() => {
  mockUser = { uid: 'alice', emailVerified: false };
  mockApi.mockReset();
});
afterEach(cleanup);
test('late profile responses cannot leak across accounts and signout immediately hides private profile data', async () => {
  let release!: (result: { profile: UserProfile }) => void;
  const delayed = new Promise<{ profile: UserProfile }>((resolve) => {
    release = resolve;
  });
  mockApi.mockImplementation(async (_path, _init, uid) =>
    uid === 'alice' ? delayed : { profile: profile(uid) },
  );
  mount();
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
  await act(async () => {
    mockUser = { uid: 'bob', emailVerified: true };
    mockListener?.(mockUser);
  });
  await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe('bob'));
  await act(async () => {
    release({ profile: profile('alice') });
  });
  expect(screen.getByTestId('profile').textContent).toBe('bob');
  await act(async () => {
    mockUser = null;
    mockListener?.(null);
  });
  expect(screen.getByTestId('profile').textContent).toBe('none');
});
test('same-object verification resyncs once; ordinary token refresh does not repeatedly write profiles', async () => {
  mockApi.mockImplementation(async (_path, _init, uid) => ({ profile: profile(uid) }));
  mount();
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
  await act(async () => {
    mockUser!.emailVerified = true;
    mockListener?.(mockUser);
  });
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
  await act(async () => {
    mockListener?.(mockUser);
  });
  expect(mockApi).toHaveBeenCalledTimes(2);
  for (const [path, request, uid] of mockApi.mock.calls) {
    expect(path).toBe('/v2/profile');
    expect(request.method).toBe('POST');
    expect(request.body).toBe('{}');
    expect(uid).toBe('alice');
  }
});
test('profile failures are visible and retryable without exposing raw provider errors', async () => {
  mockApi.mockRejectedValueOnce(new Error('Private provider diagnostic'));
  mockApi.mockResolvedValue({ profile: profile('alice') });
  mount();
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('could not be synced'),
  );
  expect(screen.queryByText('Private provider diagnostic')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry profile' }));
  await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe('alice'));
});
