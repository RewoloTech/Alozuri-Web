# Supplier catalogue, country and data filters

## Source and allowance mapping

The provided eSIM Access CSV (`Price (1).csv`, reviewed 2026-11-10) is a reference export, not a live price database. Its 3,283 rows were compared with 3,283 products returned by the authenticated supplier package-list API. Purchasable identifiers, coverage and prices come from that API and are revalidated before payment. Supplier wholesale CSV values are not published as retail prices or committed to Git.

The supplier API documents `dataType` 1 as total data, 2 as daily allowance followed by reduced speed, 3 as daily cutoff, and 4 as daily unlimited. The normalised model keeps these distinctions. A numeric GB filter applies to fixed total allowances; it does not pretend that 2 GB/day is 50 GB total. Unlimited includes explicitly named unlimited products and daily plans with continuing, reduced-speed data. Cards, cart and checkout show the daily high-speed limit and fair-use policy.

The export contains eight Japan products explicitly named Unlimited but returned with API type 1 and a 999 GB placeholder. We classify those by the supplier's explicit unlimited name, not the placeholder number alone. Their names retain any speed cap and their supplier conditions are shown. Thirteen matched products have activation type 3; the CSV confirms all start **After Purchase**, including those Japan products. Activation types 1 and 2 retain installation/first-network semantics. Unsupported future types are rejected rather than guessed.

The interface offers all plans, 1/3/5/10/20/50 GB or more, daily plans, and unlimited with fair-use conditions. Changing allowance after a search refreshes results automatically; the URL restores the selected allowance. Tabs switch immediately, including an explicitly marked draft trip before its second country is selected. Switching to single destination preserves the saved trip and asks for one country without leaving the trip tab active. Single-destination results default to local-only packages; the customer can explicitly include regional/global coverage. The API supports `coverage=local|all`. Every result must cover **all** chosen countries. The API validates `dataType=all|fixed|daily|unlimited` and `minGb`; client prices never control checkout.

## Retail pricing and gross profit

The supplier supplies wholesale costs; Alozuri calculates retail prices. `adaptPackage` applies `priceRetail` during sync and again when checkout revalidates the supplier product. The current default is **1.8 × wholesale cost**, rounded up to whole USD cents, with a 30% minimum-margin guard and a $0.50 minimum selling price. At the default multiplier the 80% markup exceeds the 30% guard. Prices shown to customers are the saved retail `priceCents` in Firestore, not the CSV's suggested retail column or a browser-provided amount. No markup or existing selling prices were changed by the search audit.

A read-only audit on 2026-11-11 found 3,283 active products, gross margins of 44.44–45.00% after cent rounding, and no price below $0.50. A France 50 GB product cost $17.00 wholesale and sold for $30.60: **$13.60 gross profit**, **80% markup on cost**, **44.44% gross margin on sales**. These are not net profits: Stripe fees, taxes, refunds, exchange costs and operating expenses are not included. Actual fees vary by transaction; do not invent a fixed net profit. Supplier cost and product codes remain private; search responses contain an explicit public-field allowlist.

## Indexed, paginated search

The storefront uses `GET /v2/search/plans`; the existing `/v1/packages/match` route remains available for compatibility. Products already have typed country arrays, data type, numeric allowance, daily policy, duration, currency and retail cents. No manually maintained search tags are needed. Provider adapters must populate those fields from verified supplier data. Country names support common aliases (UK, USA, UAE, Ivory Coast, Türkiye) and accent-insensitive matching, restricted to countries available in the catalogue.

The repository loads active Firestore products into a five-minute per-instance snapshot. A country-to-product inverted index is built once for each snapshot and intersects the smallest country sets first. Allowance and local-only filters operate on that candidate set. This avoids a Firestore scan per keystroke or result page. At the current catalogue size this in-process index is sufficient; a much larger catalogue or additional text/relevance requirements should be benchmarked before adding an external search service.

Search returns 12 product summaries per page (API maximum 48), a total, allowance counts and a cursor. Sorting applies to the entire matching set before paging, with deterministic tie-breakers. Recommended results prioritise a range of allowance sizes while preserving **every** matching product, including products sharing a GB size. Show more appends the next page. Numeric facets represent fixed total allowances; daily and unlimited semantics remain separate.

Cursors are bounded, validated public bookmarks tied to filters, sort, page size and catalogue revision. They are not authentication tokens. A changed catalogue returns 409 and asks the customer to refresh instead of combining inconsistent pages. Requests accept only validated allowlisted parameters; malformed filters/cursors are rejected before repository access. Search has a 60-request/minute per-client, per-instance limit. Cloud Run proxy trust is restricted to the immediate private socket peer, preventing arbitrary earlier forwarded addresses from selecting a new bucket. This in-memory limiter is not a strict service-wide quota across replicas.

The browser cancels superseded requests and ignores stale responses, including when changing allowance, countries or sort. Country options support keyboard navigation, Enter activation and Escape; selection restores focus. Results include explicit loading, empty, error, refresh and pagination states. Search selections, allowance and sort remain in the URL.

## Read-only catalogue audit

```sh
# A previously downloaded supplier response (kept outside Git):
node --import tsx scripts/audit-search.mts /path/to/supplier-catalogue.json
# Current authenticated supplier catalogue using ignored server credentials:
node --env-file=apps/api/.env --import tsx scripts/audit-search.mts --live
```

The script never writes the database, creates payments or buys supplier products. On 2026-11-11 it accepted all 3,283 current supplier products across 205 countries and compared **4,176** country/coverage/allowance/trip searches with an independent full-scan oracle, traversing every result page. All exact product-ID sets matched. Index construction took 20.89 ms and warm search CPU time had a 0.005 ms median / 0.021 ms p95 in this local run. These are in-process timings, **not HTTP latency or a load test**. A sample page returned 12 of 82 matches in 4,391 JSON bytes, with no private provider fields.

## Daily sync

`.github/workflows/catalogue-sync.yml` runs daily at **03:17 UTC**, and supports manual dispatch. GitHub scheduled jobs can start late; this is a daily refresh, not an exact-time guarantee. `scripts/sync-catalogue.mts` uses short-lived Google workload identity, reads supplier credentials from Secret Manager, fetches catalogue data and writes Firestore. It never calls supplier purchasing or Stripe endpoints.

The identity is restricted to repository ID `1451932958`, owner ID `221912097`, branch `main`, and this exact workflow path. The dedicated account `alozuri-catalogue@alozuri.iam.gserviceaccount.com` has Firestore data access and access to only `ESIM_ACCESS_CODE` and `ESIM_SECRET_KEY`; no service-account private key is stored in GitHub. The existing Cloud Scheduler HTTP configuration remains an alternative if the production API is deployed. Do not enable both schedules accidentally.

Sync records its last successful counts/time and attempts in `catalogueSync/esim-access`, acquires a lease, validates products, prevents identifier collisions and severe unexpected shrink, and retires missing products only for its own provider. Invalid/empty fetches preserve existing products. Failed runs are visible in GitHub Actions and sync status. Catalogue reads expire after 36 hours; checkout independently refreshes each selected supplier plan.

## Adding another provider

Implement `CatalogueProvider` in `apps/api/src/lib/catalogue-provider.ts`: a stable provider ID and a `fetch(syncedAt)` method returning validated `StoredPlan` records. Use provider-prefixed or otherwise namespaced product IDs. Preserve exact supplier variant codes privately, verified ISO country coverage, real allowance semantics, activation rules, wholesale units and currency. The eSIM Access IDs stay unchanged for compatibility.

`syncCatalogue(provider, db)` scopes leases, shrink checks and product retirement by provider, so one provider cannot remove another's records. Legacy records without a provider ID belong to eSIM Access. New public fields must be added to the allowlisted schema and display helpers.

A second catalogue adapter alone does **not** enable that supplier's purchases. Add and test provider-specific repricing, ordering, timeout reconciliation, refund and allocation routing before opening checkout. Current checkout explicitly rejects another provider ID to prevent sending its package code to eSIM Access. Supply its credentials through separate secret grants and schedule its sync independently.

References: [eSIM Access API](https://docs.esimaccess.com/), [Google workload identity for deployment pipelines](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines).

## Verified deployment

The first manual cloud run succeeded on 2026-11-10 at 23:08 UTC: 3,283 fetched, 3,283 active, zero unsupported. [Workflow run](https://github.com/RewoloTech/Alozuri-Web/actions/runs/42920743881).

The catalogue API is deployed in the Netherlands (`europe-west4`) at `https://alozuri-api-rnm3hsyqia-ez.a.run.app`. Its health, country list and 50 GB/unlimited country-match endpoints were checked against the real Firestore catalogue. Both local frontend configuration and App Hosting now point there with demo mode off. The API is now configured for live checkout and per-unit delivery, with a supplier-credit gate before payment; see [payment verification](production-checkout.md).

The API runs as `alozuri-api@alozuri.iam.gserviceaccount.com` with Firestore access and Firebase Auth read access for token revocation checks. The production checkout revision now has specific supplier, Stripe, order-access and mail secret mappings, plus the authenticated minute worker. The Docker image was built from commit `4638fb7` in Artifact Registry repository `alozuri-api`. The API source is still the shared Fastify backend; no second catalogue gateway was introduced.
