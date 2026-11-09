import {
  retailPlan,
  type CustomerOrder,
  type Plan,
  type StoredPlan,
} from '../../../../packages/shared/src/index.ts';
import { demoPlans } from '../../../../packages/shared/src/demo.ts';
import { database } from './firebase.js';
export type Principal = { uid: string; verified: boolean; admin: boolean };
export interface Repository {
  plans(): Promise<Plan[]>;
  orders(uid: string): Promise<CustomerOrder[]>;
  order(uid: string, id: string): Promise<CustomerOrder | null>;
}
// Deliberately allowlist customer fields. Wholesale and activation secrets are never spread into a response.
export function customerOrder(id: string, data: FirebaseFirestore.DocumentData): CustomerOrder {
  return {
    id,
    plan: retailPlan(data.plan as StoredPlan),
    status: data.status,
    createdAt: data.createdAt,
    amountCents: data.amountCents,
    currency: data.currency,
    refundRequested: data.refundRequested === true,
  };
}
export function ownedOrder(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
  uid: string,
): CustomerOrder | null {
  return data && data.uid === uid ? customerOrder(id, data) : null;
}
export function createRepository(demo: boolean): Repository {
  if (demo)
    return { plans: async () => demoPlans, orders: async () => [], order: async () => null };
  return {
    async plans() {
      const docs = await database().collection('packages').where('active', '==', true).get();
      const cutoff = Date.now() - 12 * 60 * 60 * 1000;
      return docs.docs
        .map((d) => d.data() as StoredPlan)
        .filter((p) => Date.parse(p.syncedAt) > cutoff)
        .map(retailPlan);
    },
    async orders(uid) {
      const docs = await database().collection('orders').where('uid', '==', uid).limit(100).get();
      return docs.docs
        .map((d) => customerOrder(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async order(uid, id) {
      const doc = await database().collection('orders').doc(id).get();
      const data = doc.data();
      return ownedOrder(doc.id, data, uid);
    },
  };
}
