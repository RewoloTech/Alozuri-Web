import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateToken, type IdentityProvider } from '../src/lib/authentication.js';
import { createApp } from '../src/app.js';

function identityFixture(claim: unknown = true, verified = true) {
  let current: Awaited<ReturnType<IdentityProvider['getUser']>> = {
    uid: 'owner',
    disabled: false,
    emailVerified: true,
    customClaims: { admin: true },
  };
  let reads = 0;
  const provider: IdentityProvider = {
    verifyIdToken: async (_token, checkRevoked) => {
      assert.equal(checkRevoked, true);
      return { uid: 'owner', email: 'owner@example.test', email_verified: verified, admin: claim };
    },
    getUser: async (uid) => {
      assert.equal(uid, 'owner');
      reads++;
      return current;
    },
  };
  return {
    provider,
    reads: () => reads,
    update: (patch: Partial<typeof current>) => {
      current = { ...current, ...patch };
    },
  };
}

test('only a strict boolean admin claim on a verified token can request admin access', async () => {
  for (const claim of [null, false, 'true', 1, {}, ['admin']]) {
    const f = identityFixture(claim);
    assert.equal((await authenticateToken('verified-by-provider', f.provider)).admin, false);
    assert.equal(f.reads(), 0);
  }
  const missing = identityFixture();
  missing.provider.verifyIdToken = async () => ({ uid: 'owner', email_verified: true });
  assert.equal((await authenticateToken('missing-claim', missing.provider)).admin, false);
  assert.equal(missing.reads(), 0);
  const unverified = identityFixture(true, false);
  assert.equal((await authenticateToken('unverified', unverified.provider)).admin, false);
  assert.equal(unverified.reads(), 0);
});

test('current account state revokes stale admin access without waiting for token refresh', async () => {
  const f = identityFixture();
  assert.equal((await authenticateToken('same-old-token', f.provider)).admin, true);
  for (const patch of [
    { customClaims: { admin: false } },
    { customClaims: { admin: 'true' } },
    { disabled: true },
    { emailVerified: false },
    { uid: 'different-user' },
  ]) {
    const next = identityFixture();
    next.update(patch);
    assert.equal((await authenticateToken('same-old-token', next.provider)).admin, false);
  }
  f.update({ customClaims: { admin: false } });
  assert.equal((await authenticateToken('same-old-token', f.provider)).admin, false);
});

test('owner UID restriction narrows access and can never grant a missing role', async () => {
  const f = identityFixture();
  assert.equal((await authenticateToken('owner-token', f.provider, 'owner')).admin, true);
  for (const configured of ['another-owner', '', ' '])
    assert.equal((await authenticateToken('owner-token', f.provider, configured)).admin, false);
  assert.equal(
    (await authenticateToken('ordinary-user', identityFixture(false).provider, 'owner')).admin,
    false,
  );
});

test('invalid/revoked tokens and failed current-role lookups fail closed', async () => {
  const f = identityFixture();
  f.provider.verifyIdToken = async () => {
    throw new Error('Invalid or revoked token');
  };
  await assert.rejects(authenticateToken('invalid', f.provider), /revoked/);
  assert.equal(f.reads(), 0);
  const unavailable = identityFixture();
  unavailable.provider.getUser = async () => {
    throw new Error('Role lookup unavailable');
  };
  await assert.rejects(authenticateToken('old-admin-token', unavailable.provider), /unavailable/);
});

test('admin API rejects anonymous/customer/unverified/stale/forged identities and owner mismatch', async () => {
  const app = await createApp({
    repository: { plans: async () => [], orders: async () => [], order: async () => null },
    demo: false,
    payments: null,
    fulfillment: null,
    commerce: null,
    verify: async (token) => {
      if (token === 'invalid') throw new Error('Bad signature');
      const f = identityFixture(
        token === 'customer' ? false : token === 'forged' ? 'true' : true,
        token !== 'unverified',
      );
      if (token === 'stale') f.update({ customClaims: { admin: false } });
      return authenticateToken(
        token,
        f.provider,
        token === 'wrong-owner' ? 'another-owner' : 'owner',
      );
    },
  });
  try {
    for (const [token, status] of [
      [null, 401],
      ['invalid', 401],
      ['customer', 403],
      ['unverified', 403],
      ['stale', 403],
      ['forged', 403],
      ['wrong-owner', 403],
      ['valid-owner', 200],
    ] as const) {
      const response = await app.inject({
        url: '/v1/admin/status?admin=true&uid=owner',
        headers: token
          ? { authorization: 'Bearer ' + token, 'x-admin': 'true', 'x-user-id': 'owner' }
          : { 'x-admin': 'true' },
      });
      assert.equal(response.statusCode, status, String(token));
      assert.equal(response.headers['cache-control'], 'no-store');
    }
    assert.equal(
      (await app.inject({ method: 'POST', url: '/v1/admin/roles', payload: { admin: true } }))
        .statusCode,
      404,
    );
    for (const url of ['/internal/catalogue/sync', '/internal/fulfillment/run'])
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url,
            headers: { authorization: 'Bearer valid-owner' },
            payload: {},
          })
        ).statusCode,
        401,
      );
  } finally {
    await app.close();
  }
});
