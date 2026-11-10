import { spawnSync } from 'node:child_process';
const flags = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, args) => {
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
for (const job of [
  { name: 'alozuri-fulfillment', path: '/internal/fulfillment/run', schedule: '* * * * *' },
  { name: 'alozuri-catalogue-daily', path: '/internal/catalogue/sync', schedule: '0 3 * * *' },
]) {
  const exists = JSON.parse(
    run(
      ['scheduler', 'jobs', 'list', '--project', project, '--location', region, '--format=json'],
      true,
    ),
  ).some((entry) => entry.name?.endsWith('/' + job.name));
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
    'Europe/London',
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
    target,
    '--attempt-deadline',
    '300s',
    '--max-retry-attempts',
    '3',
    '--min-backoff',
    '30s',
  ]);
}
console.log(
  'Configured delivery and catalogue schedules. Set the matching API audience and service-account environment values.',
);
