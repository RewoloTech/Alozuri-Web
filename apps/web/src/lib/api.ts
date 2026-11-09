import { authClient } from './firebase';
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export async function api<T>(
  path: string,
  init: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const user = authClient().currentUser;
    if (!user) throw new Error('Please sign in to continue.');
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await response
    .json()
    .catch(() => ({ error: 'The service is temporarily unavailable.' }));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body as T;
}
