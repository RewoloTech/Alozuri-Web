import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';

const origin = 'https://alozuri-api.example.test';
const caller = 'alozuri-catalogue-scheduler@alozuri.iam.gserviceaccount.com';
const flags = [
  '--project',
  'alozuri',
  '--region',
  'europe-west4',
  '--api-url',
  origin,
  '--service-account',
  caller,
];
function fixture(
  t: { after(callback: () => void): unknown },
  jobs: { name: string; state: string }[],
) {
  const directory = mkdtempSync(join(tmpdir(), 'alozuri-scheduler-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, 'commands.jsonl');
  writeFileSync(
    join(directory, 'gcloud'),
    `#!/usr/bin/env node
const fs=require('node:fs');
const args=process.argv.slice(2);
fs.appendFileSync(process.env.ALOZURI_SCHEDULER_TEST_LOG,JSON.stringify(args)+'\\n');
if(args[0]==='scheduler'&&args[1]==='jobs'&&args[2]==='list')process.stdout.write(process.env.ALOZURI_SCHEDULER_TEST_JOBS);
`,
    { mode: 0o755 },
  );
  return {
    run: (script: string, args = flags) =>
      spawnSync(
        process.execPath,
        [fileURLToPath(new URL('../../../scripts/' + script, import.meta.url)), ...args],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: directory + delimiter + process.env.PATH,
            ALOZURI_SCHEDULER_TEST_LOG: log,
            ALOZURI_SCHEDULER_TEST_JOBS: JSON.stringify(jobs),
          },
        },
      ),
    commands: () =>
      existsSync(log)
        ? readFileSync(log, 'utf8')
            .trim()
            .split('\n')
            .map((line) => z.array(z.string()).parse(JSON.parse(line)))
        : [],
  };
}
for (const script of ['configure-catalogue-scheduler.mjs', 'configure-fulfillment-worker.mjs']) {
  test(`${script} creates only a daily catalogue trigger and pauses existing minute fulfilment`, (t) => {
    const f = fixture(t, [
      {
        name: 'projects/alozuri/locations/europe-west4/jobs/alozuri-fulfillment',
        state: 'ENABLED',
      },
    ]);
    const result = f.run(script);
    assert.equal(result.status, 0, result.stderr);
    const commands = f.commands();
    assert(commands.some((args) => args[2] === 'pause' && args[3] === 'alozuri-fulfillment'));
    const created = commands.filter((args) => args[2] === 'create');
    assert.equal(created.length, 1);
    const args = created[0];
    const value = (flag: string) => args[args.indexOf(flag) + 1];
    assert.equal(args[4], 'alozuri-catalogue-daily');
    assert.equal(value('--schedule'), '17 3 * * *');
    assert.equal(value('--time-zone'), 'Etc/UTC');
    assert.equal(value('--uri'), origin + '/internal/catalogue/sync');
    assert.equal(value('--oidc-token-audience'), origin);
    assert.equal(value('--oidc-service-account-email'), caller);
    assert.equal(value('--max-retry-attempts'), '3');
    assert.equal(value('--min-backoff'), '300s');
    assert(!commands.some((args) => args.includes('* * * * *')));
    assert(!commands.some((args) => args[2] === 'resume' && args.includes('alozuri-fulfillment')));
  });
}
test('reconfiguration updates the same daily job and leaves a paused minute job alone', (t) => {
  const f = fixture(t, [
    { name: 'projects/alozuri/locations/europe-west4/jobs/alozuri-fulfillment', state: 'PAUSED' },
    {
      name: 'projects/alozuri/locations/europe-west4/jobs/alozuri-catalogue-daily',
      state: 'ENABLED',
    },
  ]);
  const result = f.run('configure-catalogue-scheduler.mjs');
  assert.equal(result.status, 0, result.stderr);
  const commands = f.commands();
  assert.equal(commands.length, 2);
  assert.equal(commands[1][2], 'update');
  assert.equal(commands[1][4], 'alozuri-catalogue-daily');
});
test('invalid scheduler inputs fail before calling Google Cloud', (t) => {
  const f = fixture(t, []);
  for (const bad of [
    [...flags, '--project', 'other-project'],
    flags.map((value) => (value === origin ? 'http://insecure.example.test' : value)),
    flags.map((value) =>
      value === caller ? 'caller@another-project.iam.gserviceaccount.com' : value,
    ),
    [...flags, '--unknown', 'value'],
    flags.slice(0, -1),
  ]) {
    assert.notEqual(f.run('configure-catalogue-scheduler.mjs', bad).status, 0);
  }
  assert.deepEqual(f.commands(), []);
});
