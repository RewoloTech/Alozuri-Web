import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('./deploy-api.mjs', import.meta.url));

for (const failStep of ['', 'builds', 'deploy']) {
  test(`deployment sequence stops safely: ${failStep || 'success'}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'alozuri-deploy-test-'));
    try {
      const cli = join(dir, 'gcloud');
      const log = join(dir, 'calls');
      writeFileSync(
        cli,
        `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.DEPLOY_TEST_LOG,JSON.stringify(args)+'\\n');if(args.includes(process.env.DEPLOY_TEST_FAIL)&&process.env.DEPLOY_TEST_FAIL)process.exit(1);\n`,
        { mode: 0o755 },
      );
      const result = spawnSync(process.execPath, [script], {
        env: { ...process.env, GCLOUD_BIN: cli, DEPLOY_TEST_LOG: log, DEPLOY_TEST_FAIL: failStep },
        encoding: 'utf8',
      });
      const calls = readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      assert.equal(result.status, failStep ? 1 : 0);
      assert.equal(calls.length, failStep === 'builds' ? 1 : failStep === 'deploy' ? 2 : 3);
      assert.equal(calls[0][0], 'builds');
      if (!failStep) {
        assert.ok(calls[1].includes('--no-traffic'));
        const suffix = calls[1].find((arg) => arg.startsWith('--revision-suffix=')).split('=')[1];
        assert.ok(calls[2].includes(`--to-revisions=alozuri-api-${suffix}=100`));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('finds an installed SDK when gcloud is absent from PATH', () => {
  const dir = mkdtempSync(join(tmpdir(), 'alozuri-sdk-test-'));
  try {
    const cli = join(dir, 'google-cloud-sdk/bin/gcloud');
    mkdirSync(dirname(cli), { recursive: true });
    writeFileSync(cli, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const result = spawnSync(process.execPath, [script, '--dry-run'], {
      env: { ...process.env, HOME: dir, PATH: '', GCLOUD_BIN: '' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes(cli + ' builds submit'));
    assert.ok(result.stdout.includes('nothing deployed'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
