// Operator-only reconciliation from a supplier transaction statement. Dry run by default.
import { readFile } from 'node:fs/promises';
import { applicationDefault, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { documentId } from '../apps/api/src/lib/validation.js';
import {
  recordSupplierCharge,
  supplierChargeInputSchema,
} from '../apps/api/src/lib/supplier-cost.js';
import { refreshSupplierFinancial } from '../apps/api/src/lib/financial-ledger.js';
const args = process.argv.slice(2);
const value = (key: string) => {
  const i = args.indexOf(key);
  if (i < 0 || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Missing ' + key);
  return args[i + 1];
};
const project = z
  .string()
  .regex(/^[a-z][a-z0-9-]{4,62}$/)
  .parse(value('--project'));
const apply = args.includes('--apply');
if (apply && value('--confirm-project') !== project)
  throw new Error('Project confirmation required.');
const records = z
  .array(z.object({ orderId: documentId, charge: supplierChargeInputSchema }).strict())
  .min(1)
  .max(100)
  .parse(JSON.parse(await readFile(value('--file'), 'utf8')));
if (new Set(records.map((r) => r.orderId)).size !== records.length)
  throw new Error('Duplicate order rows.');
const app = initializeApp({ projectId: project, credential: applicationDefault() });
try {
  const db = getFirestore(app);
  // Validate the entire selection before any write. Transactional guards run again when applying.
  for (const record of records)
    await recordSupplierCharge(db, record.orderId, record.charge, false);
  if (apply)
    for (const record of records) {
      const parent = await recordSupplierCharge(db, record.orderId, record.charge);
      await refreshSupplierFinancial(db, parent);
    }
  console.info(
    JSON.stringify({
      dryRun: !apply,
      matched: records.length,
      reconciled: apply ? records.length : 0,
    }),
  );
} finally {
  await deleteApp(app);
}
