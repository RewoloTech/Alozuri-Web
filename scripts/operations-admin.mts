// Trusted operator-only CLI. Never expose this capability through a web endpoint.
import { applicationDefault, initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
const args = process.argv.slice(2);
const value = (key: string) => {
  const index = args.indexOf(key);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error('Missing ' + key);
  return args[index + 1];
};
const project = z
  .string()
  .regex(/^[a-z][a-z0-9-]{4,62}$/)
  .parse(value('--project'));
const uid = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^/]+$/)
  .parse(value('--uid'));
if (value('--confirm-uid') !== uid || args.includes('--grant') === args.includes('--revoke'))
  throw new Error(
    'Supply --project, --uid, matching --confirm-uid, and exactly one of --grant or --revoke.',
  );
const app = initializeApp({ projectId: project, credential: applicationDefault() });
const auth = getAuth(app);
const account = await auth.getUser(uid);
if (args.includes('--grant') && (!account.emailVerified || account.disabled))
  throw new Error('Verify and enable the account before granting Operations access.');
const claims = { ...account.customClaims };
if (args.includes('--grant')) claims.admin = true;
else delete claims.admin;
await auth.setCustomUserClaims(uid, claims);
if (args.includes('--revoke')) await auth.revokeRefreshTokens(uid);
console.info(
  args.includes('--grant')
    ? 'Operations administrator claim assigned. Sign out and sign in again.'
    : 'Operations administrator claim removed and sessions revoked.',
);
await deleteApp(app);
