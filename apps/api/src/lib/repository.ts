import { type CustomerOrder, type Plan } from '../../../../packages/shared/src/index.ts';
import { demoPlans } from '../../../../packages/shared/src/demo.ts';
import { database } from './firebase.js';
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
  const syncedAt = Date.parse(plan.syncedAt);
  if (syncedAt > now || syncedAt <= now - 36 * 60 * 60 * 1000) return null;
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
          .where('active', '==', true)
          .get()
          .then((docs) =>
            docs.docs.map((d) => cataloguePlan(d.data())).filter((p): p is Plan => p !== null),
          )
          .catch((error) => {
            cache = undefined;
            throw error;
          });
      }
      return (await cache).filter((p) => Date.parse(p.syncedAt) > Date.now() - 36 * 60 * 60 * 1000);
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
