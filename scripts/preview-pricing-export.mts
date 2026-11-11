// Read-only preview of a private Firestore catalogue export. Never connects to Firebase or Stripe.
import { readFileSync } from 'node:fs';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { migrationPatch } from '../apps/api/src/lib/pricing-migration.ts';
import { samePackage } from '../apps/api/src/lib/package-pricing.ts';
import { PRICING_VERSION } from '../apps/api/src/lib/pricing.ts';
const path = process.argv[2];
if (!path) throw new Error('Provide a private catalogue export JSON path.');
const records = z
  .array(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) }))
  .parse(JSON.parse(readFileSync(path, 'utf8')));
const report = {
  version: PRICING_VERSION,
  mode: 'dry-run',
  scanned: records.length,
  changed: 0,
  increased: 0,
  decreased: 0,
  unchangedPrice: 0,
  reviewRequired: 0,
};
for (const { id, data } of records) {
  if (typeof data.pricingUpdatedAt === 'string')
    data.pricingUpdatedAt = Timestamp.fromDate(new Date(data.pricingUpdatedAt));
  const patch = migrationPatch(id, data);
  if (!samePackage(data, patch)) report.changed++;
  if (patch.pricingStatus === 'review_required') report.reviewRequired++;
  if (typeof patch.priceCents === 'number' && typeof data.priceCents === 'number') {
    if (patch.priceCents > data.priceCents) report.increased++;
    else if (patch.priceCents < data.priceCents) report.decreased++;
    else report.unchangedPrice++;
  }
}
console.log(JSON.stringify(report));
