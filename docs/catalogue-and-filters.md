# Supplier catalogue, country and data filters

## Source and allowance mapping

The provided eSIM Access CSV (`Price (1).csv`, reviewed 2026-11-10) is a reference export, not a live price database. Its 3,283 rows were compared with 3,283 products returned by the authenticated supplier package-list API. Purchasable identifiers, coverage and prices come from that API and are revalidated before payment. Supplier wholesale CSV values are not published as retail prices or committed to Git.

The supplier API documents `dataType` 1 as total data, 2 as daily allowance followed by reduced speed, 3 as daily cutoff, and 4 as daily unlimited. The normalised model keeps these distinctions. A numeric GB filter applies to fixed total allowances; it does not pretend that 2 GB/day is 50 GB total. Unlimited includes explicitly named unlimited products and daily plans with continuing, reduced-speed data. Cards, cart and checkout show the daily high-speed limit and fair-use policy.

The export contains eight Japan products explicitly named Unlimited but returned with API type 1 and a 999 GB placeholder. We classify those by the supplier's explicit unlimited name, not the placeholder number alone. Their names retain any speed cap and their supplier conditions are shown. Thirteen matched products have activation type 3; the CSV confirms all start **After Purchase**, including those Japan products. Activation types 1 and 2 retain installation/first-network semantics. Unsupported future types are rejected rather than guessed.

The interface offers all plans, 1/3/5/10/20/50 GB or more, daily plans, and unlimited with fair-use conditions. Changing allowance after a search refreshes results automatically; the URL restores the selected allowance. Every result must cover **all** chosen countries. The API validates `dataType=all|fixed|daily|unlimited` and `minGb`; client prices never control checkout.

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

The catalogue API is deployed in the Netherlands (`europe-west4`) at `https://alozuri-api-rnm3hsyqia-ez.a.run.app`. Its health, country list and 50 GB/unlimited country-match endpoints were checked against the real Firestore catalogue. Both local frontend configuration and App Hosting now point there with demo mode off. Payments remain disabled; this deployment does not activate real charges or supplier issuance.

The API runs as `alozuri-api@alozuri.iam.gserviceaccount.com` with Firestore access and Firebase Auth read access for token revocation checks. It has no supplier, Stripe or mail secret mappings in this catalogue deployment. The Docker image was built from commit `bf73259` in Artifact Registry repository `alozuri-api`. The API source is still the shared Fastify backend; no second catalogue gateway was introduced.
