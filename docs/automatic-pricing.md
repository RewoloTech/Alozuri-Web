# Automatic catalogue pricing

## Scope and source of truth

All calculated prices originate in `apps/api/src/lib/pricing.ts`, on the server. Supplier sync (`catalogue-sync.ts`), supplier adaptation (`supplier.ts`), checkout revalidation (`payments.ts`) and the migration use the same `pricePackage` validation/upsert policy. No frontend multiplier or FX calculation is used. Existing package metadata and purchased-order snapshots are preserved.

`priceCents` remains the compatibility field used by the storefront. It must equal private `sellingPriceUsdCents`. Base catalogue records must be USD. Raw eSIM Access `wholesaleUnits` are integer 1/10,000 USD; retain them for exact supplier ordering and pricing. `supplierCostUsdCents` is their conservative ceiling to whole cents, because fractional cents cannot be represented in that requested integer field. Pricing retains the original supplier units and conservatively ceilings supplier cost to cents for contribution checks.

## Algorithm: contribution-usd-v2

The server replaces the old $1.99 retail floor and pre-fee gross-margin rule with
contribution after estimated processing fees. `PRICING_VERSION` includes a hash
of `PRICING_POLICY`; changing fee assumptions invalidates stale catalogue prices
until a validated import/migration. The canonical currency remains USD.

Default assumptions are domestic 1.5%, EEA plus FX 4.5%, and international plus FX
5.15%, each with a conservative **$0.30 USD equivalent** fixed fee. Every price
must satisfy all scenarios, the configured other direct cost (default zero),
minimum $0.50 contribution and 15% contribution/revenue. These are estimates,
not verified negotiated account fees or net profit after taxes, refunds, support
and disputes. Confirm the contract, supported payment methods, tax treatment and
USD equivalent of fixed fees before release. [Stripe UK pricing](https://stripe.com/gb/pricing)
currently lists standard UK 1.5% + 20p, EEA 2.5% + 20p and international 3.15% +
20p, with an additional 2% where conversion is required. Do not interpret 20p as
20 USD cents.

Marginal supplier-cost bands use 90%, 65%, 45%, 30% and 20% target contribution
on the portions of cost starting at $0, $1.60, $4, $10.75 and $26.33 respectively.
These breakpoints are anchored to the observed 3,283-product catalogue's
quartiles and 90th percentile, rounded where appropriate. They are versioned
policy constants, not recalculated every day. Applying each rate only to the
incremental cost avoids price drops at band boundaries. The target contribution
is at least $0.50. The engine solves both contribution constraints under every
fee scenario, then rounds upwards to `.49` / `.99`, rechecking profitability.
Supplier cost and fees each round upwards to cents; integer/BigInt calculations
avoid floating point monetary errors. Invalid or unsupported amounts fail closed.

Examples from the reusable cost formula: $0.47 cost → $1.49, $0.75 → $1.99,
$1 → $2.49, $5 → $9.49, $15 → $23.99 and $30 → $44.49. These are candidate
prices; curation can discount an inferior offering only when all contribution
constraints still hold, or hide it if a useful price distinction is impossible.

Fee and contribution environment settings are documented in `apps/api/.env.example`.
Manual overrides retain the owner's exact amount only when all profitability
constraints pass. Unsafe overrides are preserved but unavailable for purchase.
Minor supplier moves up to 5% can retain the prior retail price within one
50-cent price step, provided it remains profitable. This does not apply across
policy versions. Larger cost moves recalculate immediately. Cost increases over
25% and retail moves over 50% and $1 are flagged in private metadata/history.

## Catalogue curation and traceability

`catalogue-curation.ts` compares complete supplier service attributes: coverage,
validity, daily/total/unlimited classification, FUP, networks and technology,
activation, unused expiry, IP routing, cancellation, SMS and top-up conditions,
notes, restrictions and unknown service fields. Marketing IDs, prices, known allowance/duration/FUP labels and favourites do
not define equivalence. Unrecognised name qualifiers are retained. Arbitrary non-name
descriptions and new unknown fields remain in the service fingerprint. Missing
comparison data retains the product with a review flag rather than guessing.
Unknown FUP text is never assigned an invented speed. Different top-up types 2
and 3 remain distinct; a supported top-up option can dominate type 1 (no top-up).
See the [supplier API definitions](https://docs.esimaccess.com/).

Within a service family, exact equivalents keep the lowest supplier cost and use
stable IDs to break ties. Lower allowance or slower fallback variants receive a
profitable lower price when possible, otherwise they are hidden if a superior
variant costs customers the same or less. Networks, routing, expiry or coverage
changes are not merged. Guards reject duplicate or dominated public offers and
invalid contribution/allowance metadata. Contradictory supplier classification
(such as total-data type with an unlimited name) is quarantined for review.

Hidden products remain stored with their own supplier code, wholesale cost,
price, reason and replacement ID. Replacement chains resolve to a visible SKU;
orders never silently substitute that SKU. Both public reads and new checkout
reject hidden products. Historical purchase snapshots and fulfilment IDs stay
unchanged. The legacy checkout's fresh supplier revalidation retains approved
value discounts only for unchanged service/cost data; changed service attributes
require sync review before purchase.

Daily sync keeps each comparison family in a transaction and rereads current
overrides. Bounded chunks leave room for private `packages/{id}/pricingHistory`
decision records. History records contain before/after cost, price, policy,
visibility and decision metadata. Identical same-day imports preserve timestamps,
skip package/history writes, and compare nested fields canonically because
Firestore can reorder object keys. A changed date still advances the source date.
The legacy backed-up migration skips already-valid current decisions; a fresh
supplier sync is required to populate full comparison metadata and curation.

## Private database metadata and write policy

Each imported record includes `packageId`, `supplier: esimaccess`, `supplierCostUsdCents`, `sellingPriceUsdCents`, `pricingVersion`, `pricingUpdatedAt` (Firestore Timestamp), `priceOverrideUsdCents` (null by default), `pricingStatus`, and `catalogueDate` (`YYYY-MM-DD`, UTC). Existing country, allowance, duration, networks, supplier conditions and supplier identifiers are retained.

The existing Firestore rules deny all public reads/writes, including packages, rates and migration backups. Customer API responses project only public plan fields: no supplier cost, override, pricing version/status/timestamp or wholesale units. Admin SDK writes bypass Firestore rules by design; database reads and payment validation therefore independently recompute/check certified pricing. Declaring `pricingStatus: valid` alone cannot make an arbitrary direct write purchasable. Trusted administrators still control their database and must use the validated import path.

Sync reads current records inside transactions before preserving overrides, so a concurrent override update cannot be silently overwritten. Identical same-day imports skip package writes and retain calculation/source timestamps. Changed cost, version or override updates pricing. The daily source date advances on a new day's import. Invalid/missing costs or unsupported source currencies are saved unavailable for review when metadata can be identified. Removed/unsupported products become unavailable; malformed/empty whole responses do not replace a healthy catalogue.

## Today's catalogue, with yesterday fallback

Each canonical package retains the date of its last successful supplier import. Reads query dates **today and yesterday in UTC**, then validate availability, source timestamp and pricing. A today's record supersedes the prior import for that ID. When today's import has not occurred, yesterday's record remains usable. Older/future dates are rejected; changing the date alone without a matching source timestamp does not bypass this rule. An explicitly invalid/withdrawn today's product is unavailable, rather than reverting to an obsolete purchasable price.

This is a dated canonical catalogue, not a full daily historical product archive. Historical accounting uses immutable purchased-order snapshots. The existing daily sync schedule remains 03:17 UTC; repository caches refresh within five minutes and are invalidated by the existing sync endpoint.

## USD / GBP / EUR

[Frankfurter's ECB provider](https://frankfurter.dev/) supplies reference rates, not Stripe's settlement rates. The verified endpoint is `https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=GBP,EUR`. Decimal rates are captured as strings before JSON numeric parsing, stored as rational numerator/denominator strings, and used with BigInt arithmetic. Rates are persisted privately in `exchangeRates/USD` with source, rate date and fetch timestamp, cached for one hour across instances, and refreshed lazily on traffic. Concurrent requests in one instance share a pending fetch.

On a provider failure, a cached observation up to seven days old can cover weekends/holidays; older/missing/invalid/future rates fail closed and the customer can select USD. No 1:1 fallback is permitted. USD needs no external rate lookup. A fresh rate retrieval was checked against the real provider without writing live Firestore.

USD, GBP and EUR all use two decimal minor units. Converted prices round upwards to whole local minor units. GBP/EUR prices above £5/€5 may then use the next `.49`/`.99` ending, capped at a 3% uplift and strictly below the raw conversion of the next 50-cent USD price step. Small prices, nonstandard manual amounts and cases failing either safeguard retain precise conversion. This preserves distinctions between standard canonical USD price steps. Currency-specific charge floors remain (USD 50, GBP 30, EUR 50 minor units; the contribution constraints normally produce a higher USD retail price). See [Stripe currency/settlement minimum rules](https://docs.stripe.com/currencies). The selected currency is sent to the server for search, detail, quote and checkout; USD cents are never simply relabelled as GBP/EUR. Server-side sorting uses converted prices. Cursors change when the converted catalogue changes.

The currency choice persists locally. Open pages refresh prices when returning to the tab and every five minutes, subject to the server cache. Header options follow server capabilities so a new frontend remains compatible with the existing USD-only backend. In-progress payment sessions lock currency and preserve their original quote instead of repricing an already-created intent.

## Checkout and accounting

The API accepts package IDs, quantities, selected currency and an expected total used only as a reconfirmation check. Client prices, rates or metadata cannot set the amount. The server validates stored pricing, current dated availability and fresh supplier information, applies valid overrides, converts using one verified rate snapshot, and uses that exact quote for the purchase and Stripe PaymentIntent.

Snapshots preserve base USD retail cents, pricing version, exact supplier units and the FX source/date/rational rate. Stripe amount, currency, metadata and received amount are checked on signed webhooks. Per-unit fulfilment/refunds use the currency and amount originally charged. Later supplier/FX changes do not rewrite receipts. Existing idempotency keys, webhook event deduplication and fulfilment leases are retained. Fees, settlement FX spreads and taxes are not part of the guaranteed pre-fee gross margin.

`CHECKOUT_PAUSED=true` blocks new quotes/payments while leaving signed webhooks and existing-order handling available. It defaults off and has **not** been enabled in production.

## Initial migration preparation and deployment boundary

**At the initial implementation stage, no live migration, deployment, repository push, schedule change or production price write was performed.** Pushing main automatically deploys App Hosting, so changes must remain local until approved.

A read-only private export of all 3,283 existing package records was previewed on 2026-11-11: 3,283 need metadata migration, 2,677 selling prices increase, 599 decrease, seven stay unchanged, and zero require review. Re-run the preview immediately before any approved apply because supplier costs/overrides may change.

```sh
# Read-only against the explicitly selected project, with authorized ADC credentials:
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT node --import tsx scripts/migrate-pricing.mts
# Offline preview of a private [{id,data}] catalogue export; no cloud access:
node --import tsx scripts/preview-pricing-export.mts /private/path/catalogue.json
```

Apply is guarded by both `--apply` and an exact project/version acknowledgement in `PRICING_MIGRATION_APPROVED`; the emulator can apply without a production acknowledgement. Do not set that acknowledgement before reviewing the dry-run and obtaining rollout approval. The migration uses bounded transactions and re-reads each record to preserve concurrent override changes. Before changing a package it stores a once-only original backup at `pricingMigrations/{PRICING_VERSION}/packages/{id}`. Repeated apply is a no-op. It never rewrites purchases, order amounts or Stripe objects.

Approved rollout sequence:

1. Keep the new code off main until review is complete. Prepare/test the new API with `CHECKOUT_PAUSED=true`; pause the old daily importer before live migration. Do not allow an old importer or checkout repricer to overwrite the new prices.
2. Deploy the new API in paused mode, confirm all traffic is on it and allow old in-flight catalogue/checkout work to drain. Existing webhooks/workers continue to use historical snapshots.
3. Re-run the dry-run, review differences, and only then explicitly acknowledge the exact project/version and apply the backed-up migration. Run a validated fresh supplier sync to date the catalogue if needed. Inspect all `review_required` products.
4. Verify dated catalogue reads, margins, public-field isolation, fresh FX rates, authoritative quotes, refunds and sandbox payment checks. Deploy the matching frontend; enable new payments and resume only the new importer once verification succeeds.

Rollback requires pausing new checkout/import writes, restoring the previous application version and reviewed package backups in coordination. Do not restore historical catalogue prices under a running mismatched pricing engine. Purchased-order amounts must never be restored/recalculated.

## Validation commands

```sh
npm test
npm run test:firestore
npm run test:e2e
npm run lint
npm run typecheck
npm run typecheck:tests
npm run build
npm run test:stripe
STRIPE_TEST_CURRENCY=GBP npm run test:stripe
STRIPE_TEST_CURRENCY=EUR npm run test:stripe
```

Firestore/Stripe local tests require Java 21+ and use `demo-alozuri` on the emulator. Stripe runs use real Stripe TEST card calls and locally simulated signed webhook transport, never a live charge, supplier purchase or delivery email. Apple Pay/Google Pay UI contracts remain covered by fixtures; actual wallet authorization on eligible devices and live fulfilment are not verified by these tests. Run browser suites sequentially because they share port 3100; leave the user's existing port-3000 dev server untouched.

### Historical v1 verification (before the contribution-pricing audit)

- `npm test`: **95 passed** (18 shared, 77 API), including 400,000 monotonic supplier-cost increments and exact 30% margin boundary checks.
- `npm run test:firestore`: **20 passed** on the local emulator. Includes duplicate-import/no-write checks, retained overrides, migration backup/idempotency, private-client denial, unchanged checkout repricing, supplier price changes, FX cache refresh, original-currency fulfilment/refunds, and maintenance with working signed webhooks.
- `npm run test:cypress`: **13 passed**, including GBP/EUR repricing, quantities, currency locking and different idempotency attempts when currencies happen to round to the same numeric total.
- `npm run test:e2e`: **six passed**; the real-Stripe case is intentionally skipped in the fixture-only run.
- Real `npm run test:stripe` runs in **USD, GBP and EUR each passed** using Stripe TEST card decline/retry against the new local API and Firestore emulator. Signed webhook transport is locally simulated in these runs. No live charge, supplier issuance or delivery email was performed.
- Lint, application/test TypeScript checks, changed-file Prettier checks and production builds passed. Mobile EUR checkout was visually reviewed; responsive regression tests cover 375/390/768 px.
- The live read-only comparison after the dry-run found **zero price or pricing-version changes** across all 3,283 packages. Git HEAD remains unchanged; the implementation and migration are local and uncommitted.

## Historical v1 production activation — 11 November 2026

The following records the earlier v1 release, before this audit. The contribution
pricing and curation changes above have since been activated separately; see the
[current audit](pricing-audit-2026-11-11.md) for the authorised v2 production release
and verification.

The owner explicitly approved deployment and the reviewed `alozuri:tiered-usd-v1` migration. All 3,283 records were migrated with once-only backups: 2,677 prices increased, 599 decreased and seven stayed unchanged. Zero records require review, and a verification dry-run found zero remaining changes. A temporary catalogue lease prevented a concurrent importer during migration and was released afterward. Historical orders and charged amounts were not migrated.

The existing daily GitHub workflow was manually dispatched once on the approved code, succeeded and published a current catalogue plus all four active bundle records under sync `78cd9157-8419-4152-bcdc-e5a41a7f3c61`. The daily cron was not changed. Final API/frontend rollout and live smoke-test evidence are recorded in [production-release.md](production-release.md).

See [bounded local-currency rounding](local-currency-rounding-2026-11-11.md) for the subsequently approved GBP/EUR presentation rule and release checks.
