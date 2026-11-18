import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { database } from './firebase.js';
/** Conservative cross-instance serialization plus cooldown: at most ~6 requests/s.
 * The 90s crash lease exceeds both supplier HTTP deadlines. Fail closed on DB errors. */
export async function supplierHttp(url: string, init: RequestInit): Promise<Response> {
  if (process.env.BUY_AGAIN_ENABLED !== 'true') return fetch(url, init);
  const db = database(),
    ref = db.doc('serviceLocks/esimAccessHttp'),
    token = randomUUID();
  const deadline = Date.now() + 10_000;
  while (true) {
    const claimed = await db.runTransaction(async (t) => {
      const lock = await t.get(ref);
      if (lock.get('until') > Date.now()) return false;
      t.set(ref, { token, until: Date.now() + 90_000 });
      return true;
    });
    if (claimed) break;
    if (Date.now() >= deadline) throw new Error('Supplier capacity temporarily unavailable.');
    await delay(150);
  }
  try {
    return await fetch(url, init);
  } finally {
    await db.runTransaction(async (t) => {
      const lock = await t.get(ref);
      if (lock.get('token') === token) t.set(ref, { token, until: Date.now() + 150 });
    });
  }
}
