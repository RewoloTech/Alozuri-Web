import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const allowed = new Set(['--project', '--region', '--api-url', '--service-account']);
if (
  args.length % 2 ||
  args.some((arg, index) => index % 2 === 0 && (!allowed.has(arg) || args.indexOf(arg) !== index))
)
  throw new Error('Use --project, --region, --api-url and --service-account with one value each.');
const flags = Object.fromEntries(
  args.reduce((pairs, value, index, args) => {
    if (index % 2 === 0) pairs.push([value, args[index + 1]]);
    return pairs;
  }, []),
);
const project = flags['--project'];
const region = flags['--region'] || 'europe-west4';
const apiUrl = flags['--api-url'];
const account = flags['--service-account'];
if (!project || !apiUrl || !account || !account.endsWith(`@${project}.iam.gserviceaccount.com`))
  throw new Error('Supply --project, --api-url and a --service-account in that project.');
const url = new URL(apiUrl);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== '/'
)
  throw new Error('--api-url must be the HTTPS API origin.');
function run(args, capture = false) {
  const result = spawnSync('gcloud', args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error('gcloud command failed. Check project access and enabled APIs.');
  return result.stdout;
}
const jobs = JSON.parse(
  run(
    ['scheduler', 'jobs', 'list', '--project', project, '--location', region, '--format=json'],
    true,
  ),
);
if (!Array.isArray(jobs)) throw new Error('Invalid scheduler inventory; no jobs changed.');
// This legacy command now configures catalogue sync only. Never recreate the minute worker.
const legacy = jobs.find((entry) => entry.name?.endsWith('/alozuri-fulfillment'));
if (legacy && legacy.state !== 'PAUSED')
  run([
    'scheduler',
    'jobs',
    'pause',
    'alozuri-fulfillment',
    '--project',
    project,
    '--location',
    region,
    '--quiet',
  ]);
for (const job of [
  { name: 'alozuri-catalogue-daily', path: '/internal/catalogue/sync', schedule: '17 3 * * *' },
]) {
  const exists = jobs.some((entry) => entry.name?.endsWith('/' + job.name));
  const target = url.origin + job.path;
  run([
    'scheduler',
    'jobs',
    exists ? 'update' : 'create',
    'http',
    job.name,
    '--project',
    project,
    '--location',
    region,
    '--schedule',
    job.schedule,
    '--time-zone',
    'Etc/UTC',
    '--uri',
    target,
    '--http-method',
    'POST',
    '--headers',
    'Content-Type=application/json',
    '--message-body',
    '{}',
    '--oidc-service-account-email',
    account,
    '--oidc-token-audience',
    url.origin,
    '--attempt-deadline',
    '300s',
    '--max-retry-attempts',
    '3',
    '--min-backoff',
    '300s',
    '--max-backoff',
    '900s',
    '--quiet',
  ]);
}
console.log(
  'Configured daily catalogue sync at 03:17 UTC. Legacy minute fulfilment stays paused; orders use Cloud Tasks. Set CATALOGUE_SYNC_AUDIENCE to the API origin and CATALOGUE_SYNC_SERVICE_ACCOUNT to this caller.',
);
