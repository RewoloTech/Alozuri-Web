import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedStoreRequest, allowedStoreOrigin } from '../../../apps/web/src/lib/store-proxy.ts';
test('store transport permits customer operations without exposing internal or arbitrary destinations', () => {
  for (const [method, path] of [
    ['GET', '/v1/config'],
    ['GET', '/v1/packages/esim-test'],
    ['POST', '/v2/quote'],
    ['POST', '/v2/checkout'],
    ['PUT', '/v2/cart'],
    ['GET', '/v2/orders/purchase_test/units/order_test/activation'],
    ['GET', '/v2/orders/purchase_test/units/order_test/usage'],
  ])
    assert.equal(allowedStoreRequest(method, path), true);
  for (const [method, path] of [
    ['GET', 'https://attacker.example'],
    ['GET', '//attacker.example'],
    ['POST', '/internal/fulfillment/run'],
    ['POST', '/v1/webhooks/stripe'],
    ['POST', '/v2/orders/purchase_test/units/order_test/usage'],
    ['GET', '/v1/admin/status'],
    ['DELETE', '/v2/cart'],
    ['GET', '/v1/packages/../admin'],
    ['POST', '/v1/orders/order_test/resume-checkout'],
  ])
    assert.equal(allowedStoreRequest(method, path), false);
});

test('store origin checks support the public App Hosting origin without trusting arbitrary origins', () => {
  assert.equal(
    allowedStoreOrigin('https://alozuri.com', 'http://internal:8080', 'https://alozuri.com'),
    true,
  );
  assert.equal(allowedStoreOrigin('http://localhost:3000', 'http://localhost:3000'), true);
  assert.equal(
    allowedStoreOrigin('https://attacker.example', 'http://internal:8080', 'https://alozuri.com'),
    false,
  );
  assert.equal(allowedStoreOrigin('null', 'http://internal:8080', 'https://alozuri.com'), false);
  assert.throws(() =>
    allowedStoreOrigin('https://alozuri.com', 'http://internal:8080', 'malformed-config'),
  );
});
