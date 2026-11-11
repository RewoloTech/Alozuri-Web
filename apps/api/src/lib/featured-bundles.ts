import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { Currency } from '../../../../packages/shared/src/index.ts';
import {
  FEATURED_REGIONS,
  REGION_NAMES,
  defaultAllowance,
  unavailableBundles,
  type FeaturedBundle,
  type FeaturedOption,
} from '../../../../packages/shared/src/featured.ts';
import { database } from './firebase.js';
import { ExchangeRates, priceExchange, convertPrice } from './exchange-rates.js';
import {
  bundleRecordSchema,
  bundleCandidate,
  eligibleRegion,
  selectFeaturedBundles,
  type BundleRecord,
} from './featured-selection.js';

export async function publishFeaturedBundles(
  db: Firestore,
  source: readonly unknown[],
  syncId: string,
  state: DocumentReference,
  complete?: Record<string, unknown>,
  at = Timestamp.now(),
) {
  const written = await db.runTransaction(async (transaction) => {
    const refs = FEATURED_REGIONS.map((region) => db.doc('featured_bundles/' + region));
    const [lease, ...docs] = await transaction.getAll(state, ...refs);
    if (
      lease.get('runId') !== syncId ||
      lease.get('status') !== (complete ? 'running' : 'complete')
    )
      throw new Error('Featured bundle source lease changed.');
    const previous = docs.flatMap((doc) => {
      const parsed = bundleRecordSchema.safeParse(doc.data());
      return parsed.success ? [parsed.data] : [];
    });
    const selected = selectFeaturedBundles(source, previous, syncId, at);
    const ids = [
      ...new Set(
        selected.flatMap((row) => Object.values(row.options).map((option) => option.productId)),
      ),
    ];
    const products = ids.length
      ? await transaction.getAll(...ids.map((id) => db.doc('packages/' + id)))
      : [];
    const current = new Map(products.map((doc) => [doc.id, doc.data()]));
    for (const row of selected)
      for (const option of Object.values(row.options)) {
        const candidate = bundleCandidate(current.get(option.productId), at.toMillis());
        if (
          !candidate ||
          candidate.plan.id !== option.productId ||
          candidate.sourceHash !== option.sourceHash ||
          !eligibleRegion(candidate, row.region)
        )
          throw new Error('Featured bundle source changed before publication.');
      }
    let count = 0;
    for (let i = 0; i < selected.length; i++) {
      const { updatedAt: ignored, ...next } = selected[i];
      void ignored;
      const old = previous.find((row) => row.region === selected[i].region);
      const comparable = old
        ? (({ updatedAt: timestamp, ...rest }) => {
            void timestamp;
            return rest;
          })(old)
        : null;
      if (JSON.stringify(comparable) !== JSON.stringify(next)) {
        transaction.set(refs[i], selected[i]);
        count++;
      }
    }
    if (complete)
      transaction.set(state, { ...complete, status: 'complete', leaseUntil: 0, runId: syncId });
    return count;
  });
  defaultFeaturedReader.invalidate();
  return written;
}
export class FeaturedReader {
  private cached: Promise<{ records: BundleRecord[]; products: Map<string, unknown> }> | undefined;
  private expires = 0;
  constructor(
    private db?: Firestore,
    private rates: Pick<ExchangeRates, 'current'> = new ExchangeRates(db),
    private now = Date.now,
  ) {}
  invalidate() {
    this.cached = undefined;
    this.expires = 0;
  }
  private async load() {
    if (!this.cached || this.now() >= this.expires) {
      this.expires = this.now() + 300000;
      const db = this.db ?? database();
      this.cached = db
        .runTransaction(
          async (transaction) => {
            const docs = await transaction.getAll(
              ...FEATURED_REGIONS.map((region) => db.doc('featured_bundles/' + region)),
            );
            const records = docs.flatMap((doc, index) => {
              const parsed = bundleRecordSchema.safeParse(doc.data());
              return parsed.success && parsed.data.region === FEATURED_REGIONS[index]
                ? [parsed.data]
                : [];
            });
            if (records.length !== 4 || new Set(records.map((r) => r.catalogueSyncId)).size !== 1)
              return { records: [], products: new Map<string, unknown>() };
            const ids = [
              ...new Set(
                records.flatMap((row) =>
                  Object.values(row.options).map((option) => option.productId),
                ),
              ),
            ];
            const products = ids.length
              ? await transaction.getAll(...ids.map((id) => db.doc('packages/' + id)))
              : [];
            return {
              records,
              products: new Map<string, unknown>(products.map((doc) => [doc.id, doc.data()])),
            };
          },
          { readOnly: true },
        )
        .catch((error) => {
          this.cached = undefined;
          throw error;
        });
    }
    return this.cached;
  }
  async read(currency: Currency): Promise<FeaturedBundle[]> {
    const { records, products } = await this.load();
    if (!records.length) return unavailableBundles();
    const exchange = priceExchange(
      currency,
      currency === 'USD' ? undefined : await this.rates.current(),
      this.now(),
    );
    return records.map((row) => {
      const options: FeaturedOption[] = [];
      for (const [allowance, option] of Object.entries(row.options)) {
        const candidate = bundleCandidate(products.get(option.productId), this.now());
        if (
          !candidate ||
          candidate.plan.id !== option.productId ||
          candidate.plan.dataGb !== option.dataGb ||
          String(option.dataGb) !== allowance ||
          candidate.sourceHash !== option.sourceHash ||
          !eligibleRegion(candidate, row.region)
        )
          continue;
        const priceCents = convertPrice(candidate.plan.priceCents, currency, exchange);
        if (priceCents > 99999999) continue;
        options.push({
          productId: candidate.plan.id,
          dataGb: option.dataGb,
          validityDays: candidate.plan.days,
          countryCount: candidate.plan.countries.length,
          priceCents,
          currency,
        });
      }
      return {
        region: row.region,
        regionName: REGION_NAMES[row.region],
        status: options.length ? 'active' : 'unavailable',
        defaultDataGb: defaultAllowance(options.map((o) => o.dataGb)),
        options,
        updatedAt: row.updatedAt.toDate().toISOString(),
      };
    });
  }
}
export const defaultFeaturedReader = new FeaturedReader();
