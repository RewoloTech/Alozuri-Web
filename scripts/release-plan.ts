// Pure release selection: each target is compared with its own live commit.
export function changedTargets(paths: string[]) {
  let api = false,
    web = false;
  for (const file of paths) {
    if (
      ['package.json', 'package-lock.json', 'tsconfig.base.json', 'turbo.json'].includes(file) ||
      file.startsWith('packages/shared/src/') ||
      file === 'packages/shared/package.json'
    ) {
      api = web = true;
    }
    if (
      /^apps\/api\/(src|assets|scripts)\//.test(file) ||
      [
        'Dockerfile',
        '.dockerignore',
        '.gcloudignore',
        'apps/api/package.json',
        'apps/api/tsconfig.json',
      ].includes(file)
    )
      api = true;
    if (
      /^apps\/web\/(src|public)\//.test(file) ||
      [
        'apps/web/package.json',
        'apps/web/tsconfig.json',
        'apps/web/next.config.ts',
        'apps/web/postcss.config.mjs',
        'apps/web/apphosting.yaml',
      ].includes(file)
    )
      web = true;
  }
  return { api, web };
}
export async function releasePlan(
  sha: string,
  live: { api: string | null; web: string | null },
  diff: (base: string, head: string) => Promise<string[] | null>,
  force = false,
) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('An exact release commit is required.');
  const target = async (kind: 'api' | 'web') => {
    const previous = live[kind];
    if (force || !previous || !/^[a-f0-9]{40}$/.test(previous)) return true;
    if (previous === sha) return false;
    const paths = await diff(previous, sha);
    // Missing old Git objects are treated conservatively, never as no changes.
    return paths === null || changedTargets(paths)[kind];
  };
  return { sha, api: await target('api'), web: await target('web') };
}
