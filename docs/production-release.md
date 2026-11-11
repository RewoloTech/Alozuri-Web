# Pricing and regional/global bundle release candidate

Prepared and activated on 11 November 2026 for Firebase project `alozuri`, following explicit owner approval. The candidate audit and ordered procedure below are retained; completed production evidence is recorded in [production-release-result.json](production-release-result.json).

## Candidate and database preview

The current local API source was packaged without environment files, credentials, Git data or dependencies at `/tmp/alozuri-release-api.tgz`.

SHA-256: `818ed9f3db68fad932d632e515f5b38cf779cf653721dd4af04dcb8589a9af35`.

The archive contains the Dockerfile, dependency manifests/lockfile, TypeScript configuration, API source and shared source/license. It builds with the existing Node 22 Dockerfile. Do not substitute the old remote Git HEAD: the release implementation currently includes uncommitted local files.

Fresh read-only Firestore inspection confirms the completed source sync `d64aa3cd-3257-4769-a865-b2ce5aefd0c9`, dated `2026-11-10T23:28:05.021Z`. The existing production API still serves its previous revision and returns 404 for the featured-bundle endpoint.

The [release preview](production-release-preview.json) uses the exact existing `migrationPatch`, certified pricing validator and featured selector against all 3,283 actual records. No live documents, payments, supplier orders, cloud resources or schedules were modified during preparation.

| Result                                 | Packages |
| -------------------------------------- | -------: |
| Metadata migration required            |    3,283 |
| Selling price increases                |    2,677 |
| Selling price decreases                |      599 |
| Selling price unchanged                |        7 |
| Require pricing review after migration |        0 |
| Pass certified pricing after migration |    3,283 |

All four regions select genuine 5/10/20 GB options. The default 10 GB / 30-day projected retail prices are Europe $10.99, Asia $27.49, North America $27.49 and Global $51.49. These are calculated preview values, not new hardcoded application prices. Exact supplier IDs, destination counts and all twelve projected prices are in the report. Historical purchases and charged amounts are excluded from this migration.

## Ordered activation

1. Confirm authorisation for live deployment and the reviewed `alozuri:tiered-usd-v1` repricing. Recheck the preview if the supplier sync or overrides changed. Build the reviewed archive into the existing Artifact Registry using the existing build identity; confirm the build succeeds.
2. Preserve the current API service template, environment/secret mappings and previous revision. Deploy the candidate with `CHECKOUT_PAUSED=true`, preserving live payment mode, supplier/email secrets, OIDC identities, CORS and worker configuration. Do not use an older bootstrap deployment script that replaces the full environment.
3. Route production API traffic to the new paused revision. Confirm it is ready, the new featured endpoint exists and unsigned internal requests remain denied. Wait for old requests and any existing catalogue lease to finish before repricing; the existing scheduler must reach only the new importer. Existing verified webhooks and workers continue handling historical orders while new checkout is paused.
4. Run the migration dry-run again using the explicitly selected project. Apply only the approved pricing version using `scripts/migrate-pricing.mts` and its exact-project/version acknowledgement. The migration creates once-only private backups under `pricingMigrations/tiered-usd-v1/packages/{id}` and is safe to repeat. Inspect counts and `review_required` records before continuing.
5. Run the existing updated catalogue sync once, so pricing and bundle references share a current source snapshot. This uses the existing catalogue endpoint and supplier catalogue fetch; it does not create a scheduler or order an eSIM. Confirm the complete sync and four published `featured_bundles` records reference the same run. The normal existing daily job will repeat this process automatically.
6. Verify all four public bundles in USD/GBP/EUR, actual option product links, public-field isolation and catalogue freshness. Deploy the matching frontend only after these backend checks pass. Preserve the existing App Hosting configuration. Pushing main automatically triggers App Hosting, so do not push the frontend before the backend/data are ready.
7. Remove the checkout pause from the verified API configuration. Verify public configuration, a normal cart quote and frontend interactions on the actual domain. Do not place real customer charges or supplier purchases as a deployment smoke test. Actual wallet authorisation and payment-to-installation delivery still require a customer-approved purchase on eligible hardware.

## Recovery

If activation fails, keep checkout paused and retain historical webhook/worker handling. Bundle publication is atomic and failed runs preserve the previous records. Do not restore the old pricing application while allowing its importer or checkout repricer to overwrite migrated records. Coordinate any application rollback with the backed-up package metadata/prices while new writes are paused. Never restore or recalculate historical order totals.

The prior API template is held locally at `/tmp/alozuri-release-api-before.json` with restricted permissions. The private original catalogue export is `/tmp/alozuri-release-source.json`; neither belongs in Git or public endpoints. Existing secret values and service identities must remain unchanged.

## Verification

Domain, Firestore, browser and Stripe sandbox evidence is recorded in [featured-bundles.md](featured-bundles.md). Final candidate checks passed: 116 shared/API tests, 22 full browser fixture cases (the separate Stripe case intentionally skipped), all 13 Cypress cases, application/test TypeScript, lint and the production build. Changed-document formatting and Git diff checks passed. The latest emulator suite passed 26 tests and the separate Stripe sandbox decline/retry test passed earlier against the same API code. The API archive was checked to contain no environment files, service-account files, dependencies or Git data.

This preparation does not claim live Apple Pay/Google Pay approval, a real supplier purchase, successful QR installation or legal/tax sign-off. No production changes or main-branch push were performed during candidate preparation.

## Completed production activation

- Source commit: `177d39e0c5accbeeb92de68938010cc3b559799c`. API image `europe-west4-docker.pkg.dev/alozuri/alozuri-api/api:177d39e0c5ac` built successfully in Cloud Build `6345a156-5012-4760-857b-2bfb347cc6e3`.
- Production API revision: `alozuri-api-00007-ncv`, serving all traffic with checkout open. Existing environment values, secret mappings and service configuration were preserved.
- Firebase App Hosting build/rollout `build-2026-11-11-005` succeeded for the same commit. The new section, compact spacing and clean hero-card border are live on https://alozuri.com.
- Pricing migration changed all 3,283 package metadata records with 3,283 original backups, zero review-required products and zero changes remaining on verification. Historical orders/charged amounts were not migrated.
- The existing daily GitHub workflow succeeded on manual dispatch [42959737165](https://github.com/RewoloTech/Alozuri-Web/actions/runs/42959737165). It published all four active bundle documents under source run `78cd9157-8419-4152-bcdc-e5a41a7f3c61`, sourced on `2026-11-11T04:31:33.729Z`. Daily cron remains `17 3 * * *`; the minute fulfilment scheduler is unchanged. No second catalogue scheduler was created.
- All twelve real variant references were checked against product metadata and authoritative prices in USD/GBP/EUR. Four-default-plan quote totals matched the public bundle prices in each currency. Responses exposed no private pricing fields.
- The live browser flow passed: Europe 20 GB → GBP → correct product → cart → checkout, with the same £15.49 total verified at both cart and checkout. Compatibility starts unchecked. Screenshots were reviewed and checkout overflow checks passed at 375/390/768/1440 px. No payment request was submitted.
- Anonymous Firestore reading returned 403; an unsigned Stripe webhook returned 400; unsigned internal sync returned 401. The fulfilment worker continued returning HTTP 200 under the new API code.
- The initial empty featured cache was cleared with a paused revision labelled with the published catalogue snapshot before verification. Checkout reopened only after the matching website rollout succeeded. The temporary local OAuth ADC file was removed.

### Accepted operational limit

The supplier account has a positive balance but does not currently cover every featured variant or one of each default bundle together. The owner explicitly chose **“Continue with the current balance.”** Existing supplier-capacity validation remains enabled: an order that cannot be funded is rejected before a live payment is created/charged. No supplier funds were added and no supplier order was placed by release checks. Larger orders need sufficient prepaid supplier credit. This is an account-funding limitation, not a missing catalogue or pricing endpoint.

Actual Apple Pay/Google Pay authorisation, a real customer charge and payment-to-installation eSIM delivery were not exercised by release checks. The separate real Stripe sandbox decline/retry test passed; production checks stopped at the verified checkout quote.
