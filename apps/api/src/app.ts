import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { matchPlans, isCountryCode, countryName } from '../../../packages/shared/src/index.ts';
import { createRepository, type Repository, type Principal } from './lib/repository.js';
import { verifyToken } from './lib/firebase.js';
import { syncCatalogue, verifySyncIdentity } from './lib/catalogue-sync.js';
import {
  configuredPayments,
  CheckoutError,
  registerStripeWebhook,
  type PaymentService,
} from './lib/payments.js';
import {
  configuredFulfillment,
  verifyFulfillmentIdentity,
  type FulfillmentService,
} from './lib/fulfillment.js';
import { configuredCommerce, CommerceError, type CommerceService } from './lib/commerce.js';
import { registerCommerceRoutes } from './lib/commerce-routes.js';
import { documentId } from './lib/validation.js';
import { registerEsimWebhook, type EsimWebhookInbox } from './lib/esim-webhook.js';
const code = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .refine((value) => isCountryCode(value));
const matchQuery = z
  .object({
    countries: z
      .string()
      .max(200)
      .transform((s) => s.split(',').map((c) => c.trim().toUpperCase()))
      .pipe(z.array(code).min(1).max(50)),
    minGb: z.coerce.number().finite().min(0).max(10000).default(0),
    dataType: z.enum(['all', 'fixed', 'daily', 'unlimited']).default('all'),
    coverage: z.enum(['all', 'local']).default('all'),
  })
  .strict();
const idSchema = documentId;
export async function createApp(
  options: {
    repository?: Repository;
    verify?: (token: string) => Promise<Principal>;
    demo?: boolean;
    logger?: boolean;
    origins?: string[];
    payments?: PaymentService | null;
    commerce?: CommerceService | null;
    fulfillment?: FulfillmentService | null;
    esimWebhook?: { token?: string; inbox?: EsimWebhookInbox };
  } = {},
) {
  const demo = options.demo ?? process.env.DEMO_MODE !== 'false';
  const repository = options.repository ?? createRepository(demo);
  const verify = options.verify ?? verifyToken;
  const payments = options.payments === undefined ? configuredPayments() : options.payments;
  const fulfillment =
    options.fulfillment === undefined ? configuredFulfillment() : options.fulfillment;
  const commerce = options.commerce === undefined ? configuredCommerce() : options.commerce;
  const app = Fastify({
    bodyLimit: 64 * 1024,
    logger: options.logger
      ? {
          redact: [
            'req.url',
            'req.headers.authorization',
            'req.headers["x-order-access"]',
            'req.headers.cookie',
            'res.headers.set-cookie',
          ],
        }
      : false,
  });
  await app.register(cors, {
    origin:
      options.origins ??
      (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim()),
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'no-store');
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CommerceError)
      return reply.code(error.statusCode).send({ error: error.message });
    if (error instanceof CheckoutError) return reply.code(400).send({ error: error.message });
    if (error instanceof z.ZodError)
      return reply.code(400).send({ error: 'Invalid request parameters.' });
    if (error instanceof Error && 'statusCode' in error) {
      if (error.statusCode === 429)
        return reply.code(429).send({ error: 'Too many requests. Please wait and try again.' });
      if (error.statusCode === 400 || error.statusCode === 413 || error.statusCode === 415)
        return reply.code(error.statusCode).send({ error: 'Invalid request body.' });
    }
    return reply.code(503).send({ error: 'The service is temporarily unavailable.' });
  });
  async function identity(header: string | undefined, reply: import('fastify').FastifyReply) {
    if (!header?.startsWith('Bearer ')) {
      await reply.code(401).send({ error: 'Sign in to continue.' });
      return null;
    }
    try {
      const user = await verify(header.slice(7));
      if (!user.verified) {
        await reply.code(403).send({ error: 'Verify your email before entering your account.' });
        return null;
      }
      return user;
    } catch {
      await reply.code(401).send({ error: 'Your session has expired. Please sign in again.' });
      return null;
    }
  }
  registerEsimWebhook(app, options.esimWebhook);
  await registerStripeWebhook(app, payments, commerce);
  registerCommerceRoutes(app, commerce, repository, verify);
  app.get('/v1/config', async () => ({
    paymentMode: payments?.mode ?? 'disabled',
    catalogueMode: demo ? 'preview' : 'live',
    cartCheckoutMode: commerce?.mode ?? 'disabled',
    supportedCurrencies: ['USD'],
    fulfillmentMode: payments?.mode === 'live' ? 'esim_access' : 'test_no_issuance',
  }));
  app.post('/internal/catalogue/sync', async (request, reply) => {
    if (!(await verifySyncIdentity(request.headers.authorization)))
      return reply.code(401).send({ error: 'Scheduler authentication required.' });
    z.object({})
      .strict()
      .parse(request.body ?? {});
    const result = await syncCatalogue();
    repository.invalidate?.();
    return result;
  });
  app.post('/internal/fulfillment/run', async (request, reply) => {
    if (!(await verifyFulfillmentIdentity(request.headers.authorization)))
      return reply.code(401).send({ error: 'Worker authentication required.' });
    z.object({})
      .strict()
      .parse(request.body ?? {});
    z.object({}).strict().parse(request.query);
    if (!fulfillment) return reply.code(503).send({ error: 'Delivery is not configured.' });
    const result = await fulfillment.run();
    await commerce?.notify();
    if (result.failed) {
      app.log.error({ failed: result.failed }, 'Delivery reconciliation failed.');
      return reply.code(503).send(result);
    }
    return result;
  });
  app.get<{ Params: { id: string } }>('/v1/orders/:id/activation', async (request, reply) => {
    const user = await identity(request.headers.authorization, reply);
    if (!user) return;
    const id = idSchema.parse(request.params.id);
    z.object({}).strict().parse(request.query);
    if (!fulfillment)
      return reply.code(503).send({ error: 'Installation details are unavailable.' });
    const activation = await fulfillment.activation(user.uid, id);
    return activation
      ? { activation }
      : reply.code(404).send({ error: 'Installation details are not available for this order.' });
  });
  app.get('/v1/countries', async () => {
    const codes = [...new Set((await repository.plans()).flatMap((p) => p.countries))];
    return {
      countries: codes
        .filter(isCountryCode)
        .map((code) => ({
          code,
          name: countryName(code),
          flag: String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))),
          region: 'Available destinations',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
  app.get('/health', async () => ({
    status: 'ok',
    mode: demo ? 'preview' : 'catalogue',
    paymentsEnabled: Boolean(payments),
    paymentMode: payments?.mode ?? 'disabled',
  }));
  app.get('/v1/packages', async (request) => {
    const query = z.object({ country: code.optional() }).strict().parse(request.query);
    const plans = await repository.plans();
    return {
      plans: query.country ? plans.filter((p) => p.countries.includes(query.country!)) : plans,
    };
  });
  app.get('/v1/packages/match', async (request) => {
    const query = matchQuery.parse(request.query);
    const matches = matchPlans(
      await repository.plans(),
      query.countries,
      query.minGb,
      query.dataType,
    );
    return {
      plans: query.coverage === 'local' ? matches.filter((p) => p.countries.length === 1) : matches,
    };
  });
  app.get<{ Params: { id: string } }>('/v1/packages/:id', async (request, reply) => {
    z.object({}).strict().parse(request.query);
    const id = idSchema.parse(request.params.id);
    const plan = (await repository.plans()).find((p) => p.id === id);
    return plan ? { plan } : reply.code(404).send({ error: 'Plan unavailable.' });
  });
  app.get('/v1/orders', async (request, reply) => {
    const user = await identity(request.headers.authorization, reply);
    if (!user) return;
    z.object({}).strict().parse(request.query);
    return { orders: await repository.orders(user.uid) };
  });
  app.get<{ Params: { id: string } }>('/v1/orders/:id', async (request, reply) => {
    const user = await identity(request.headers.authorization, reply);
    if (!user) return;
    z.object({}).strict().parse(request.query);
    const id = idSchema.parse(request.params.id);
    const order = await repository.order(user.uid, id);
    return order ? { order } : reply.code(404).send({ error: 'Order not found.' });
  });
  app.post(
    '/v1/checkout',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const user = await identity(request.headers.authorization, reply);
      if (!user) return;
      if (!user.verified)
        return reply.code(403).send({ error: 'Verify your email before purchasing.' });
      z.object({}).strict().parse(request.query);
      const input = z
        .object({
          planId: idSchema,
          requestId: z.string().uuid().optional(),
          compatible: z.literal(true).optional(),
          ui: z.enum(['hosted', 'embedded']).default('hosted'),
        })
        .strict()
        .parse(request.body);
      if (payments) {
        if (!input.requestId || !input.compatible)
          return reply
            .code(400)
            .send({ error: 'Confirm device compatibility and provide a checkout request ID.' });
        return reply
          .code(410)
          .send({ error: 'Checkout has moved. Open /checkout to pay for your cart.' });
      }
      return reply
        .code(503)
        .send({ error: 'Purchases are not available yet. No payment has been taken.' });
    },
  );
  app.post<{ Params: { id: string } }>(
    '/v1/orders/:id/payment-status',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const user = await identity(request.headers.authorization, reply);
      if (!user) return;
      const id = idSchema.parse(request.params.id);
      z.object({}).strict().parse(request.query);
      z.object({})
        .strict()
        .parse(request.body ?? {});
      if (!payments) return reply.code(503).send({ error: 'Payments are not configured.' });
      return payments.status(user, id);
    },
  );
  app.post<{ Params: { id: string } }>(
    '/v1/orders/:id/resume-checkout',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const user = await identity(request.headers.authorization, reply);
      if (!user) return;
      const id = idSchema.parse(request.params.id);
      z.object({}).strict().parse(request.query);
      z.object({})
        .strict()
        .parse(request.body ?? {});
      if (!payments) return reply.code(503).send({ error: 'Payments are not configured.' });
      return payments.resume(user, id);
    },
  );
  app.get('/v1/admin/status', async (request, reply) => {
    const user = await identity(request.headers.authorization, reply);
    if (!user) return;
    if (!user.admin) return reply.code(403).send({ error: 'Administrator access required.' });
    return {
      mode: demo ? 'preview' : 'catalogue',
      paymentsEnabled: Boolean(payments),
      paymentMode: payments?.mode ?? 'disabled',
      supplierConnected: !demo,
      catalogueCount: (await repository.plans()).length,
    };
  });
  return app;
}
