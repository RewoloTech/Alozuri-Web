import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// npm may have a different PATH from an interactive shell. Find installed SDKs too.
const candidates = [
  ...(process.env.PATH || '')
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, 'gcloud')),
  join(homedir(), 'google-cloud-sdk/bin/gcloud'),
  join(homedir(), '.local/share/google-cloud-sdk/bin/gcloud'),
  '/opt/homebrew/bin/gcloud',
  '/usr/local/bin/gcloud',
  // Compatible SDK wrapper from this machine's earlier backend deployments.
  '/tmp/alozuri-gcloud',
];
const gcloud =
  process.env.GCLOUD_BIN ||
  candidates.find((candidate) => {
    try {
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }) ||
  'gcloud';
const project = 'alozuri';
const region = 'europe-west4';
const service = 'alozuri-api';
const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
const image = `${region}-docker.pkg.dev/${project}/alozuri-api/api:manual-${stamp}`;
const revisionSuffix = `manual-${stamp}`;
const revision = `${service}-${revisionSuffix}`;
const dryRun = process.argv.includes('--dry-run');
const commands = [
  ['builds', 'submit', '.', `--project=${project}`, `--tag=${image}`],
  [
    'run',
    'deploy',
    service,
    `--project=${project}`,
    `--region=${region}`,
    `--image=${image}`,
    `--revision-suffix=${revisionSuffix}`,
    '--no-traffic',
    '--quiet',
  ],
  [
    'run',
    'services',
    'update-traffic',
    service,
    `--project=${project}`,
    `--region=${region}`,
    `--to-revisions=${revision}=100`,
    '--quiet',
  ],
];

for (const args of commands) {
  console.info([gcloud, ...args].join(' '));
  if (dryRun) continue;
  const result = spawnSync(gcloud, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CLOUDSDK_BILLING_QUOTA_PROJECT: project },
  });
  if (result.error) {
    console.error(
      'Could not start gcloud. Install the Google Cloud CLI or set GCLOUD_BIN to its executable path.',
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('Deployment stopped because the preceding command failed.');
    process.exit(result.status || 1);
  }
}
console.info(
  dryRun
    ? 'Dry run only; nothing deployed.'
    : 'Backend deployed. Check Cloud Run health and a new confirmation email.',
);
