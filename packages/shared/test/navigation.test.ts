import test from 'node:test';
import assert from 'node:assert/strict';
import { safeAccountDestination } from '../src/index.ts';
test('post-authentication navigation rejects external, executable and ambiguous URLs', () => {
  for (const value of [
    null,
    undefined,
    {},
    'https://evil.example',
    '//evil.example',
    'javascript:alert(1)',
    '/\\evil.example',
    '/\n/evil.example',
    '/\t/evil.example',
    '/%2fexample.com',
    '/%5cevil.example',
    '/%0a/evil.example',
    '/%2e%2e//evil.example',
    '/%zz',
    '/' + 'a'.repeat(2048),
  ]) {
    assert.equal(safeAccountDestination(value), '/dashboard');
  }
});
test('post-authentication navigation preserves ordinary local destinations and queries', () => {
  for (const value of [
    '/dashboard/orders',
    '/account/esims',
    '/checkout?buy=example',
    '/destinations/fr?countries=FR',
    '/help#compatibility',
  ])
    assert.equal(safeAccountDestination(value), value);
});
