import { authClient } from './firebase';
import { allowedStoreRequest } from './store-proxy';
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
async function storeResponse(
  path: string,
  init: RequestInit = {},
  authenticated: boolean | string = false,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const user = authClient().currentUser;
    if (!user || (typeof authenticated === 'string' && user.uid !== authenticated))
      throw new Error('Your account changed. Please retry.');
    const credential = await user.getIdTokenResult();
    // reload() can update emailVerified before Firebase refreshes the cached JWT.
    // Do not send an unverified token for a now-verified cart/account request.
    const token =
      user.emailVerified && credential.claims.email_verified !== true
        ? await user.getIdToken(true)
        : credential.token;
    if (authClient().currentUser?.uid !== user.uid)
      throw new Error('Your account changed. Please retry.');
    headers.set('Authorization', `Bearer ${token}`);
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
  return response;
}
export async function api<T>(
  path: string,
  init: RequestInit = {},
  authenticated: boolean | string = false,
): Promise<T> {
  const response = await storeResponse(path, init, authenticated);
  const body = await response
    .json()
    .catch(() => ({ error: 'The service is temporarily unavailable.' }));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body as T;
}

export async function apiBlob(
  path: string,
  init: RequestInit = {},
  authenticated: boolean | string = false,
): Promise<Blob> {
  const response = await storeResponse(path, init, authenticated);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Your contract could not be downloaded. Please retry.',
    );
  }
  if (!response.headers.get('content-type')?.includes('application/pdf'))
    throw new Error('Your contract is temporarily unavailable.');
  return response.blob();
}
