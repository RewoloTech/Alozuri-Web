import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { database } from './firebase.js';
import { EsimAccessCatalogue, type CatalogueProvider } from './catalogue-provider.js';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { pricePackage, samePackage, packageWrite, pricingDecision } from './package-pricing.js';
import { publishFeaturedBundles } from './featured-bundles.js';
import type { StoredPlan } from '../../../../packages/shared/src/index.ts';
import { storedPlanSchema } from './validation.js';
import {
  curateCatalogue,
  curationKey,
  decisionHash,
  assertCuratedCatalogue,
} from './catalogue-curation.js';
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
export async function syncCatalogue(
  provider: CatalogueProvider = new EsimAccessCatalogue(),
  db: Firestore = database(),
) {
  if (!/^[a-z][a-z0-9-]{1,49}$/.test(provider.id)) throw new Error('Invalid catalogue provider.');
  const state = db.doc('catalogueSync/' + provider.id),
    runId = randomUUID(),
    now = Date.now();
  await db.runTransaction(async (t) => {
    const doc = await t.get(state);
    if (doc.get('leaseUntil') > now) throw new Error('Catalogue sync is already running.');
    t.set(state, { runId, leaseUntil: now + 10 * 60 * 1000, status: 'running' }, { merge: true });
  });
  try {
    const syncedAt = new Date().toISOString();
    const { fetched, plans } = await provider.fetch(syncedAt);
    if (
      plans.some((p) => p.providerId !== provider.id || !storedPlanSchema.safeParse(p).success) ||
      new Set(plans.map((p) => p.id)).size !== plans.length
    )
      throw new Error('Invalid or duplicate provider products.');
    if (plans.length < 1) throw new Error('No supported plans returned; catalogue preserved.');
    // Refuse a severe shrink instead of accidentally disabling most of a healthy catalogue.
    const existing = await db.collection('packages').get();
    const owns = (d: FirebaseFirestore.QueryDocumentSnapshot) =>
      d.get('providerId') === provider.id ||
      (provider.id === 'esim-access' && !d.get('providerId'));
    const owned = existing.docs.filter(owns);
    const existingById = new Map(existing.docs.map((d) => [d.id, d]));
    if (
      plans.some((p) => {
        const d = existingById.get(p.id);
        return d && !owns(d);
      })
    )
      throw new Error('Provider product identifier collision.');
    const activeCount = owned.filter((d) => d.get('active') === true).length;
    if (activeCount > 100 && plans.length < activeCount * 0.5)
      throw new Error('Unexpected catalogue shrink; catalogue preserved.');
    const ids = new Set(plans.map((p) => p.id));
    const unsortedWrites = [
      ...plans.map((p) => ({ ref: db.collection('packages').doc(p.id), data: p })),
      ...owned
        .filter((d) => !ids.has(d.id) && d.get('active') === true)
        .map((d) => ({ ref: d.ref, data: { active: false, pricingStatus: 'review_required' } })),
    ];
    // Keep each comparison family in one transaction, including fresh overrides.
    const families = new Map<string, typeof unsortedWrites>();
    for (const write of unsortedWrites) {
      const key = 'id' in write.data ? curationKey(write.data) : write.ref.id;
      const family = families.get(key) ?? [];
      family.push(write);
      families.set(key, family);
    }
    const chunks: (typeof unsortedWrites)[] = [];
    let nextChunk: typeof unsortedWrites = [];
    for (const family of families.values()) {
      if (family.length > 150)
        throw new Error('Comparison family too large; review supplier catalogue.');
      if (nextChunk.length + family.length > 150) {
        chunks.push(nextChunk);
        nextChunk = [];
      }
      nextChunk.push(...family);
    }
    if (nextChunk.length) chunks.push(nextChunk);
    const pricedSource: StoredPlan[] = [];
    let written = 0,
      available = 0,
      reviewRequired = 0,
      hidden = 0;
    for (const chunk of chunks) {
      const counts = await db.runTransaction(async (t) => {
        const [lease, ...docs] = await t.getAll(state, ...chunk.map((w) => w.ref));
        if (lease.get('runId') !== runId || lease.get('leaseUntil') <= Date.now())
          throw new Error('Catalogue lease lost.');
        const candidates = chunk.flatMap((w, i) =>
          'id' in w.data ? [pricePackage(w.data, docs[i].data() || {}, Timestamp.now(), true)] : [],
        );
        const priced = curateCatalogue(candidates);
        assertCuratedCatalogue(priced);
        const byId = new Map(priced.map((p) => [p.id, p]));
        let count = 0,
          active = 0,
          review = 0,
          hiddenCount = 0;
        for (let i = 0; i < chunk.length; i++) {
          const w = chunk[i],
            previous = docs[i].data() || {};
          const calculated = byId.get(w.ref.id);
          const data = calculated ?? w.data;
          if (calculated) {
            if (!calculated.active) review++;
            else if (calculated.catalogueVisibility === 'hidden') hiddenCount++;
            else active++;
          }
          const before = pricingDecision(previous),
            after = pricingDecision(calculated ? data : { ...previous, ...data });
          if (
            calculated &&
            decisionHash(before) === decisionHash(after) &&
            previous.pricingUpdatedAt instanceof Timestamp
          )
            calculated.pricingUpdatedAt = previous.pricingUpdatedAt;
          if (!samePackage(previous, data)) {
            t.set(w.ref, 'id' in data ? packageWrite(data) : data, { merge: true });
            if (decisionHash(before) !== decisionHash(after)) {
              const historyId = decisionHash({ before, after, date: syncedAt.slice(0, 10) });
              t.set(w.ref.collection('pricingHistory').doc(historyId), {
                before,
                after,
                runId,
                recordedAt: Timestamp.now(),
              });
            }
            count++;
          }
        }
        return { count, active, review, hidden: hiddenCount, priced };
      });
      pricedSource.push(...counts.priced);
      written += counts.count;
      available += counts.active;
      reviewRequired += counts.review;
      hidden += counts.hidden;
    }
    const result = {
      providerId: provider.id,
      fetched,
      active: available,
      reviewRequired,
      hidden,
      written,
      unsupported: fetched - plans.length,
      syncedAt,
    };
    if (provider.id === 'esim-access')
      await publishFeaturedBundles(db, pricedSource, runId, state, result);
    else
      await db.runTransaction(async (transaction) => {
        const lease = await transaction.get(state);
        if (lease.get('runId') !== runId) throw new Error('Catalogue lease lost.');
        transaction.set(state, { ...result, status: 'complete', leaseUntil: 0, runId });
      });
    return result;
  } catch (error) {
    await db.runTransaction(async (transaction) => {
      const lease = await transaction.get(state);
      if (lease.get('runId') === runId)
        transaction.set(
          state,
          { status: 'failed', leaseUntil: 0, runId, lastAttemptAt: new Date().toISOString() },
          { merge: true },
        );
    });
    throw error;
  }
}
