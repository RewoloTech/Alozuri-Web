import { type CustomerOrder, type Plan } from '../../../../packages/shared/src/index.ts';
import { demoPlans } from '../../../../packages/shared/src/demo.ts';
import { database } from './firebase.js';
import { currentCatalogueDate, validPackagePricing, catalogueDate } from './package-pricing.js';
import { z } from 'zod';
import { documentId, orderSchema, storedPlanSchema, planSchema } from './validation.js';
export type Principal = { uid: string; verified: boolean; admin: boolean; email?: string };
export interface Repository {
  plans(): Promise<Plan[]>;
  orders(uid: string): Promise<CustomerOrder[]>;
  order(uid: string, id: string): Promise<CustomerOrder | null>;
  invalidate?(): void;
}
// Deliberately allowlist customer fields. Wholesale and activation secrets are never spread into a response.
export function customerOrder(id: string, data: FirebaseFirestore.DocumentData): CustomerOrder {
  const parsed = orderSchema.safeParse(data);
  if (!documentId.safeParse(id).success || !parsed.success)
    throw new Error('Invalid stored order.');
  const order = parsed.data;
  return {
    id,
    plan: order.plan,
    status: order.status,
    createdAt: order.createdAt,
    amountCents: order.amountCents,
    currency: order.currency,
    refundRequested: order.refundRequested === true,
    ...(order.test ? { test: true } : {}),
  };
}
export function ownedOrder(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
  uid: string,
): CustomerOrder | null {
  return data && data.uid === uid ? customerOrder(id, data) : null;
}
export function cataloguePlan(data: unknown, now = Date.now()): Plan | null {
  const parsed = storedPlanSchema.safeParse(data);
  if (!parsed.success || !parsed.data.active) return null;
  const plan = parsed.data;
  const privateData = z.record(z.string(), z.unknown()).safeParse(data);
  if (
    !privateData.success ||
    privateData.data.catalogueVisibility === 'hidden' ||
    !validPackagePricing(privateData.data)
  )
    return null;
  if (
    !currentCatalogueDate(privateData.data.catalogueDate, now) ||
    privateData.data.catalogueDate !== catalogueDate(plan.syncedAt) ||
    Date.parse(plan.syncedAt) > now
  )
    return null;
  return planSchema.parse(plan);
}
export function createRepository(demo: boolean): Repository {
  if (demo)
    return { plans: async () => demoPlans, orders: async () => [], order: async () => null };
  let cache: Promise<Plan[]> | undefined;
  let expires = 0;
  return {
    invalidate() {
      cache = undefined;
      expires = 0;
    },
    async plans() {
      if (!cache || Date.now() >= expires) {
        expires = Date.now() + 5 * 60 * 1000;
        cache = database()
          .collection('packages')
          .where('catalogueDate', 'in', [catalogueDate(), catalogueDate(Date.now() - 86400000)])
          .get()
          .then((docs) =>
            docs.docs.map((d) => cataloguePlan(d.data())).filter((p): p is Plan => p !== null),
          )
          .catch((error) => {
            cache = undefined;
            throw error;
          });
      }
      const snapshot = await cache;
      const visible = snapshot.filter((p) => currentCatalogueDate(catalogueDate(p.syncedAt)));
      // Retain snapshot identity while valid, so the search index is built once per cache refresh.
      return visible.length === snapshot.length ? snapshot : visible;
    },
    async orders(uid) {
      const docs = await database().collection('orders').where('uid', '==', uid).limit(100).get();
      return docs.docs
        .map((d) => ownedOrder(d.id, d.data(), uid))
        .filter((order): order is CustomerOrder => order !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async order(uid, id) {
      const doc = await database().collection('orders').doc(id).get();
      const data = doc.data();
      return ownedOrder(doc.id, data, uid);
    },
  };
}
