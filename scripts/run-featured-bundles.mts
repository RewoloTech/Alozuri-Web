// Defaults to a read-only report. --apply only publishes references for an
// already-priced, successfully synced catalogue. It never reprices live products.
import { writeFile } from 'node:fs/promises';
import { deleteApp, getApps } from 'firebase-admin/app';
import { database } from '../apps/api/src/lib/firebase.ts';
import { cataloguePlan } from '../apps/api/src/lib/repository.ts';
import { catalogueDate, currentCatalogueDate } from '../apps/api/src/lib/package-pricing.ts';
import {
  selectFeaturedBundles,
  bundleRecordSchema,
} from '../apps/api/src/lib/featured-selection.ts';
import { publishFeaturedBundles } from '../apps/api/src/lib/featured-bundles.ts';
import { previewFeaturedPricing } from '../apps/api/src/lib/featured-preview.ts';
const flags = new Set(process.argv.slice(2));
for (const flag of flags)
  if (!['--apply', '--preview-reprice'].includes(flag))
    throw new Error('Unknown bundle-generation flag.');
if (flags.has('--apply') && flags.has('--preview-reprice'))
  throw new Error(
    'A repricing preview cannot publish. Apply the reviewed pricing release separately.',
  );
const db = database();
try {
  const state = await db.doc('catalogueSync/esim-access').get();
  const id = state.get('runId'),
    syncedAt = state.get('syncedAt');
  if (
    state.get('status') !== 'complete' ||
    typeof id !== 'string' ||
    typeof syncedAt !== 'string' ||
    !currentCatalogueDate(catalogueDate(syncedAt))
  )
    throw new Error('A current, successful catalogue sync is required.');
  const docs = await db.collection('packages').where('providerId', '==', 'esim-access').get();
  const source = docs.docs
    .map((doc) => doc.data())
    .filter(
      (row) =>
        typeof row.syncedAt === 'string' && catalogueDate(row.syncedAt) === catalogueDate(syncedAt),
    );
  const rows = flags.has('--preview-reprice') ? source.map(previewFeaturedPricing) : source;
  if (!rows.some((row) => cataloguePlan(row)))
    throw new Error(
      'No current validated retail records. Complete the reviewed pricing release before publishing; --preview-reprice is read-only.',
    );
  const previous = (await db.collection('featured_bundles').get()).docs.flatMap((doc) => {
    const parsed = bundleRecordSchema.safeParse(doc.data());
    return parsed.success ? [parsed.data] : [];
  });
  const bundles = selectFeaturedBundles(rows, previous, id);
  const written = flags.has('--apply') ? await publishFeaturedBundles(db, rows, id, state.ref) : 0;
  const report = {
    mode: flags.has('--preview-reprice')
      ? 'read-only-repricing-preview'
      : flags.has('--apply')
        ? 'published'
        : 'read-only',
    sourceSyncId: id,
    sourceSyncedAt: syncedAt,
    sourceCount: source.length,
    written,
    bundles: bundles.map((row) => ({ ...row, updatedAt: row.updatedAt.toDate().toISOString() })),
  };
  await writeFile('/tmp/alozuri-featured-generation.json', JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        sourceCount: source.length,
        written,
        regions: bundles.map((row) => ({
          region: row.region,
          status: row.status,
          selectedPlanId: row.selectedPlanId,
          defaultDataGb: row.defaultDataGb,
          availableDataGb: Object.keys(row.options),
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await db.terminate();
  await Promise.all(getApps().map((app) => deleteApp(app)));
}
