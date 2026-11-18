import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { type FastifyInstance } from 'fastify';
import {
  type PricingConfig,
  type PricingRow,
  configSchema,
  type PricingWorkspace,
} from '../../../../packages/shared/src/pricing-management.ts';
import { continentOf } from '../../../../packages/shared/src/geography.ts';
import { database } from './firebase.js';
import { storedPlanSchema } from './validation.js';
import { ExchangeRates, priceExchange } from './exchange-rates.js';
import { OperationsError } from './operations-error.js';
import { pricePackage } from './package-pricing.js';
import { curateCatalogue, decisionHash } from './catalogue-curation.js';
import {
  defaults,
  readRules,
  resolvePricing,
  pricingScope,
  type RuleSnapshot,
} from './pricing-rules.js';
import {
  approvedFixed,
  calculatePricing,
  contributionAtRetail,
  profitable,
  PRICING_POLICY,
} from './pricing.js';
import { orderTaskConfig, CloudOrderTaskQueue } from './order-task-queue.js';
import { syncCatalogue } from './catalogue-sync.js';

const source = storedPlanSchema.extend({
  supplierCode: z.string(),
  wholesaleUnits: z.number().int().positive(),
  supplierName: z.string().optional(),
  providerId: z.literal('esim-access').optional(),
  pricingFlags: z.array(z.string()).optional(),
  supplierComparison: z
    .object({
      key: z.string(),
      fup: z.string(),
      fupKbps: z.number().nullable(),
      topupType: z.number(),
      attributes: z.record(z.string(), z.unknown()),
    })
    .optional(),
});
const revision = z.union([z.literal('global'), z.uuid()]);
const conflict = () =>
  new OperationsError('Pricing has changed. Reload the workspace and preview again.', 409);
const versionOf = (doc: FirebaseFirestore.DocumentSnapshot) =>
  revision.parse(doc.get('version') ?? 'global');
export class PricingManagement {
  constructor(
    private db: Firestore,
    private rates = new ExchangeRates(db),
  ) {}
  private refs() {
    return [
      this.db.doc('pricingManagement/active'),
      this.db.doc('pricingManagement/draft'),
    ] as const;
  }
  async workspace(): Promise<PricingWorkspace> {
    const [[active, draft], versions, recent] = await Promise.all([
      this.db.getAll(...this.refs()),
      this.db.collection('pricingVersions').orderBy('date', 'desc').select('date', 'actor').get(),
      this.db
        .collectionGroup('pricingHistory')
        .orderBy('recordedAt', 'desc')
        .limit(50)
        .select('package.name', 'recordedAt', 'before.priceCents', 'after.priceCents')
        .get(),
    ]);
    return {
      recent: recent.docs
        .flatMap((d) => {
          const before = d.get('before.priceCents'),
            after = d.get('after.priceCents'),
            date = d.get('recordedAt');
          if (
            !Number.isSafeInteger(before) ||
            !Number.isSafeInteger(after) ||
            before === after ||
            !(date instanceof Timestamp)
          )
            return [];
          return [
            {
              id: d.ref.path,
              name: String(d.get('package.name') ?? d.ref.parent.parent?.id),
              before: Number(before),
              after: Number(after),
              date: date.toDate().toISOString(),
            },
          ];
        })
        .slice(0, 5),
      activeVersion: versionOf(active),
      revision: versionOf(draft.exists ? draft : active),
      hasDraft: draft.exists,
      config: readRules((draft.exists ? draft : active).get('snapshot')).config,
      job: active.get('job') ?? 'complete',
      versions: versions.docs.map((d) => ({
        id: d.id,
        date: String(d.get('date')),
        actor: String(d.get('actor')),
      })),
    };
  }
  private async catalogue(snapshot: RuleSnapshot) {
    const docs = await this.db.collection('packages').get();
    const products = docs.docs.flatMap((d) => {
      const raw = d.data(),
        parsed = source.safeParse(raw);
      if (!parsed.success || parsed.data.demo || (!raw.active && raw.supplierAvailable !== true))
        return [];
      const plan = parsed.data;
      return [
        {
          raw,
          plan,
          priced: pricePackage(
            { ...plan, active: true },
            raw,
            Timestamp.now(),
            true,
            resolvePricing(plan, snapshot),
          ),
        },
      ];
    });
    const curated = curateCatalogue(products.map((p) => p.priced));
    const parents = { ...snapshot, config: { ...snapshot.config, packages: {}, benchmarks: {} } };
    const rows: PricingRow[] = products.map(({ raw, plan }, i) => {
      const p = curated[i],
        rule = p.managedPricing,
        scope = pricingScope(plan);
      const inherited = resolvePricing(plan, parents) ?? defaults;
      let calc: null | ReturnType<typeof calculatePricing> = null;
      try {
        calc = calculatePricing(p.wholesaleUnits, rule);
      } catch {
        // Retain an unavailable or out-of-range SKU so Operations can repair its pricing.
      }
      const actual =
        p.priceCents > 0
          ? contributionAtRetail(p.wholesaleUnits, p.priceCents)
          : { fee: null, contribution: null, margin: null };
      return {
        id: p.id,
        name: p.name,
        ...scope,
        continent: scope.country ? continentOf(scope.country) : null,
        coverageCount: plan.countries.length,
        inheritedSettings: {
          targetCents: inherited.targetCents,
          minimumContributionCents: inherited.minimumContributionCents,
          minimumContributionBps: inherited.minimumContributionBps,
          undercutBps: inherited.undercutBps,
        },
        units: p.wholesaleUnits,
        current: plan.priceCents,
        proposed: p.priceCents,
        ...actual,
        target: calc?.target ?? null,
        minimum: calc?.minimum ?? null,
        competitor: rule?.benchmarkUsd ?? null,
        competitorTarget: calc?.competitorTarget ?? null,
        safe: profitable(p.wholesaleUnits, p.priceCents, rule),
        exception: approvedFixed(p.wholesaleUnits, p.priceCents, rule),
        eligible: p.active,
        available: p.active && p.catalogueVisibility !== 'hidden',
        increased:
          raw.lastSupplierMovement === 'increase' ||
          (!raw.lastSupplierMovement &&
            plan.pricingFlags?.includes('supplier_cost_increase') === true),
        affected:
          plan.active !== p.active ||
          plan.priceCents !== p.priceCents ||
          raw.pricingVersion !== p.pricingVersion ||
          (raw.catalogueVisibility ?? 'public') !== p.catalogueVisibility,
        scope: rule?.scope ?? 'global',
        profile: rule?.profile ?? null,
        updated:
          raw.pricingUpdatedAt instanceof Timestamp
            ? raw.pricingUpdatedAt.toDate().toISOString()
            : null,
      };
    });
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  }
  async preview(expected: string) {
    const [active, draft] = await this.db.getAll(...this.refs()),
      doc = draft.exists ? draft : active;
    if (versionOf(doc) !== expected) throw conflict();
    const rows = await this.catalogue(readRules(doc.get('snapshot')));
    return { rows, token: decisionHash({ expected, rows }), revision: expected };
  }
  private async normalize(config: PricingConfig, previous: RuleSnapshot): Promise<RuleSnapshot> {
    const benchmarkUsd: Record<string, number> = {};
    const today = new Date().toISOString().slice(0, 10);
    for (const [id, b] of Object.entries(config.benchmarks)) {
      if (b.checked > today)
        throw new OperationsError('The benchmark date must be today or earlier.');
      if (
        decisionHash(previous.config.benchmarks[id]) === decisionHash(b) &&
        previous.benchmarkUsd[id]
      ) {
        benchmarkUsd[id] = previous.benchmarkUsd[id];
        continue;
      }
      const fx = priceExchange(
        b.currency,
        b.currency === 'USD' ? undefined : await this.rates.current(),
      );
      // Compare exact money at the stored rate, without retail display rounding.
      const usd = Number((BigInt(b.amount) * BigInt(fx.denominator)) / BigInt(fx.numerator));
      if (usd < 1 || usd > 99999999)
        throw new OperationsError('Benchmark is outside the supported USD range.');
      benchmarkUsd[id] = usd;
    }
    const settings = [
      ...Object.values(config.profiles),
      ...Object.values(config.countries),
      ...Object.values(config.regions),
      ...Object.values(config.packages),
    ];
    if (
      settings.some((rule) =>
        PRICING_POLICY.fees.some(
          (f) => f.bps + (rule.settings.minimumContributionBps ?? 0) >= 10000,
        ),
      )
    )
      throw new OperationsError('Margin leaves no revenue after fees.');
    return { config, benchmarkUsd };
  }
  async save(expected: string, input: PricingConfig | string, actor: string) {
    const [active, draft] = await this.db.getAll(...this.refs()),
      doc = draft.exists ? draft : active;
    if (versionOf(doc) !== expected) throw conflict();
    let snapshot: RuleSnapshot;
    if (typeof input === 'string') {
      const prior = await this.db.collection('pricingVersions').doc(input).get();
      if (!prior.exists && input !== 'global')
        throw new OperationsError('Pricing version unavailable.', 404);
      snapshot = readRules(prior.get('snapshot'));
    } else
      snapshot = await this.normalize(configSchema.parse(input), readRules(doc.get('snapshot')));
    const json = JSON.stringify(snapshot);
    if (Buffer.byteLength(json) > 600000)
      throw new OperationsError('Pricing configuration exceeds the supported size.');
    // Only accept new targets identified in the supplier catalogue. Retain discontinued targets for history.
    const previous = readRules(doc.get('snapshot')).config;
    const rows = await this.catalogue(snapshot);
    const regions = Object.keys(snapshot.config.regions).filter(
      (k) => !Object.hasOwn(previous.regions, k),
    );
    const ids = [
      ...new Set([
        ...Object.keys(snapshot.config.packages),
        ...Object.keys(snapshot.config.benchmarks),
      ]),
    ].filter((k) => !Object.hasOwn(previous.packages, k) && !Object.hasOwn(previous.benchmarks, k));
    if (
      typeof input !== 'string' &&
      (regions.length || ids.length || Object.keys(snapshot.config.packages).length)
    ) {
      const scopes = new Map(rows.map((r) => [r.id, r]));
      const regional = new Set(rows.flatMap((r) => [r.region, r.bundle]));
      if (regions.some((k) => !regional.has(k)) || ids.some((k) => !scopes.has(k)))
        throw new OperationsError('Select an existing regional bundle or package.');
      for (const [id, r] of Object.entries(snapshot.config.packages)) {
        const s = scopes.get(id);
        if (
          r.active &&
          s &&
          ((r.mode === 'country' && !s.country) || (r.mode === 'region' && !s.region))
        )
          throw new OperationsError('Inheritance must match the supplier package scope.');
      }
    }
    const saved = await this.writeDraft(
      expected,
      actor,
      json,
      typeof input === 'string' ? 'rollback' : 'save',
    );
    return {
      revision: saved.revision,
      rows,
      token: decisionHash({ expected: saved.revision, rows }),
    };
  }
  async writeDraft(expected: string, actor: string, json: string | null, action: string) {
    const [active, draft] = this.refs();
    return this.db.runTransaction(async (t) => {
      const [a, d] = await t.getAll(active, draft);
      if (versionOf(d.exists ? d : a) !== expected) throw conflict();
      const version = randomUUID(),
        date = new Date().toISOString();
      if (json !== null) t.set(draft, { snapshot: json, version, base: versionOf(a), actor, date });
      else t.delete(draft);
      t.create(this.db.collection('pricingAudit').doc(), {
        action,
        actor,
        date,
        previous: expected,
        version,
      });
      return { revision: json === null ? versionOf(a) : version };
    });
  }
  async publish(expected: string, token: string, actor: string) {
    const preview = await this.preview(expected);
    if (preview.token !== token) throw conflict();
    if (preview.rows.some((p) => p.affected && !p.eligible))
      throw new OperationsError(
        'Resolve the unsafe fixed price or approve a non-loss-making exception, then preview again.',
      );
    const [active, draft] = this.refs(),
      version = randomUUID();
    await this.db.runTransaction(async (t) => {
      const [a, d] = await t.getAll(active, draft);
      if (!d.exists || versionOf(d) !== expected || d.get('base') !== versionOf(a))
        throw conflict();
      const record = {
        version,
        actor,
        date: new Date().toISOString(),
        snapshot: d.get('snapshot'),
        previous: versionOf(a),
      };
      t.create(this.db.collection('pricingVersions').doc(version), record);
      t.set(active, { ...record, job: 'pending' });
      t.delete(draft);
    });
    return version;
  }
}
export async function applyPricing(
  version: string,
  db = database(),
  sync = () => syncCatalogue(undefined, db),
) {
  const ref = db.doc('pricingManagement/active');
  const active = await ref.get();
  if (active.get('version') !== version || active.get('job') === 'complete') return;
  const finish = async (job: string) =>
    db.runTransaction(async (t) => {
      const current = await t.get(ref);
      if (current.get('version') === version && current.get('job') !== 'complete')
        t.update(ref, { job });
    });
  try {
    const last = await db.doc('catalogueSync/esim-access').get();
    if (last.get('status') !== 'complete' || last.get('pricingConfiguration') !== version)
      await sync();
    await finish('complete');
  } catch (error) {
    await finish('retrying');
    throw error;
  }
}
export function registerPricingManagement(
  app: FastifyInstance,
  authorize: (h: string | undefined) => Promise<{ uid: string }>,
) {
  const path = '/v1/operations/pricing-management';
  const routes = [
    'workspace',
    'preview',
    'draft',
    'cancel',
    'rollback',
    'publish',
    'retry',
  ] as const;
  for (const action of routes)
    app.route({
      method: action === 'workspace' ? 'GET' : 'POST',
      url: path + '/' + action,
      bodyLimit: 700000,
      handler: async (req) => {
        const actor = await authorize(req.headers.authorization),
          service = new PricingManagement(database());
        if (action === 'workspace') return service.workspace();
        const body = z.object({ revision }).passthrough().parse(req.body);
        if (action === 'preview') return service.preview(body.revision);
        if (action === 'draft')
          return service.save(body.revision, configSchema.parse(body.config), actor.uid);
        if (action === 'rollback')
          return service.save(body.revision, revision.parse(body.version), actor.uid);
        if (action === 'cancel')
          return service.writeDraft(body.revision, actor.uid, null, 'cancel');
        const queue = orderTaskConfig();
        if (!queue)
          throw new OperationsError(
            'Configure the existing Cloud Tasks queue before publishing.',
            503,
          );
        const version =
          action === 'publish'
            ? await service.publish(
                body.revision,
                z
                  .string()
                  .regex(/^[a-f0-9]{64}$/)
                  .parse(body.token),
                actor.uid,
              )
            : body.revision;
        if (action === 'retry' && version !== (await service.workspace()).activeVersion)
          throw conflict();
        try {
          await new CloudOrderTaskQueue(queue).enqueuePricing(version);
        } catch {
          throw new OperationsError(
            'Configuration saved. Reload and retry catalogue repricing.',
            503,
          );
        }
        return { version };
      },
    });
}
