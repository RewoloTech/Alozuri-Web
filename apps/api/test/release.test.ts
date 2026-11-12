import test from 'node:test';
import assert from 'node:assert/strict';
import { changedTargets, releasePlan } from '../../../scripts/release-plan.ts';
import { releaseProduction, type ReleaseRuntime } from '../../../scripts/release-production.mts';

const sha = 'a'.repeat(40),
  previous = 'b'.repeat(40);
test('release selection separates UI/API changes and deploys both for shared dependencies', async () => {
  assert.deepEqual(changedTargets(['docs/testing.md', 'tests/e2e/shopping.spec.ts']), {
    api: false,
    web: false,
  });
  assert.deepEqual(changedTargets(['apps/web/src/components/cart.tsx']), { api: false, web: true });
  assert.deepEqual(changedTargets(['apps/api/src/lib/commerce.ts']), { api: true, web: false });
  for (const file of ['package-lock.json', 'packages/shared/src/legal.ts', 'package.json'])
    assert.deepEqual(changedTargets([file]), { api: true, web: true });
  const bases: string[] = [];
  const plan = await releasePlan(sha, { api: previous, web: 'c'.repeat(40) }, async (base) => {
    bases.push(base);
    return base === previous ? ['apps/api/src/app.ts'] : ['docs/testing.md'];
  });
  assert.deepEqual(plan, { sha, api: true, web: false });
  assert.deepEqual(bases, [previous, 'c'.repeat(40)]);
  assert.equal((await releasePlan(sha, { api: null, web: sha }, async () => [])).api, true);
  assert.equal((await releasePlan(sha, { api: previous, web: sha }, async () => null)).api, true);
  await assert.rejects(releasePlan('main', { api: null, web: null }, async () => []));
});
function fixture() {
  const calls: string[] = [],
    reports: string[] = [];
  let webSha = previous,
    failRollout = false,
    failBuild = false,
    ambiguousWeb = false;
  const runtime: ReleaseRuntime = {
    live: async () => ({
      api: previous,
      apiRevision: 'alozuri-api-old',
      web: previous,
      webBuild: 'old-build',
    }),
    diff: async () => ['packages/shared/src/legal.ts'],
    buildApi: async (commit) => {
      calls.push('build:' + commit);
      if (failBuild) throw new Error('Build failed');
      return { revision: 'alozuri-api-new', image: 'image@sha256:fixture' };
    },
    promoteApi: async (revision) => {
      calls.push('promote:' + revision);
    },
    rolloutWeb: async (commit) => {
      calls.push('web:' + commit);
      if (ambiguousWeb) webSha = commit;
      if (failRollout) throw new Error('Rollout failed');
      webSha = commit;
    },
    web: async () => ({ sha: webSha, build: webSha === sha ? 'new-build' : 'old-build' }),
    cleanup: async () => {
      calls.push('cleanup');
    },
    report: async (message) => {
      reports.push(message);
    },
  };
  return {
    runtime,
    calls,
    reports,
    fail: (stage: 'build' | 'web' | 'ambiguous') => {
      failBuild = stage === 'build';
      failRollout = stage !== 'build';
      ambiguousWeb = stage === 'ambiguous';
    },
  };
}
test('one release uses the exact same commit and promotes the checked API before the website', async () => {
  const f = fixture();
  await releaseProduction(sha, f.runtime, false, true);
  assert.deepEqual(f.calls, ['build:' + sha, 'promote:alozuri-api-new', 'web:' + sha, 'cleanup']);
  assert.ok(f.reports.some((message) => message.includes('Website commit: ' + sha)));
});
test('planning does not publish, and unchanged targets do not build or deploy', async () => {
  const f = fixture();
  await releaseProduction(sha, f.runtime);
  assert.deepEqual(f.calls, []);
  f.runtime.diff = async () => ['docs/testing.md'];
  await releaseProduction(sha, f.runtime, false, true);
  assert.deepEqual(f.calls, []);
});
test('candidate failure cannot publish the website or move API traffic', async () => {
  const f = fixture();
  f.fail('build');
  await assert.rejects(releaseProduction(sha, f.runtime, false, true), /Build failed/);
  assert.deepEqual(f.calls, ['build:' + sha, 'cleanup']);
});
test('failed website rollout restores the API only after confirming the previous website is live', async () => {
  const f = fixture();
  f.fail('web');
  await assert.rejects(releaseProduction(sha, f.runtime, false, true), /Rollout failed/);
  assert.deepEqual(f.calls, [
    'build:' + sha,
    'promote:alozuri-api-new',
    'web:' + sha,
    'promote:alozuri-api-old',
    'cleanup',
  ]);
  assert.ok(f.reports.some((message) => message.includes('API restored')));
});
test('an ambiguous website result reports a partial release instead of putting an old API behind a new website', async () => {
  const f = fixture();
  f.fail('ambiguous');
  await assert.rejects(releaseProduction(sha, f.runtime, false, true), /Rollout failed/);
  assert.equal(f.calls.includes('promote:alozuri-api-old'), false);
  assert.ok(f.reports.some((message) => message.includes('PARTIAL RELEASE')));
});
