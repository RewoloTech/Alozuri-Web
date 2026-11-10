// Read-only supplier catalogue fetch; no payment, order or eSIM issuance calls.
import { GoogleAuth } from 'google-auth-library';
import { syncCatalogue } from '../apps/api/src/lib/catalogue-sync.ts';
import { database } from '../apps/api/src/lib/firebase.ts';

const project = process.env.GOOGLE_CLOUD_PROJECT;
if (!project || process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error(
    'Set GOOGLE_CLOUD_PROJECT to the intended cloud project. Emulator runs use the integration suite.',
  );
try {
  const client = await new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  }).getClient();
  for (const name of ['ESIM_ACCESS_CODE', 'ESIM_SECRET_KEY']) {
    const response = await client.request<{ payload: { data: string } }>({
      url: `https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}/versions/latest:access`,
    });
    process.env[name] = Buffer.from(response.data.payload.data, 'base64').toString('utf8');
  }
  const result = await syncCatalogue();
  console.log(JSON.stringify(result));
} catch {
  console.error(
    'Catalogue sync failed. Check workload identity, supplier credentials and catalogueSync/esim-access status.',
  );
  process.exitCode = 1;
} finally {
  await database().terminate();
}
