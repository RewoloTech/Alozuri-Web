import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Principal } from './repository.js';
import { ProfileError, type UserProfiles } from './user-profiles.js';
export function registerProfileRoutes(
  app: FastifyInstance,
  profiles: UserProfiles | null,
  verify: (token: string) => Promise<Principal>,
) {
  async function identity(request: FastifyRequest) {
    z.object({}).strict().parse(request.query);
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new ProfileError('Sign in to access your profile.', 401);
    let user: Principal;
    try {
      user = await verify(header.slice(7));
    } catch {
      throw new ProfileError('Sign in to access your profile.', 401);
    }
    if (!profiles) throw new ProfileError('Profiles are not configured.', 503);
    return { user, profiles };
  }
  app.get(
    '/v2/profile',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request) => {
      const { user, profiles } = await identity(request);
      return { profile: await profiles.read(user) };
    },
  );
  app.post(
    '/v2/profile',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const { user, profiles } = await identity(request);
      z.object({})
        .strict()
        .parse(request.body ?? {});
      return { profile: await profiles.sync(user) };
    },
  );
  app.patch(
    '/v2/profile',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { user, profiles } = await identity(request);
      return { profile: await profiles.update(user, request.body) };
    },
  );
}
