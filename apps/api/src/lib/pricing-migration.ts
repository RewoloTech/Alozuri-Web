import { Timestamp, FieldPath, type Firestore } from 'firebase-admin/firestore';
import { storedPlanSchema } from './validation.js';
import { pricePackage, samePackage } from './package-pricing.js';
import { PRICING_VERSION } from './pricing.js';

export function migrationPatch(
  id: string,
  data: Record<string, unknown>,
  now = Timestamp.now(),
): Record<string, unknown> {
  if (data.providerId && data.providerId !== 'esim-access') return {};
  const parsed = storedPlanSchema.safeParse({ ...data, id });
  if (
    !parsed.success ||
    typeof data.supplierCode !== 'string' ||
    (data.providerId && data.providerId !== 'esim-access')
  )
    return { active: false, pricingStatus: 'review_required' };
  const priced = pricePackage(
    {
      ...parsed.data,
      supplierCode: data.supplierCode,
      wholesaleUnits: typeof data.wholesaleUnits === 'number' ? data.wholesaleUnits : 0,
      providerId: 'esim-access',
    },
    data,
    now,
  );
  const {
    packageId,
    supplier,
    supplierCostUsdCents,
    sellingPriceUsdCents,
    pricingVersion,
    pricingUpdatedAt,
    priceOverrideUsdCents,
    pricingStatus,
    catalogueDate,
    priceCents,
    active,
  } = priced;
  return {
    wholesaleUnits: priced.wholesaleUnits,
    packageId,
    supplier,
    supplierCostUsdCents,
    sellingPriceUsdCents,
    pricingVersion,
    pricingUpdatedAt,
    priceOverrideUsdCents,
    pricingStatus,
    catalogueDate,
    priceCents,
    active,
  };
}
export async function migratePricing(db: Firestore, apply = false) {
  const report = {
    version: PRICING_VERSION,
    mode: apply ? 'apply' : 'dry-run',
    scanned: 0,
    changed: 0,
    reviewRequired: 0,
    increased: 0,
    decreased: 0,
  };
  let after: string | undefined;
  for (;;) {
    let query = db.collection('packages').orderBy(FieldPath.documentId()).limit(200);
    if (after) query = query.startAfter(after);
    const page = await query.get();
    if (page.empty) break;
    if (apply) {
      const counts = await db.runTransaction(async (t) => {
        const backups = page.docs.map((d) =>
          db.doc(`pricingMigrations/${PRICING_VERSION}/packages/${d.id}`),
        );
        const snapshots = await t.getAll(...page.docs.map((d) => d.ref), ...backups);
        const docs = snapshots.slice(0, page.size);
        const result = { changed: 0, reviewRequired: 0, increased: 0, decreased: 0 };
        for (const [index, doc] of docs.entries()) {
          if (!doc.exists) continue;
          const old = doc.data()!,
            patch = migrationPatch(doc.id, old);
          if (patch.pricingStatus === 'review_required') result.reviewRequired++;
          if (typeof patch.priceCents === 'number' && typeof old.priceCents === 'number') {
            if (patch.priceCents > old.priceCents) result.increased++;
            if (patch.priceCents < old.priceCents) result.decreased++;
          }
          if (!samePackage(old, patch)) {
            if (!snapshots[page.size + index].exists)
              t.create(backups[index], { before: old, migratedAt: Timestamp.now() });
            t.update(doc.ref, patch);
            result.changed++;
          }
        }
        return result;
      });
      report.changed += counts.changed;
      report.reviewRequired += counts.reviewRequired;
      report.increased += counts.increased;
      report.decreased += counts.decreased;
    } else
      for (const doc of page.docs) {
        const old = doc.data(),
          patch = migrationPatch(doc.id, old);
        if (!samePackage(old, patch)) report.changed++;
        if (patch.pricingStatus === 'review_required') report.reviewRequired++;
        if (typeof patch.priceCents === 'number' && typeof old.priceCents === 'number') {
          if (patch.priceCents > old.priceCents) report.increased++;
          if (patch.priceCents < old.priceCents) report.decreased++;
        }
      }
    report.scanned += page.size;
    after = page.docs.at(-1)!.id;
  }
  return report;
}
