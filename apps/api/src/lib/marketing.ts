import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { FastifyInstance } from 'fastify';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';
import { database } from './firebase.js';
import {
  bannerSchema,
  campaignSchema,
  marketingId,
  activeWindow,
  campaignStatus,
} from './marketing-policy.js';
import { Promotions, eligibility, promoCode, promotionInput } from './promotions.js';
import {
  promotionConfigHash,
  matchesPromotion,
  discountedUnit,
  promotionMarginAllowed,
} from './promotion-policy.js';
import { cataloguePlan } from './repository.js';
import { priceExchange } from './exchange-rates.js';
import { OperationsError } from './operations-error.js';
export class Marketing {
  constructor(private db: Firestore) {}
  async list() {
    const [campaigns, banners, promotions] = await Promise.all([
      this.db.collection('marketingCampaigns').limit(501).get(),
      this.db.collection('websiteBanners').limit(501).get(),
      this.db.collection('promotions').limit(501).get(),
    ]);
    if ([campaigns, banners, promotions].some((p) => p.size > 500))
      throw new OperationsError('Marketing capacity requires review.', 409);
    const campaignsView = campaigns.docs.map((d) => ({
      ...campaignSchema.parse(d.data()),
      status: campaignStatus(campaignSchema.parse(d.data())),
    }));
    const linkedStatus = (
      value: { active: boolean; startsAt: string; expiresAt: string },
      campaignId: unknown,
    ) => {
      const status = campaignStatus(value);
      return status === 'active' && typeof campaignId === 'string'
        ? (campaignsView.find((c) => c.id === campaignId)?.status ?? 'paused')
        : status;
    };
    const bannersView = banners.docs.map((d) => ({
      ...bannerSchema.parse(d.data()),
      status: linkedStatus(bannerSchema.parse(d.data()), d.get('campaignId')),
    }));
    const promotionRows = promotions.docs.map((d) => ({
      id: d.id,
      name: d.get('name') ?? d.id,
      expiresAt: z.iso.datetime().parse(d.get('expiresAt')),
      campaignId: d.get('campaignId') ?? null,
      status: linkedStatus(
        z
          .object({ active: z.boolean(), startsAt: z.iso.datetime(), expiresAt: z.iso.datetime() })
          .parse(d.data()),
        d.get('campaignId'),
      ),
      totals: d.get('totals') ?? {},
    }));
    const catalogue = await this.db
      .collection('packages')
      .where('active', '==', true)
      .limit(1001)
      .get();
    const blockedPackages: { promotionId: string; productId: string }[] = [];
    for (const doc of promotions.docs) {
      const config = promotionInput.strip().parse(doc.data());
      if (!activeWindow(config)) continue;
      if (
        config.campaignId &&
        !campaignsView.some((c) => c.id === config.campaignId && c.status === 'active')
      )
        continue;
      for (const product of catalogue.docs.slice(0, 1000)) {
        const plan = cataloguePlan(product.data());
        if (!plan || !matchesPromotion(config, plan)) continue;
        try {
          const final = discountedUnit(plan.priceCents, config, priceExchange('USD'));
          if (
            !promotionMarginAllowed(
              final,
              'USD',
              product.get('wholesaleUnits'),
              priceExchange('USD'),
            )
          )
            blockedPackages.push({ promotionId: config.code, productId: product.id });
        } catch {
          blockedPackages.push({ promotionId: config.code, productId: product.id });
        }
      }
    }
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const paid = await this.db
      .collection('purchases')
      .where('paidAt', '>=', since)
      .limit(1001)
      .get();
    const groups = new Map<
      string,
      {
        campaign: string;
        currency: string;
        revenueMinor: number;
        discountMinor: number;
        estimatedContributionMinor: number | null;
        purchases: Set<string>;
      }
    >();
    let marginWarnings = 0,
      excludedRecords = 0;
    const saleSchema = z.object({
      currency: z.enum(['USD', 'GBP', 'EUR']),
      totalCents: z.number().int().positive().safe(),
      promotion: z.object({ id: z.string(), campaignId: z.string().optional() }).optional(),
      financial: z
        .object({
          checkoutEstimate: z
            .object({ contributionMinor: z.number().int().safe(), marginBps: z.number().int() })
            .nullable()
            .optional(),
        })
        .optional(),
      items: z.array(
        z.object({
          plan: z.object({ priceCents: z.number().int().positive().safe() }),
          quantity: z.number().int().min(1).max(5),
          originalPriceCents: z.number().int().positive().optional(),
          automaticPromotion: z
            .object({ id: z.string(), campaignId: z.string().optional() })
            .optional(),
        }),
      ),
    });
    for (const doc of paid.docs.slice(0, 1000)) {
      const parsed = saleSchema.safeParse(doc.data());
      if (!parsed.success) {
        excludedRecords++;
        continue;
      }
      const sale = parsed.data;
      if ((sale.financial?.checkoutEstimate?.marginBps ?? 10000) < 1500) marginWarnings++;
      for (const line of sale.items) {
        const promotion = sale.promotion ?? line.automaticPromotion;
        if (
          !promotion ||
          !line.originalPriceCents ||
          line.originalPriceCents <= line.plan.priceCents
        )
          continue;
        const campaign = promotion.campaignId ?? promotion.id,
          key = campaign + ':' + sale.currency;
        const group = groups.get(key) ?? {
          campaign,
          currency: sale.currency,
          revenueMinor: 0,
          discountMinor: 0,
          estimatedContributionMinor: 0,
          purchases: new Set<string>(),
        };
        const revenue = line.plan.priceCents * line.quantity;
        group.revenueMinor += revenue;
        group.discountMinor += (line.originalPriceCents - line.plan.priceCents) * line.quantity;
        group.purchases.add(doc.id);
        const contribution = sale.financial?.checkoutEstimate?.contributionMinor;
        group.estimatedContributionMinor =
          contribution === undefined || group.estimatedContributionMinor === null
            ? null
            : group.estimatedContributionMinor +
              Number((BigInt(contribution) * BigInt(revenue)) / BigInt(sale.totalCents));
        groups.set(key, group);
      }
    }
    return {
      performance: {
        since,
        truncated: paid.size > 1000,
        excludedRecords,
        rows: [...groups.values()].map(({ purchases, ...row }) => ({
          ...row,
          purchases: purchases.size,
        })),
      },
      campaigns: campaignsView,
      banners: bannersView,
      promotions: promotionRows,
      overview: {
        marginWarnings: blockedPackages.length,
        blockedPackages,
        catalogueTruncated: catalogue.size > 1000,
        historicalMarginWarnings: marginWarnings,
        activePromotions: promotionRows.filter((p) => p.status === 'active').length,
        scheduledPromotions: promotionRows.filter((p) => p.status === 'scheduled').length,
        announcements: bannersView.filter(
          (b) => b.placement === 'announcement' && b.status === 'active',
        ).length,
        homepageBanners: bannersView.filter(
          (b) => b.placement === 'homepage' && b.status === 'active',
        ).length,
        upcomingExpirations: [...campaignsView, ...bannersView, ...promotionRows]
          .filter((p) => p.status === 'active')
          .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
          .slice(0, 8),
      },
    };
  }
  async save(kind: 'campaigns' | 'banners', input: unknown, actor: string) {
    const value = kind === 'campaigns' ? campaignSchema.parse(input) : bannerSchema.parse(input);
    const ref = this.db.doc(
      (kind === 'campaigns' ? 'marketingCampaigns/' : 'websiteBanners/') + value.id,
    );
    await this.db.runTransaction(async (t) => {
      const old = await t.get(ref);
      if (
        'campaignId' in value &&
        value.campaignId &&
        !(await t.get(this.db.doc('marketingCampaigns/' + value.campaignId))).exists
      )
        throw new OperationsError('Campaign not found.', 400);
      if (
        'promotionId' in value &&
        value.promotionId &&
        !(await t.get(this.db.doc('promotions/' + promoCode.parse(value.promotionId)))).exists
      )
        throw new OperationsError('Promotion not found.', 400);

      t.set(this.db.doc('marketingState/current'), { revision: randomUUID() });
      t.set(ref, value);
      t.create(this.db.collection('marketingAudit').doc(), {
        actor,
        action: 'save_' + kind,
        target: value.id,
        at: new Date().toISOString(),
        previous: old.data() ?? null,
        value,
      });
    });
  }
  async remove(kind: 'campaigns' | 'banners', id: string, actor: string) {
    marketingId.parse(id);
    const ref = this.db.doc(
      (kind === 'campaigns' ? 'marketingCampaigns/' : 'websiteBanners/') + id,
    );
    await this.db.runTransaction(async (t) => {
      const old = await t.get(ref);
      if (kind === 'campaigns') {
        const references = await Promise.all(
          ['promotions', 'websiteBanners'].map((c) =>
            t.get(this.db.collection(c).where('campaignId', '==', id).limit(1)),
          ),
        );
        if (references.some((r) => !r.empty))
          throw new OperationsError('Linked campaigns must be paused, not deleted.', 409);
      }
      if (!old.exists) throw new OperationsError('Not found.', 404);
      t.set(this.db.doc('marketingState/current'), { revision: randomUUID() });
      t.delete(ref);
      t.create(this.db.collection('marketingAudit').doc(), {
        actor,
        action: 'delete_' + kind,
        target: id,
        at: new Date().toISOString(),
        previous: old.data(),
      });
    });
  }
  async published() {
    if (process.env.MARKETING_ENABLED !== 'true') return [];
    const docs = await this.db
      .collection('websiteBanners')
      .where('active', '==', true)
      .limit(501)
      .get();
    if (docs.size > 500) throw new OperationsError('Marketing capacity requires review.', 503);
    const rows = [];
    let catalogue: FirebaseFirestore.QuerySnapshot | undefined;
    for (const doc of docs.docs) {
      const banner = bannerSchema.parse(doc.data());
      if (!activeWindow(banner)) continue;
      if (banner.campaignId) {
        const campaign = await this.db.doc('marketingCampaigns/' + banner.campaignId).get();
        if (!campaign.exists || !activeWindow(campaignSchema.parse(campaign.data()))) continue;
        banner.expiresAt = new Date(
          Math.min(Date.parse(banner.expiresAt), Date.parse(campaign.get('expiresAt'))),
        ).toISOString();
      }
      if (banner.promotionId) {
        try {
          const promotions = new Promotions(this.db),
            config = await promotions.get(banner.promotionId);
          eligibility(config);
          banner.expiresAt = new Date(
            Math.min(Date.parse(banner.expiresAt), Date.parse(config.expiresAt)),
          ).toISOString();
          if (config.campaignId) {
            const campaign = await this.db.doc('marketingCampaigns/' + config.campaignId).get();
            if (!campaign.exists || !activeWindow(campaignSchema.parse(campaign.data()))) continue;
            banner.expiresAt = new Date(
              Math.min(Date.parse(banner.expiresAt), Date.parse(campaign.get('expiresAt'))),
            ).toISOString();
          }
          catalogue ??= await this.db
            .collection('packages')
            .where('active', '==', true)
            .limit(1000)
            .get();
          const available = catalogue.docs.some((d) => {
            const plan = cataloguePlan(d.data());
            if (!plan || !matchesPromotion(config, plan)) return false;
            try {
              promotions.apply(plan, d.get('wholesaleUnits'), config, priceExchange('USD'));
              return true;
            } catch {
              return false;
            }
          });
          if (!available) continue;
        } catch {
          continue;
        }
      }
      rows.push(banner);
    }
    return rows.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }
}
export interface MarketingAssets {
  save(id: string, bytes: Buffer, contentType: string): Promise<void>;
  read(id: string): NodeJS.ReadableStream;
}
const configuredAssets: MarketingAssets = {
  async save(id, bytes, contentType) {
    const bucket = process.env.MARKETING_ASSET_BUCKET;
    if (!bucket) throw new OperationsError('Marketing image storage is not configured.', 503);
    await getStorage()
      .bucket(bucket)
      .file('marketing/' + id)
      .save(bytes, {
        resumable: false,
        metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      });
  },
  read(id) {
    const bucket = process.env.MARKETING_ASSET_BUCKET;
    if (!bucket) throw new OperationsError('Marketing image storage is not configured.', 503);
    return getStorage()
      .bucket(bucket)
      .file('marketing/' + id)
      .createReadStream();
  },
};
export function registerMarketing(
  app: FastifyInstance,
  authorize: (header: string | undefined) => Promise<{ uid: string }>,
  assets: MarketingAssets = configuredAssets,
) {
  app.get('/v1/marketing', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const banners = (await new Marketing(database()).published()).map((b) => ({
      ...b,
      revision: createHash('sha256').update(JSON.stringify(b)).digest('hex'),
    }));
    const automatic = await new Promotions(database()).automatic();
    return {
      banners,
      revision: createHash('sha256')
        .update(
          JSON.stringify([
            banners,
            automatic.map((p) => [promotionConfigHash(p), p.startsAt, p.expiresAt]),
            process.env.MARKETING_ENABLED === 'true'
              ? ((await database().doc('marketingState/current').get()).get('revision') ?? null)
              : null,
          ]),
        )
        .digest('hex'),
      checkedAt: new Date().toISOString(),
    };
  });
  app.get('/v1/operations/marketing', async (req) => {
    await authorize(req.headers.authorization);
    return new Marketing(database()).list();
  });
  app.put('/v1/operations/marketing/:kind', async (req) => {
    const actor = await authorize(req.headers.authorization);
    const { kind } = z.object({ kind: z.enum(['campaigns', 'banners']) }).parse(req.params);
    await new Marketing(database()).save(kind, req.body, actor.uid);
    return { saved: true };
  });
  app.delete('/v1/operations/marketing/:kind/:id', async (req) => {
    const actor = await authorize(req.headers.authorization);
    const { kind, id } = z
      .object({ kind: z.enum(['campaigns', 'banners']), id: marketingId })
      .parse(req.params);
    await new Marketing(database()).remove(kind, id, actor.uid);
    return { deleted: true };
  });
  app.post('/v1/operations/marketing/images', { bodyLimit: 800_000 }, async (req) => {
    const actor = await authorize(req.headers.authorization);
    const input = z
      .object({
        content: z.string().max(700_000),
        contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
      })
      .strict()
      .parse(req.body);
    const bytes = Buffer.from(input.content, 'base64');
    const type = bytes.subarray(0, 8).toString('hex').startsWith('89504e470d0a1a0a')
      ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? 'image/jpeg'
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
          ? 'image/webp'
          : '';
    if (type !== input.contentType || bytes.length < 16 || bytes.length > 500_000)
      throw new OperationsError('Use a PNG, JPEG or WebP image under 500 KB.', 400);
    const id = randomUUID();
    await assets.save(id, bytes, type);
    await database()
      .doc('marketingAssets/' + id)
      .create({ type, actor: actor.uid, createdAt: new Date().toISOString() });
    return { path: '/v1/marketing/images/' + id };
  });
  app.get('/v1/marketing/images/:id', async (req, reply) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const metadata = await database()
      .doc('marketingAssets/' + id)
      .get();
    if (!metadata.exists) return reply.code(404).send();
    reply
      .header(
        'Content-Type',
        z.enum(['image/png', 'image/jpeg', 'image/webp']).parse(metadata.get('type')),
      )
      .header('Cache-Control', 'public,max-age=31536000,immutable')
      .header('X-Content-Type-Options', 'nosniff');
    return reply.send(assets.read(id));
  });
}
