import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { FinancialLedger, refreshSupplierFinancial } from '../src/lib/financial-ledger.ts';
import { initialFinancial } from '../src/lib/financial-calculations.ts';
import { FieldValue } from 'firebase-admin/firestore';
import { recordSupplierCharge } from '../src/lib/supplier-cost.ts';
import { OperationsReports } from '../src/lib/operations.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }, 'financial-tests'),
  db = getFirestore(app);
let serial = 0;
async function fixture(promoted = false) {
  const id = 'purchase_' + (++serial).toString(16).padStart(48, '0');
  const source = {
    uid: null,
    email: 'sample@example.test',
    createdAt: '2025-02-15T12:00:00.000Z',
    paidAt: '2025-02-15T12:00:01.000Z',
    status: 'paid',
    test: false,
    ...(promoted
      ? {
          promotion: { id: 'SAVE10', code: 'SAVE10', discountPercent: 10 },
          discountCents: 222,
          originalRetailCents: 2222,
        }
      : {}),
    totalCents: 2000,
    currency: 'GBP',
    paymentIntentId: 'pi_financial_' + serial,
    items: [
      {
        quantity: 2,
        wholesaleUnits: 50000,
        exchange: { source: 'fixture', asOf: '2025-02-15', numerator: '8', denominator: '10' },
        plan: { name: 'France', countries: ['FR'], priceCents: 1000, currency: 'GBP' },
      },
    ],
  };
  const ref = db.collection('purchases').doc(id);
  await ref.set({ ...source, financial: initialFinancial(id, 'purchases', source, null, true) });
  const units = [];
  for (let i = 0; i < 2; i++) {
    const unit = db.collection('orders').doc('order_' + `${serial}${i}`.padStart(48, '0'));
    await unit.set({
      uid: 'guest-' + id,
      parentOrderId: id,
      createdAt: source.createdAt,
      paidAt: source.paidAt,
      status: 'ready',
      test: false,
      amountCents: 1000,
      currency: 'GBP',
      plan: source.items[0].plan,
      wholesaleUnits: 50000,
      supplierOrderNo: 'supplier-' + i,
      supplierCharge: {
        amountUnits: 50000,
        currency: 'USD',
        supplierOrderNo: 'supplier-' + i,
        source: 'supplier_statement',
        reference: 'statement-fixture-' + serial + '-' + i,
        verifiedAt: source.paidAt,
      },
    });
    units.push(unit);
  }
  const intent = {
    id: source.paymentIntentId,
    livemode: true,
    amount: 2000,
    currency: 'gbp',
    metadata: { alozuriPurchaseId: id },
    latest_charge: 'ch_financial',
  };
  const charge = {
    id: 'ch_financial',
    amount: 2000,
    amount_refunded: 0,
    payment_intent: intent.id,
    disputed: false,
    balance_transaction: {
      id: 'txn_charge',
      amount: 2000,
      fee: 50,
      currency: 'gbp',
      exchange_rate: null,
    },
  };
  const refunds: {
    id: string;
    status: string;
    amount: number;
    balance_transaction: {
      id: string;
      amount: number;
      fee: number;
      currency: string;
      exchange_rate: null;
    } | null;
  }[] = [];
  const signer = new Stripe('sk_test_fixture');
  const stripe = {
    paymentIntents: { retrieve: async () => intent },
    charges: { retrieve: async () => charge },
    refunds: { list: () => ({ autoPagingToArray: async () => refunds }) },
    webhooks: signer.webhooks,
  } as unknown as Stripe;
  return {
    id,
    ref,
    source,
    units,
    charge,
    refunds,
    ledger: new FinancialLedger(db, stripe, 'whsec_financial', true),
    signer,
  };
}
test('financial events are idempotent, historical and private from catalogue changes', async () => {
  const f = await fixture();
  await f.ledger.sync(f.ref);
  let row = (await f.ref.get()).get('financial');
  assert.equal(row.profitGbp, 1150);
  assert.equal(row.calculationStatus, 'final');
  await db.collection('packages').doc('unrelated-current-plan').set({ wholesaleUnits: 99999999 });
  const body = JSON.stringify({
    id: 'evt_financial',
    type: 'charge.updated',
    livemode: true,
    data: { object: { id: 'ch_financial', payment_intent: f.source.paymentIntentId } },
  });
  const signature = f.signer.webhooks.generateTestHeaderString({
    payload: body,
    secret: 'whsec_financial',
  });
  await f.ledger.webhook(Buffer.from(body), signature);
  await f.ledger.webhook(Buffer.from(body), signature);
  row = (await f.ref.get()).get('financial');
  assert.equal(row.supplier.purchasedUnits, 100000);
  assert.equal(row.supplier.quotedUnits, 100000);
  assert.equal(row.profitGbp, 1150);
  assert.equal(row.stripe.balanceTransactions.length, 1);
  await assert.rejects(f.ledger.webhook(Buffer.from(body), 'invalid'));
});
test('partial/full refunds and missing balance transactions never erase booked supplier costs', async () => {
  const f = await fixture();
  f.refunds.push({
    id: 're_one',
    status: 'succeeded',
    amount: 1000,
    balance_transaction: {
      id: 'txn_refund',
      amount: -1000,
      fee: 0,
      currency: 'gbp',
      exchange_rate: null,
    },
  });
  await f.ledger.sync(f.ref);
  let row = (await f.ref.get()).get('financial');
  assert.equal(row.selling.refundedMinor, 1000);
  assert.equal(row.profitGbp, 150);
  f.refunds[0].amount = 2000;
  f.refunds[0].balance_transaction!.amount = -2000;
  await f.ledger.sync(f.ref);
  row = (await f.ref.get()).get('financial');
  assert.equal(row.profitGbp, -850);
  assert.equal(row.marginBps, null);
  f.refunds[0].balance_transaction = null;
  await f.ledger.sync(f.ref);
  row = (await f.ref.get()).get('financial');
  assert.equal(row.calculationStatus, 'pending');
  assert.equal(row.feesGbp, null);
  assert.equal(row.profitGbp, null);
});
test('supplier failures remain recoverable and unknown outcomes cannot be booked as zero', async () => {
  const f = await fixture();
  await f.units[0].update({ supplierOrderNo: null, status: 'provision_error' });
  // null is not a valid supplier reference: malformed data stays pending, never zero.
  await refreshSupplierFinancial(db, f.ref);
  assert.equal((await f.ref.get()).get('financial.supplier.purchasedUnits'), null);
  await f.units[0].set({
    uid: 'guest',
    createdAt: f.source.createdAt,
    paidAt: f.source.paidAt,
    parentOrderId: f.id,
    status: 'refunded',
    test: false,
    currency: 'GBP',
    amountCents: 1000,
    plan: f.source.items[0].plan,
    wholesaleUnits: 50000,
    supplierRejected: true,
  });
  await refreshSupplierFinancial(db, f.ref);
  assert.equal((await f.ref.get()).get('financial.supplier.purchasedUnits'), 50000);
});

test('verified payment changes mark prior financial totals pending until Stripe reconciliation', async () => {
  const f = await fixture();
  await f.ledger.sync(f.ref);
  await f.ref.update({ financialReconciliationPending: true });
  const reports = new OperationsReports(db);
  const report = await reports.report({ from: '2025-02-15', to: '2025-02-15' });
  const row = report.rows.find((r) => r.id === f.id);
  assert.ok(row);
  assert.equal(row.selling.refundedMinor, null);
  assert.equal(row.revenueGbp, null);
  assert.equal(row.profitGbp, null);
  assert.equal(row.calculationStatus, 'pending');
  await f.ledger.sync(f.ref);
  assert.equal((await f.ref.get()).get('financialReconciliationPending'), false);
});
test('date scoped reports paginate without double-counting child orders or test payments', async () => {
  for (let i = 0; i < 28; i++) {
    const f = await fixture();
    await f.ledger.sync(f.ref);
  }
  const testRef = db.collection('purchases').doc('purchase_test');
  const f = await fixture();
  await testRef.set({ ...f.source, test: true });
  const report = new OperationsReports(db);
  const first = await report.report({ from: '2025-02-15', to: '2025-02-15' });
  assert.equal(first.rows.length, 25);
  assert.ok(first.trends);
  assert.equal(
    first.trends.points.reduce((n, p) => n + p.orders, 0),
    first.summary.sales,
  );
  assert.equal(
    first.trends.topPlans.reduce((n, p) => n + p.quantity, 0),
    first.summary.sales * 2,
  );
  assert.equal(first.trends.points.find((p) => p.orders)?.revenueGbp, first.summary.revenueGbp);
  assert.ok(!JSON.stringify(first.trends).includes('@'));

  assert.ok(first.nextCursor);
  assert.equal(first.summary.records, serial);
  const second = await report.report({
    from: '2025-02-15',
    to: '2025-02-15',
    cursor: first.nextCursor!,
  });
  assert.equal(second.rows.length, serial - 25);
  assert.ok(second.rows.every((r) => !first.rows.some((p) => p.id === r.id)));
  assert.equal(second.summary.sales, first.summary.sales);
  const empty = await report.report({ from: '2025-02-16', to: '2025-02-16' });
  assert.equal(empty.summary.sales, 0);
  await assert.rejects(
    report.report({ from: '2025-02-16', to: '2025-02-16', cursor: first.nextCursor! }),
  );
});
test.after(async () => {
  await deleteApp(app);
});

test('supplier quotes are provisional; exact immutable statement charges reconcile all purchased units', async () => {
  const f = await fixture();
  for (const unit of f.units) await unit.update({ supplierCharge: FieldValue.delete() });
  await f.ledger.sync(f.ref);
  let row = (await f.ref.get()).get('financial');
  assert.equal(row.fulfilmentStatus, 'fulfilled');
  assert.equal(row.supplier.purchasedUnits, 100000);
  assert.equal(row.supplier.verifiedUnits, null);
  assert.equal(row.calculationStatus, 'pending');
  const evidence = {
    amountUnits: 48000,
    currency: 'USD',
    supplierOrderNo: 'supplier-0',
    source: 'supplier_statement',
    reference: 'statement-actual-0',
  };
  await assert.rejects(
    recordSupplierCharge(db, f.units[0].id, { ...evidence, supplierOrderNo: 'wrong-order' }),
  );
  await assert.rejects(recordSupplierCharge(db, f.units[0].id, { ...evidence, currency: 'GBP' }));
  await recordSupplierCharge(db, f.units[0].id, evidence);
  const originalReceipt = (await f.units[0].get()).get('supplierCharge');
  await recordSupplierCharge(db, f.units[0].id, evidence);
  assert.deepEqual((await f.units[0].get()).get('supplierCharge'), originalReceipt);
  await assert.rejects(
    recordSupplierCharge(db, f.units[0].id, { ...evidence, amountUnits: 47000 }),
  );
  await refreshSupplierFinancial(db, f.ref);
  assert.equal((await f.ref.get()).get('financial.supplier.verifiedUnits'), null);
  await recordSupplierCharge(db, f.units[1].id, {
    ...evidence,
    supplierOrderNo: 'supplier-1',
    reference: 'statement-actual-1',
  });
  await refreshSupplierFinancial(db, f.ref);
  row = (await f.ref.get()).get('financial');
  assert.equal(row.supplier.quotedUnits, 100000);
  assert.equal(row.supplier.purchasedUnits, 100000);
  assert.equal(row.supplier.verifiedUnits, 96000);
  assert.equal(row.profitGbp, 1182);
  assert.equal(row.calculationStatus, 'final');
  await f.ledger.sync(f.ref);
  assert.equal((await f.ref.get()).get('financial.supplier.verifiedUnits'), 96000);
  await f.units[0].update({ supplierCharge: { ...originalReceipt, supplierOrderNo: 'mismatch' } });
  await refreshSupplierFinancial(db, f.ref);
  assert.equal((await f.ref.get()).get('financial.supplier.verifiedUnits'), null);
  assert.equal((await f.ref.get()).get('financial.calculationStatus'), 'pending');
});

test('operator statement command validates dry runs and preserves quotes when applying actual charges', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { promisify } = await import('node:util');
  const { execFile } = await import('node:child_process');
  const run = promisify(execFile);
  const f = await fixture();
  for (const unit of f.units) await unit.update({ supplierCharge: FieldValue.delete() });
  await f.ledger.sync(f.ref);
  const dir = await mkdtemp(join(tmpdir(), 'alozuri-cost-statement-'));
  try {
    const file = join(dir, 'statement.json');
    await writeFile(
      file,
      JSON.stringify(
        f.units.map((unit, i) => ({
          orderId: unit.id,
          charge: {
            amountUnits: 48000,
            currency: 'USD',
            supplierOrderNo: 'supplier-' + i,
            source: 'supplier_statement',
            reference: 'statement-cli-' + i,
          },
        })),
      ),
      { mode: 0o600 },
    );
    const args = [
      '--import',
      'tsx',
      'scripts/reconcile-supplier-cost.mts',
      '--project',
      'demo-alozuri',
      '--file',
      file,
    ];
    const dry = await run(process.execPath, args);
    assert.deepEqual(JSON.parse(dry.stdout), { dryRun: true, matched: 2, reconciled: 0 });
    assert.equal((await f.units[0].get()).get('supplierCharge'), undefined);
    const apply = [...args, '--apply', '--confirm-project', 'demo-alozuri'];
    const result = await run(process.execPath, apply);
    assert.equal(JSON.parse(result.stdout).reconciled, 2);
    await run(process.execPath, apply);
    const row = (await f.ref.get()).get('financial');
    assert.equal(row.supplier.quotedUnits, 100000);
    assert.equal(row.supplier.verifiedUnits, 96000);
    assert.equal(row.profitGbp, 1182);
    assert.equal(row.calculationStatus, 'final');
    await assert.rejects(
      run(process.execPath, [...args, '--apply', '--confirm-project', 'wrong-project']),
    );
    await f.units[0].update({ test: true });
    await assert.rejects(run(process.execPath, args));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('promoted partial/full refunds preserve original discount, frozen cost and checkout estimate in date reports', async () => {
  const f = await fixture(true);
  await f.ledger.sync(f.ref);
  const initial = (await f.ref.get()).get('financial');
  assert.equal(initial.selling.discountMinor, 222);
  assert.equal(initial.checkoutEstimate.currency, 'GBP');
  for (const refunded of [1000, 2000]) {
    f.charge.amount_refunded = refunded;
    f.refunds.splice(0, f.refunds.length, {
      id: 're_promoted',
      status: 'succeeded',
      amount: refunded,
      balance_transaction: {
        id: 'txn_promoted',
        amount: -refunded,
        fee: 0,
        currency: 'gbp',
        exchange_rate: null,
      },
    });
    await f.ledger.sync(f.ref);
    const financial = (await f.ref.get()).get('financial');
    assert.equal(financial.selling.refundedMinor, refunded);
    assert.equal(financial.selling.discountMinor, 222);
    assert.deepEqual(financial.checkoutEstimate, initial.checkoutEstimate);
    assert.equal(financial.supplier.verifiedUnits, 100000);
    assert.equal(financial.profitGbp, 2000 - refunded - 800 - 50);
    const report = await new OperationsReports(db).report({ from: '2025-02-15', to: '2025-02-15' });
    const promotion = report.promotions?.find((p) => p.code === 'SAVE10');
    assert.equal(promotion?.revenueMinor, 2000 - refunded);
    assert.equal(promotion?.discountMinor, 222);
  }
});
