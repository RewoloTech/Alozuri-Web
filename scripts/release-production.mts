import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';
import { releasePlan } from './release-plan.ts';

export type LiveRelease = {
  api: string | null;
  apiRevision: string;
  web: string;
  webBuild: string;
};
export type Candidate = { revision: string; image: string };
export type ReleaseRuntime = {
  live(): Promise<LiveRelease>;
  diff(base: string, head: string): Promise<string[] | null>;
  buildApi(sha: string): Promise<Candidate>;
  promoteApi(revision: string): Promise<void>;
  rolloutWeb(sha: string): Promise<void>;
  web(): Promise<{ sha: string; build: string }>;
  cleanup(): Promise<void>;
  report(message: string): Promise<void>;
};
// Two managed services cannot be switched atomically. Stage/check the API first,
// then release both under one manual action, with an explicit partial-failure report.
export async function releaseProduction(
  sha: string,
  runtime: ReleaseRuntime,
  force = false,
  apply = false,
) {
  const live = await runtime.live(),
    plan = await releasePlan(sha, live, runtime.diff, force);
  await runtime.report(
    `Commit: ${sha}\nAPI: ${plan.api ? 'deploy' : 'unchanged'}\nWebsite: ${plan.web ? 'deploy' : 'unchanged'}`,
  );
  if (!apply || (!plan.api && !plan.web)) return plan;
  let candidate: Candidate | undefined,
    promoted = false;
  try {
    if (plan.api) {
      candidate = await runtime.buildApi(sha); // No traffic until health/config checks pass.
      await runtime.promoteApi(candidate.revision);
      promoted = true;
      await runtime.report(`API live revision: ${candidate.revision}\nImage: ${candidate.image}`);
    }
    if (plan.web) {
      await runtime.rolloutWeb(sha);
      const web = await runtime.web();
      if (web.sha !== sha) throw new Error('Website is not serving the selected release commit.');
      await runtime.report(`Website live build: ${web.build}\nWebsite commit: ${web.sha}`);
    }
    await runtime.report(
      'Release succeeded. Queue settings, runtime secrets and scheduler state were not changed.',
    );
    return plan;
  } catch (error) {
    if (promoted) {
      // A CLI/network failure can occur after website promotion. Do not put an
      // old API behind a possibly-new website without knowing which commit is live.
      try {
        const currentWeb = await runtime.web();
        if (currentWeb.sha === live.web) {
          await runtime.promoteApi(live.apiRevision);
          await runtime.report(
            `Release failed; API restored to ${live.apiRevision}. Website remains ${live.web}.`,
          );
        } else
          await runtime.report(
            'PARTIAL RELEASE: website changed. New API retained; inspect both services before rollback.',
          );
      } catch {
        await runtime.report(
          'PARTIAL RELEASE: rollback state could not be verified. Inspect both services before retrying.',
        );
      }
    } else
      await runtime.report(
        'Release failed before API promotion. Inspect App Hosting if a website-only rollout was attempted.',
      );
    throw error;
  } finally {
    try {
      await runtime.cleanup();
    } catch {
      await runtime.report(
        'Temporary API candidate tag cleanup failed; remove it after reviewing the release.',
      );
    }
  }
}

const execute = promisify(execFile);
const resource = 'projects/alozuri/locations/europe-west4/backends/alozuri';
const apiFlags = ['--project=alozuri', '--region=europe-west4', '--quiet'];
const serviceSchema = z.object({
  status: z.object({
    url: z.url(),
    traffic: z.array(
      z.object({
        revisionName: z.string().regex(/^alozuri-api-[a-z0-9-]+$/),
        percent: z.number().optional(),
        tag: z.string().optional(),
        url: z.url().optional(),
      }),
    ),
  }),
});
const trafficSchema = z.object({
  rolloutPolicy: z.object({ disabled: z.literal(true) }),
  reconciling: z.literal(false).optional(),
  current: z.object({
    splits: z.array(
      z.object({
        build: z
          .string()
          .regex(
            /^projects\/[a-zA-Z0-9-]+\/locations\/europe-west4\/backends\/alozuri\/builds\/[a-zA-Z0-9-]+$/,
          ),
        percent: z.number(),
      }),
    ),
  }),
});

async function main() {
  const args = new Set(process.argv.slice(2));
  if ([...args].some((arg) => !['--apply', '--force'].includes(arg)))
    throw new Error('Use [--apply] [--force].');
  if (
    args.has('--apply') &&
    (process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      process.env.GITHUB_REF !== 'refs/heads/main')
  )
    throw new Error(
      'Production publishing requires the manual Release production workflow on main.',
    );
  const command = async (name: string, argv: string[], stream = false) => {
    if (stream) console.log(`Running ${name} ${argv.slice(0, 3).join(' ')}…`);
    const result = await execute(name, argv, { maxBuffer: 16 * 1024 * 1024 });
    if (stream) process.stdout.write(result.stdout);
    return result.stdout.trim();
  };
  const sha = (await command('git', ['rev-parse', 'HEAD'])).trim();
  if (process.env.GITHUB_SHA && sha !== process.env.GITHUB_SHA)
    throw new Error('Checkout and requested release commits differ.');
  if (await command('git', ['status', '--porcelain', '--untracked-files=no']))
    throw new Error('Release source must be clean.');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const read = async (name: string): Promise<unknown> =>
    (
      await (
        await auth.getClient()
      ).request({
        url: `https://firebaseapphosting.googleapis.com/v1beta/${name}`,
        method: 'GET',
        timeout: 15_000,
      })
    ).data;
  const web = async () => {
    const traffic = trafficSchema.parse(await read(resource + '/traffic'));
    if (traffic.current.splits.length !== 1 || traffic.current.splits[0].percent !== 100)
      throw new Error('App Hosting must have one stable 100% traffic target.');
    const buildName = traffic.current.splits[0].build;
    const build = z
      .object({
        state: z.literal('READY'),
        source: z.object({ codebase: z.object({ hash: z.string().regex(/^[a-f0-9]{40}$/) }) }),
      })
      .parse(await read(buildName));
    return { sha: build.source.codebase.hash, build: buildName };
  };
  const describe = async () =>
    serviceSchema.parse(
      JSON.parse(
        await command('gcloud', [
          'run',
          'services',
          'describe',
          'alozuri-api',
          ...apiFlags,
          '--format=json',
        ]),
      ),
    );
  let candidateTag: string | undefined;
  const runtime: ReleaseRuntime = {
    live: async () => {
      const serving = await describe(),
        active = serving.status.traffic.filter((target) => target.percent);
      if (active.length !== 1 || active[0].percent !== 100)
        throw new Error('API must have one stable 100% revision before release.');
      const revision = z
        .object({ metadata: z.object({ labels: z.record(z.string(), z.string()).optional() }) })
        .parse(
          JSON.parse(
            await command('gcloud', [
              'run',
              'revisions',
              'describe',
              active[0].revisionName,
              ...apiFlags,
              '--format=json',
            ]),
          ),
        );
      let page = '';
      do {
        const rollouts = z
          .object({
            rollouts: z.array(z.object({ state: z.string() })).optional(),
            nextPageToken: z.string().optional(),
          })
          .parse(
            await read(
              resource +
                '/rollouts?pageSize=100' +
                (page ? '&pageToken=' + encodeURIComponent(page) : ''),
            ),
          );
        if (
          rollouts.rollouts?.some(
            (rollout) => !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(rollout.state),
          )
        )
          throw new Error('An App Hosting rollout is already in progress.');
        page = rollouts.nextPageToken ?? '';
      } while (page);
      const currentWeb = await web();
      return {
        api: revision.metadata.labels?.['git-sha'] ?? null,
        apiRevision: active[0].revisionName,
        web: currentWeb.sha,
        webBuild: currentWeb.build,
      };
    },
    diff: async (base, head) => {
      try {
        return (await command('git', ['diff', '--name-only', '-z', base, head]))
          .split('\0')
          .filter(Boolean);
      } catch {
        return null;
      }
    },
    buildApi: async (commit) => {
      const imageBase = 'europe-west4-docker.pkg.dev/alozuri/alozuri-api/api';
      const tag = imageBase + ':' + commit;
      const before = await describe();
      const config = async (origin: string) =>
        z
          .object({ cartCheckoutMode: z.enum(['live', 'test', 'disabled']) })
          .parse(
            await (
              await fetch(origin + '/v1/config', { signal: AbortSignal.timeout(15_000) })
            ).json(),
          );
      const originalMode = (await config(before.status.url)).cartCheckoutMode;
      await command(
        'gcloud',
        [
          'builds',
          'submit',
          '.',
          '--project=alozuri',
          '--tag=' + tag,
          '--timeout=1200s',
          '--quiet',
        ],
        true,
      );
      const digest = z
        .string()
        .regex(/^sha256:[a-f0-9]{64}$/)
        .parse(
          await command('gcloud', [
            'artifacts',
            'docker',
            'images',
            'describe',
            tag,
            '--project=alozuri',
            '--format=value(image_summary.digest)',
          ]),
        );
      const image = imageBase + '@' + digest;
      const run = process.env.GITHUB_RUN_ID ?? String(Date.now()),
        attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1';
      if (!/^\d+$/.test(run) || !/^\d+$/.test(attempt))
        throw new Error('Invalid release run identifier.');
      candidateTag = 'release-' + run;
      const suffix = 'r' + commit.slice(0, 12) + '-' + run + '-' + attempt;
      await command(
        'gcloud',
        [
          'run',
          'deploy',
          'alozuri-api',
          ...apiFlags,
          '--image=' + image,
          '--no-traffic',
          '--tag=' + candidateTag,
          '--revision-suffix=' + suffix,
          '--labels=git-sha=' + commit,
        ],
        true,
      );
      const candidate = (await describe()).status.traffic.find(
        (target) => target.tag === candidateTag,
      );
      if (!candidate?.url || candidate.revisionName !== 'alozuri-api-' + suffix)
        throw new Error('Candidate revision could not be verified.');
      const health = await fetch(candidate.url + '/health', {
        signal: AbortSignal.timeout(15_000),
      });
      if (
        !health.ok ||
        !z.object({ status: z.literal('ok') }).safeParse(await health.json()).success
      )
        throw new Error('Candidate API health check failed.');
      if ((await config(candidate.url)).cartCheckoutMode !== originalMode)
        throw new Error('Candidate unexpectedly changes payment availability.');
      return { revision: candidate.revisionName, image };
    },
    promoteApi: async (revision) => {
      await command(
        'gcloud',
        [
          'run',
          'services',
          'update-traffic',
          'alozuri-api',
          ...apiFlags,
          '--to-revisions=' + revision + '=100',
        ],
        true,
      );
    },
    rolloutWeb: async (commit) => {
      await command(
        'firebase',
        [
          'apphosting:rollouts:create',
          'alozuri',
          '--project=alozuri',
          '--git-commit=' + commit,
          '--force',
          '--non-interactive',
        ],
        true,
      );
    },
    web,
    cleanup: async () => {
      if (candidateTag)
        await command('gcloud', [
          'run',
          'services',
          'update-traffic',
          'alozuri-api',
          ...apiFlags,
          '--remove-tags=' + candidateTag,
        ]);
    },
    report: async (message) => {
      console.log(message);
      if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n\n');
    },
  };
  await releaseProduction(sha, runtime, args.has('--force'), args.has('--apply'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
