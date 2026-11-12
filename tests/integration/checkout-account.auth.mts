import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signOut,
  applyActionCode,
  reload,
  getIdTokenResult,
} from 'firebase/auth';
import { z } from 'zod';
import { authenticateCheckoutEmail } from '../../apps/web/src/lib/checkout-account.ts';

test('checkout email signup and login use Firebase, send verification and retain unverified status until confirmed', async () => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const app = initializeApp(
    { apiKey: 'fake-emulator-key', projectId: 'demo-alozuri' },
    'checkout-account-test',
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const email = `checkout-${crypto.randomUUID()}@example.test`;
  const password = 'local-emulator-example-password';
  const verificationUrl = 'http://localhost:3100/verify-email?next=%2Faccount%2Fesims';
  try {
    await authenticateCheckoutEmail(auth, 'register', email, password, verificationUrl);
    const user = auth.currentUser;
    assert.ok(user);
    assert.equal(user.email, email);
    assert.equal(user.displayName, null);
    assert.equal(user.emailVerified, false);
    assert.equal((await getIdTokenResult(user)).claims.email_verified, false);
    const response = await fetch(
      'http://127.0.0.1:9099/emulator/v1/projects/demo-alozuri/oobCodes',
    );
    assert.equal(response.status, 200);
    const codes = z
      .object({
        oobCodes: z.array(
          z.object({ email: z.string(), oobCode: z.string(), requestType: z.string() }),
        ),
      })
      .parse(await response.json());
    const verification = codes.oobCodes.find(
      (code) => code.email === email && code.requestType === 'VERIFY_EMAIL',
    );
    assert.ok(verification, 'Firebase generated a verification message');
    await signOut(auth);
    await assert.rejects(
      authenticateCheckoutEmail(auth, 'login', email, 'incorrect-example', verificationUrl),
    );
    await authenticateCheckoutEmail(auth, 'login', email, password, verificationUrl);
    assert.equal(auth.currentUser?.uid, user.uid);
    assert.equal(auth.currentUser?.emailVerified, false);
    await applyActionCode(auth, verification.oobCode);
    assert.ok(auth.currentUser);
    await reload(auth.currentUser);
    assert.equal((await getIdTokenResult(auth.currentUser, true)).claims.email_verified, true);
  } finally {
    await signOut(auth);
    await deleteApp(app);
  }
});

test('real Firebase role removal blocks a stale admin token and an owner UID never grants a role', async () => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } =
    await import('firebase-admin/app');
  const { getAuth: getAdminAuth } = await import('firebase-admin/auth');
  const { authenticateToken } = await import('../../apps/api/src/lib/authentication.ts');
  const adminApp = initializeAdminApp({ projectId: 'demo-alozuri' }, 'admin-role-test');
  const clientApp = initializeApp(
    { apiKey: 'fake-emulator-key', projectId: 'demo-alozuri' },
    'admin-role-client',
  );
  const auth = getAuth(clientApp),
    adminAuth = getAdminAuth(adminApp);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  try {
    const email = `role-${crypto.randomUUID()}@example.test`,
      password = 'local-emulator-role-password';
    await authenticateCheckoutEmail(
      auth,
      'register',
      email,
      password,
      'http://localhost:3100/verify-email',
    );
    const user = auth.currentUser;
    assert.ok(user);
    const ordinary = await user.getIdToken(true);
    assert.equal((await authenticateToken(ordinary, adminAuth, user.uid)).admin, false);
    await adminAuth.updateUser(user.uid, { emailVerified: true });
    await adminAuth.setCustomUserClaims(user.uid, { admin: true });
    await reload(user);
    const token = await user.getIdToken(true);
    assert.equal((await authenticateToken(token, adminAuth, user.uid)).admin, true);
    const { createApp } = await import('../../apps/api/src/app.ts');
    const server = await createApp({
      demo: true,
      payments: null,
      commerce: null,
      fulfillment: null,
      profiles: null,
      financial: null,
      verify: (value) => authenticateToken(value, adminAuth),
    });
    try {
      assert.equal(
        (
          await server.inject({
            url: '/v1/operations/access',
            headers: { authorization: 'Bearer ' + token },
          })
        ).statusCode,
        200,
      );
      await adminAuth.setCustomUserClaims(user.uid, {});
      assert.equal(
        (
          await server.inject({
            url: '/v1/operations/access',
            headers: { authorization: 'Bearer ' + token },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await server.inject({
            url: '/v1/operations/financials?from=2026-11-01&to=2026-11-30',
            headers: { authorization: 'Bearer ' + token },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await server.inject({
            url: '/v1/operations/pricing-history?from=2026-11-01&to=2026-11-30',
            headers: { authorization: 'Bearer ' + token },
          })
        ).statusCode,
        403,
      );
      await adminAuth.setCustomUserClaims(user.uid, { admin: true });
    } finally {
      await server.close();
    }

    assert.equal((await authenticateToken(token, adminAuth, 'different-owner')).admin, false);
    await adminAuth.setCustomUserClaims(user.uid, {});
    // The SDK still decodes the original token's old claim; our current-role check denies it.
    assert.equal((await adminAuth.verifyIdToken(token, true)).admin, true);
    assert.equal((await authenticateToken(token, adminAuth, user.uid)).admin, false);
    await adminAuth.updateUser(user.uid, { disabled: true });
    await assert.rejects(authenticateToken(token, adminAuth, user.uid));
  } finally {
    await signOut(auth);
    await deleteApp(clientApp);
    await deleteAdminApp(adminApp);
  }
});

test('trusted Operations CLI grants and revokes a verified emulator account without replacing other claims', async () => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } =
    await import('firebase-admin/app');
  const { getAuth: getAdminAuth } = await import('firebase-admin/auth');
  const { spawnSync } = await import('node:child_process');
  const app = initializeAdmin({ projectId: 'demo-alozuri' }, 'operations-cli-test'),
    admin = getAdminAuth(app);
  try {
    const account = await admin.createUser({
      email: `operator-${crypto.randomUUID()}@example.test`,
      emailVerified: true,
    });
    await admin.setCustomUserClaims(account.uid, { existingFeature: true });
    const run = (action: string, confirmation = account.uid) =>
      spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/operations-admin.mts',
          '--project',
          'demo-alozuri',
          '--uid',
          account.uid,
          '--confirm-uid',
          confirmation,
          action,
        ],
        { env: process.env, encoding: 'utf8' },
      );
    assert.notEqual(run('--grant', 'incorrect-confirmation').status, 0);
    assert.equal((await admin.getUser(account.uid)).customClaims?.admin, undefined);
    const grant = run('--grant');
    assert.equal(grant.status, 0, grant.stderr);
    assert.equal((await admin.getUser(account.uid)).customClaims?.admin, true);
    assert.equal((await admin.getUser(account.uid)).customClaims?.existingFeature, true);
    const revoke = run('--revoke');
    assert.equal(revoke.status, 0, revoke.stderr);
    assert.equal((await admin.getUser(account.uid)).customClaims?.admin, undefined);
    assert.equal((await admin.getUser(account.uid)).customClaims?.existingFeature, true);
  } finally {
    await deleteAdmin(app);
  }
});
