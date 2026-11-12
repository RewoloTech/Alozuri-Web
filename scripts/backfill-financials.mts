import { applicationDefault, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { FinancialLedger, refreshSupplierFinancial } from '../apps/api/src/lib/financial-ledger.js';
import { londonBounds } from '../apps/api/src/lib/financial-calculations.js';
import Stripe from 'stripe';
const args = process.argv.slice(2);
const value = (key: string) => {
  const index = args.indexOf(key);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error('Missing ' + key);
  return args[index + 1];
};
const from = z.iso.date().parse(value('--from')),
  to = z.iso.date().parse(value('--to'));
const bounds = londonBounds(from, to);
const project = z
  .string()
  .regex(/^[a-z][a-z0-9-]{4,62}$/)
  .parse(value('--project'));
const apply = args.includes('--apply');
if (apply && value('--confirm-project') !== project)
  throw new Error('Use matching --confirm-project to write financial snapshots.');
const app = initializeApp({ projectId: project, credential: applicationDefault() }),
  db = getFirestore(app);
const key = process.env.STRIPE_SECRET_KEY;
const ledger = key
  ? new FinancialLedger(
      db,
      new Stripe(key, { timeout: 15000, maxNetworkRetries: 2 }),
      '',
      key.startsWith('sk_live_'),
    )
  : null;
let eligible = 0,
  updated = 0,
  review = 0;
for (const collection of ['purchases', 'orders']) {
  const docs = await db
    .collection(collection)
    .where('createdAt', '>=', bounds.start)
    .where('createdAt', '<', bounds.end)
    .limit(501)
    .get();
  if (docs.size > 500)
    throw new Error('Select a smaller range (maximum 500 documents per collection).');
  for (const doc of docs.docs) {
    if (doc.get('test') !== false || doc.get('parentOrderId')) continue;
    eligible++;
    if (!apply) continue;
    try {
      if (ledger && doc.get('paymentIntentId')) await ledger.sync(doc.ref);
      else await refreshSupplierFinancial(db, doc.ref);
      updated++;
    } catch {
      review++;
    }
  }
}
console.info(
  JSON.stringify({
    dryRun: !apply,
    eligible,
    updated,
    needsReview: review,
    note: 'No current catalogue prices or current exchange rates are used. Missing historical values remain pending.',
  }),
);
await deleteApp(app);
