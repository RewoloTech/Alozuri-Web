// Dry-run by default. No supplier orders, Stripe calls, deployments or order rewrites.
import { database } from '../apps/api/src/lib/firebase.ts';
import { migratePricing } from '../apps/api/src/lib/pricing-migration.ts';
import { PRICING_VERSION } from '../apps/api/src/lib/pricing.ts';

const apply = process.argv.includes('--apply');
const project = process.env.GOOGLE_CLOUD_PROJECT;
if (!project) throw new Error('Set GOOGLE_CLOUD_PROJECT explicitly.');
if (
  apply &&
  !process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.PRICING_MIGRATION_APPROVED !== `${project}:${PRICING_VERSION}`
)
  throw new Error(
    'Live apply is locked. Review the dry-run and approve the exact project/version before setting PRICING_MIGRATION_APPROVED.',
  );
const db = database();
try {
  console.log(JSON.stringify(await migratePricing(db, apply)));
} finally {
  await db.terminate();
}
