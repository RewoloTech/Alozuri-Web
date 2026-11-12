import { createHash } from 'node:crypto';
import type { Principal } from './repository.js';
export function purchaseOwnerUid(id: string, uid: string | null) {
  return uid ?? 'guest_' + createHash('sha256').update(id).digest('hex').slice(0, 24);
}
export function ownsPurchase(
  purchase: { uid: string | null; email: string },
  user: Principal | null,
) {
  return Boolean(
    user?.verified &&
    (purchase.uid === user.uid ||
      (purchase.uid === null && user.email?.toLowerCase() === purchase.email.toLowerCase())),
  );
}
