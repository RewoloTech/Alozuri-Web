import { afterAll, describe, expect, jest, test } from '@jest/globals';

jest.mock('@/lib/firebase', () => ({ authClient: () => ({ currentUser: null }) }));
const originalHeaders = Object.getOwnPropertyDescriptor(globalThis, 'Headers');
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
class RequestHeaders {
  private values = new Map<string, string>();
  set(name: string, value: string) {
    this.values.set(name.toLowerCase(), value);
  }
  get(name: string) {
    return this.values.get(name.toLowerCase()) ?? null;
  }
  has(name: string) {
    return this.values.has(name.toLowerCase());
  }
}
Object.defineProperty(globalThis, 'Headers', { configurable: true, value: RequestHeaders });
const { apiBlob } = jest.requireActual<typeof import('../../apps/web/src/lib/api')>(
  '../../apps/web/src/lib/api',
);
function response(type: string) {
  const blob = new Blob(['controlled payload'], { type });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: jest.fn(async () => ({
      ok: true,
      headers: { get: () => type },
      blob: async () => blob,
    })),
  });
  return blob;
}
afterAll(() => {
  for (const [name, original] of [
    ['Headers', originalHeaders],
    ['fetch', originalFetch],
  ] as const) {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  }
});
describe('download MIME boundaries', () => {
  test('contract downloads retain PDF validation by default', async () => {
    const blob = response('application/pdf; charset=utf-8');
    await expect(apiBlob('/v2/orders/fixture/contract.pdf')).resolves.toBe(blob);
    response('image/png');
    await expect(apiBlob('/v2/orders/fixture/contract.pdf')).rejects.toThrow('contract');
  });
  for (const type of ['image/png', 'image/jpeg', 'image/webp'])
    test(`explicit image mode accepts ${type}`, async () => {
      const blob = response(type);
      await expect(apiBlob('/v1/marketing/images/fixture', {}, false, 'image')).resolves.toBe(blob);
    });
  for (const type of ['text/html', 'image/svg+xml', 'application/pdf', 'application/octet-stream'])
    test(`image mode rejects ${type}`, async () => {
      response(type);
      await expect(apiBlob('/v1/marketing/images/fixture', {}, false, 'image')).rejects.toThrow(
        'Image preview',
      );
    });
});
