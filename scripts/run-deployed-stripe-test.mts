// Real sandbox payment against a deployed API and Stripe-delivered webhooks. No local webhook simulation.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const api = process.env.STRIPE_SANDBOX_API_URL;
if (!api || !api.startsWith('https://'))
  throw new Error('Set STRIPE_SANDBOX_API_URL to the deployed TEST API.');
const readEnv = (file: string) =>
  Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf('=');
        return [
          l.slice(0, i),
          l
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
const local = readEnv('apps/api/.env'),
  web = readEnv('apps/web/.env.local');
const publishable = local.STRIPE_TEST_PUBLISHABLE_KEY || web.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!publishable?.startsWith('pk_test_'))
  throw new Error('A Stripe TEST publishable key is required.');
const config = await (await fetch(api + '/v1/config')).json();
if (config.cartCheckoutMode !== 'test')
  throw new Error('The selected API is not in test payment mode.');
const catalogue = await (
  await fetch(api + '/v1/packages/match?countries=FR&coverage=local&minGb=1&dataType=fixed')
).json();
const plan = catalogue.plans?.[0];
if (!plan || plan.demo) throw new Error('No verified French test-purchase plan.');
const child = spawn(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/stripe-sdk.spec.ts'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      STRIPE_INTEGRATION: '1',
      E2E_API_URL: api,
      STRIPE_PLAN_ID: plan.id,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: publishable,
    },
  },
);
process.exitCode = await new Promise<number>((resolve) =>
  child.on('exit', (code) => resolve(code ?? 1)),
);
