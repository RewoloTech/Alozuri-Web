import { promoCode } from './promotions.js';
import type { UserProfiles } from './user-profiles.js';
import { checkoutLegalSchema } from './legal.js';
import { CONTRACT_PDF_FILENAME } from './confirmation-order.js';
import { currencySchema } from './exchange-rates.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { database } from './firebase.js';
import { itemsSchema, cartView, CommerceError, type CommerceService } from './commerce.js';
import { mergeCartItems } from '../../../../packages/shared/src/index.ts';
import type { Principal, Repository } from './repository.js';
export function registerCommerceRoutes(
  app: FastifyInstance,
  service: CommerceService | null,
  repository: Repository,
  verify: (token: string) => Promise<Principal>,
  profiles: UserProfiles | null = null,
) {
  async function user(header: string | undefined, required = false) {
    if (!header) {
      if (required) throw new CommerceError('Sign in to sync your cart.', 401);
      return null;
    }
    if (!header.startsWith('Bearer ')) throw new CommerceError('Invalid account session.', 401);
    try {
      const p = await verify(header.slice(7));
      if (!p.verified) throw new Error();
      return p;
    } catch {
      throw new CommerceError('Sign in with a verified account.', 401);
    }
  }
  function commerce() {
    if (!service)
      throw new CommerceError('Checkout is not configured yet. Please try again later.', 503);
    return service;
  }
  const id = z.string().regex(/^purchase_[a-f0-9]{48}$/),
    unit = z.string().regex(/^order_[a-f0-9]{48}$/);
  app.post(
    '/v2/quote',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req) => {
      const input = z
        .object({
          items: itemsSchema,
          currency: currencySchema,
          promotionCode: promoCode.optional(),
        })
        .strict()
        .parse(req.body);
      return { quote: await commerce().quote(input.items, input.currency, input.promotionCode) };
    },
  );
  app.post(
    '/v2/checkout',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req) => {
      const p = await user(req.headers.authorization);
      const input = z
        .object({
          items: itemsSchema,
          email: z.email().max(254),
          emailConfirmation: z.email().max(254).optional(),
          requestId: z.uuid(),
          compatible: z.literal(true),
          legal: checkoutLegalSchema,
          currency: currencySchema,
          promotionCode: promoCode.optional(),
          expectedTotalCents: z.number().int().positive(),
        })
        .strict()
        .parse(req.body);
      if (p && profiles) {
        const profile = await profiles.sync(p, undefined, false);
        if (!profile.emailVerified)
          throw new CommerceError('Sign in with a verified account.', 401);
      }
      return commerce().checkout(input, p);
    },
  );
  app.get<{ Params: { id: string } }>('/v2/orders/:id', async (req) =>
    commerce().order(
      id.parse(req.params.id),
      await user(req.headers.authorization),
      z.string().max(200).optional().parse(req.headers['x-order-access']),
    ),
  );
  app.get<{ Params: { id: string } }>(
    '/v2/orders/:id/contract.pdf',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      z.object({}).strict().parse(req.query);
      const pdf = await commerce().contractPdf(
        id.parse(req.params.id),
        await user(req.headers.authorization),
        z.string().max(200).optional().parse(req.headers['x-order-access']),
      );
      return reply
        .type('application/pdf')
        .header('Content-Disposition', `attachment; filename="${CONTRACT_PDF_FILENAME}"`)
        .header('X-Robots-Tag', 'noindex, nofollow')
        .send(pdf);
    },
  );
  app.get<{ Params: { id: string; unit: string } }>(
    '/v2/orders/:id/units/:unit/activation',
    async (req) => ({
      activation: await commerce().activation(
        id.parse(req.params.id),
        unit.parse(req.params.unit),
        await user(req.headers.authorization),
        z.string().max(200).optional().parse(req.headers['x-order-access']),
      ),
    }),
  );
  app.get<{ Params: { id: string; unit: string } }>(
    '/v2/orders/:id/units/:unit/usage',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => {
      z.object({}).strict().parse(req.query);
      return {
        usage: await commerce().usage(
          id.parse(req.params.id),
          unit.parse(req.params.unit),
          await user(req.headers.authorization),
          z.string().max(200).optional().parse(req.headers['x-order-access']),
        ),
      };
    },
  );
  app.get('/v2/orders', async (req) => ({
    orders: await commerce().history((await user(req.headers.authorization, true))!),
  }));
  app.get('/v2/cart', async (req) => {
    const p = (await user(req.headers.authorization, true))!,
      doc = await database().collection('carts').doc(p.uid).get();
    const items = itemsSchema.parse(doc.get('items') || []);
    return {
      items: await cartView(repository, items, doc.get('snapshots') || {}),
      version: doc.get('version') || 0,
    };
  });
  app.post('/v2/cart/merge', async (req) => {
    const p = (await user(req.headers.authorization, true))!,
      input = z.object({ items: itemsSchema, mergeId: z.uuid() }).strict().parse(req.body),
      db = database(),
      ref = db.collection('carts').doc(p.uid);
    const incoming = await cartView(repository, input.items);
    const result = await db.runTransaction(async (t) => {
      const doc = await t.get(ref),
        version = doc.get('version') || 0,
        merges = z.array(z.string()).parse(doc.get('merges') || []),
        existing = itemsSchema.parse(doc.get('items') || []);
      if (merges.includes(input.mergeId))
        return { items: existing, version, snapshots: doc.get('snapshots') || {} };
      const items = mergeCartItems(existing, input.items);
      const snapshots = {
        ...(doc.get('snapshots') || {}),
        ...Object.fromEntries(incoming.map((i) => [i.plan.id, i.plan])),
      };
      t.set(ref, {
        items,
        snapshots,
        version: version + 1,
        merges: [...merges, input.mergeId].slice(-100),
        updatedAt: new Date().toISOString(),
      });
      return { items, version: version + 1, snapshots };
    });
    return {
      items: await cartView(repository, result.items, result.snapshots),
      version: result.version,
    };
  });
  app.put('/v2/cart', async (req) => {
    const p = (await user(req.headers.authorization, true))!,
      input = z
        .object({ items: itemsSchema, version: z.number().int().nonnegative() })
        .strict()
        .parse(req.body),
      db = database(),
      ref = db.collection('carts').doc(p.uid);
    const previous = await ref.get();
    const lines = await cartView(repository, input.items, previous.get('snapshots') || {});
    const version = await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if ((doc.get('version') || 0) !== input.version)
        throw new CommerceError(
          'Your cart changed on another device. Reload before continuing.',
          409,
        );
      t.set(
        ref,
        {
          items: input.items,
          snapshots: Object.fromEntries(lines.map((line) => [line.plan.id, line.plan])),
          version: input.version + 1,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      return input.version + 1;
    });
    return { items: lines, version };
  });
}
