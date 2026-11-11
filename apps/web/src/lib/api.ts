import { authClient } from './firebase';
import { allowedStoreRequest } from './store-proxy';
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export async function api<T>(
  path: string,
  init: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const user = authClient().currentUser;
    if (!user) throw new Error('Please sign in to continue.');
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: 'no-store' });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    const method = (init.method || 'GET').toUpperCase();
    // Checkout and cart mutation bodies retain their original idempotency/version
    // fields. Never retry an HTTP error, an abort or an unrelated operation.
    if (!baseUrl || !allowedStoreRequest(method, path.split('?')[0])) {
      throw new Error(
        'We could not connect to the store. Your cart is saved. Please retry shortly.',
      );
    }
    try {
      response = await fetch(`/api/store${path}`, { ...init, headers, cache: 'no-store' });
    } catch (fallbackError) {
      if (init.signal?.aborted) throw fallbackError;
      throw new Error(
        'We could not connect to the store. Your cart is saved. Check your connection and retry.',
      );
    }
  }
  const body = await response
    .json()
    .catch(() => ({ error: 'The service is temporarily unavailable.' }));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body as T;
}
