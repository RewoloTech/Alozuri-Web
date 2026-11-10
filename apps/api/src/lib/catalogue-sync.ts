import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { database } from './firebase.js';
import { SupplierClient, adaptPackage } from './supplier.js';
export async function verifySyncIdentity(header: string | undefined) {
  const audience = process.env.CATALOGUE_SYNC_AUDIENCE,
    email = process.env.CATALOGUE_SYNC_SERVICE_ACCOUNT;
  if (!audience || !email || !header?.startsWith('Bearer ')) return false;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: header.slice(7), audience });
    const p = ticket.getPayload();
    return p?.email === email && p.email_verified === true;
  } catch {
    return false;
  }
}
export async function syncCatalogue(supplier = new SupplierClient()) {
  const db = database(),
    state = db.doc('catalogueSync/state'),
    runId = randomUUID(),
    now = Date.now();
  await db.runTransaction(async (t) => {
    const doc = await t.get(state);
    if (doc.get('leaseUntil') > now) throw new Error('Catalogue sync is already running.');
    t.set(state, { runId, leaseUntil: now + 10 * 60 * 1000, status: 'running' }, { merge: true });
  });
  try {
    const source = await supplier.packages(),
      syncedAt = new Date().toISOString();
    const plans = source.map((p) => adaptPackage(p, syncedAt)).filter((p) => p !== null);
    if (plans.length < 1)
      throw new Error('No supported fixed-data plans returned; catalogue preserved.');
    // Refuse a severe shrink instead of accidentally disabling most of a healthy catalogue.
    const existing = await db.collection('packages').get();
    const activeCount = existing.docs.filter((d) => d.get('active') === true).length;
    if (activeCount > 100 && plans.length < activeCount * 0.5)
      throw new Error('Unexpected catalogue shrink; catalogue preserved.');
    const ids = new Set(plans.map((p) => p.id));
    const writes = [
      ...plans.map((p) => ({ ref: db.collection('packages').doc(p.id), data: p })),
      ...existing.docs
        .filter((d) => !ids.has(d.id) && d.get('active') === true)
        .map((d) => ({ ref: d.ref, data: { active: false } })),
    ];
    for (let offset = 0; offset < writes.length; offset += 400) {
      const batch = db.batch();
      for (const w of writes.slice(offset, offset + 400)) batch.set(w.ref, w.data, { merge: true });
      await batch.commit();
    }
    const result = {
      fetched: source.length,
      active: plans.length,
      unsupported: source.length - plans.length,
      syncedAt,
    };
    await state.set({ ...result, status: 'complete', leaseUntil: 0, runId });
    return result;
  } catch (error) {
    await state.set(
      { status: 'failed', leaseUntil: 0, runId, lastAttemptAt: new Date().toISOString() },
      { merge: true },
    );
    throw error;
  }
}
