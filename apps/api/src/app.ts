import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { countries, matchPlans } from '../../../packages/shared/src/index.ts';
import { createRepository, type Repository, type Principal } from './lib/repository.js';
import { verifyToken } from './lib/firebase.js';
const code = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .refine((value) => countries.some((c) => c.code === value));
const matchQuery = z.object({
  countries: z
    .string()
    .max(200)
    .transform((s) => s.split(',').map((c) => c.trim().toUpperCase()))
    .pipe(z.array(code).min(1).max(50)),
  minGb: z.coerce.number().finite().min(0).max(10000).default(0),
});
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export async function createApp(
  options: {
    repository?: Repository;
    verify?: (token: string) => Promise<Principal>;
    demo?: boolean;
    logger?: boolean;
    origins?: string[];
  } = {},
) {
  const demo = options.demo ?? process.env.DEMO_MODE !== 'false';
  const repository = options.repository ?? createRepository(demo);
  const verify = options.verify ?? verifyToken;
  const app = Fastify({
    bodyLimit: 64 * 1024,
    logger: options.logger
      ? { redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] }
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
    if (error instanceof z.ZodError)
      return reply.code(400).send({ error: 'Invalid request parameters.' });
    if (error instanceof Error && 'statusCode' in error && error.statusCode === 429)
      return reply.code(429).send({ error: 'Too many requests. Please wait and try again.' });
    return reply.code(503).send({ error: 'The service is temporarily unavailable.' });
  });
  async function identity(header: string | undefined, reply: import('fastify').FastifyReply) {
    if (!header?.startsWith('Bearer ')) {
      await reply.code(401).send({ error: 'Sign in to continue.' });
      return null;
    }
    try {
      return await verify(header.slice(7));
    } catch {
      await reply.code(401).send({ error: 'Your session has expired. Please sign in again.' });
      return null;
    }
  }
  app.get('/health', async () => ({
    status: 'ok',
    mode: demo ? 'preview' : 'catalogue',
    paymentsEnabled: false,
  }));
  app.get('/v1/packages', async (request) => {
    const query = z.object({ country: code.optional() }).parse(request.query);
    const plans = await repository.plans();
    return {
      plans: query.country ? plans.filter((p) => p.countries.includes(query.country!)) : plans,
    };
  });
  app.get('/v1/packages/match', async (request) => {
    const query = matchQuery.parse(request.query);
    return { plans: matchPlans(await repository.plans(), query.countries, query.minGb) };
  });
  app.get<{ Params: { id: string } }>('/v1/packages/:id', async (request, reply) => {
    const id = idSchema.parse(request.params.id);
    const plan = (await repository.plans()).find((p) => p.id === id);
    return plan ? { plan } : reply.code(404).send({ error: 'Plan unavailable.' });
  });
  app.get('/v1/orders', async (request, reply) => {
    const user = await identity(request.headers.authorization, reply);
    if (!user) return;
    return { orders: await repository.orders(user.uid) };
  });
  app.get<{ Params: { id: string } }>('/v1/orders/:id', async (request, reply) => {
    const user = await identity(request.headers.authorization, reply);
    if (!user) return;
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
      z.object({ planId: idSchema }).strict().parse(request.body);
      return reply
        .code(503)
        .send({ error: 'Purchases are not available yet. No payment has been taken.' });
    },
  );
  app.get('/v1/admin/status', async (request, reply) => {
    const user = await identity(request.headers.authorization, reply);
    if (!user) return;
    if (!user.admin) return reply.code(403).send({ error: 'Administrator access required.' });
    return {
      mode: demo ? 'preview' : 'catalogue',
      paymentsEnabled: false,
      supplierConnected: false,
      catalogueCount: (await repository.plans()).length,
    };
  });
  return app;
}
