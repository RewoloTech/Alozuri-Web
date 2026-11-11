# Automated regional and global bundles

Implemented and validated on 11 November 2026. Initial preparation made no live changes; the owner subsequently authorised production deployment and pricing migration. Activation evidence is recorded in [production-release.md](production-release.md). No real payment, supplier order or schedule change was part of activation.

## Data and integration

`apps/api/src/lib/featured-selection.ts` contains deterministic selection and the central `BUNDLE_POLICY`. `featured-bundles.ts` publishes and serves the selections. `catalogue-sync.ts` supplies the actual validated results of the existing pricing upserts after every successful eSIM Access sync. There is no second scheduler or supplier request.

The private `featured_bundles` collection has four stable document IDs: `europe`, `asia`, `north-america`, `global`. Each contains region/name/status, default allowance, preferred validity, selected product ID, country count, update timestamp, source sync ID, selection version and an options map keyed by `5`, `10`, `20`. Each option references a real `packages` document and records allowance, validity and a source fingerprint. Prices and supplier costs are not copied into these records.

The four documents and successful sync state publish in one transaction after product pricing succeeds. Publication verifies referenced product fingerprints again before any writes. A lost lease, failed sync or interrupted publication leaves the previous four records intact. Changed or stale references are omitted when serving them, rather than exposing unverified products. Repeating publication for the same unchanged sync skips all four writes. A new successful sync records its new source identifier and timestamp.

`featured_bundles` is the generated database collection requested for the cards. The daily supplier catalogue is its source of truth: each successful sync regenerates the four derived records from that run's validated, priced package data. The records reference existing product IDs, so prices, cart items and checkout remain tied to the same packages. Today/yesterday freshness is enforced on those underlying catalogue records. A regression test changes a supplier cost during the next sync and verifies the derived selection's new sync ID and exact authoritative retail price.

`GET /v1/featured-bundles?currency=USD|GBP|EUR` reads four documents plus at most twelve deduplicated product references in a consistent read transaction, cached for five minutes. It does not scan the catalogue, call the supplier, calculate new retail prices or generate selections. The existing server-side exchange-rate service converts authoritative USD retail prices. The reader rechecks pricing, geographic eligibility and today/yesterday catalogue freshness; unknown or modified products are withheld. Existing checkout independently validates the current actual product and price before taking payment.

The endpoint explicitly projects only public fields. Firestore's existing deny-all client rules cover the new collection: customers read its public projection through the API and cannot write selections, products or prices. Supplier costs, codes and credentials are not included in browser props or endpoint responses.

## Selection policy

- Only current, active eSIM Access products with a verified supplier-derived catalogue ID, valid supplier cost, profitable authoritative retail price, known unique country codes and fixed allowances of exactly 5/10/20 GB qualify. Validity must be at least 30 days. Expired, daily, unlimited, malformed and stale products are excluded.
- Geography uses actual coverage, not product names. The shared continent map derives from Unicode CLDR territory containment. Turkey follows Alozuri's existing Europe taxonomy; Middle Eastern countries remain geographically in Asia.
- Regional products must have at least 80% of their destinations in the advertised continent. Europe requires at least 15 European destinations including GB/FR/DE/ES/IT; Asia requires five including JP/SG/TH; North America requires two including US/CA. Central America and the Caribbean are geographically part of North America.
- Global requires at least 25 destinations, GB/US/JP and meaningful coverage of at least three continents (three destinations per continent).
- Within an allowance: exactly 30 days first, lowest retail price next, then more coverage, supplied network information and a stable product ID tie-breaker. No unverified quality score is invented.
- Retain an eligible previous selection unless a comparable alternative is at least 5% cheaper, an exact 30-day alternative improves validity preference, or a verified superset adds at least 25% and five destinations for no more than 10% extra. Comparable cheaper products retain at least 90% of coverage. Integer arithmetic implements price thresholds. Invalid previous selections are immediately replaced.
- Default allowance is 10 GB, then 20 GB, then 5 GB. Missing options are omitted; an empty region is unavailable. Each option is one supplier eSIM, never a combination.

## Homepage and purchase flow

`FeaturedBundles` adds four cards before “Where to next?” while retaining the hero and Trip Matcher. Its initial USD content is server rendered using the existing Next.js five-minute cache. Currency changes fetch the four public records once and preserve the chosen allowance. Buttons update the actual product, price, validity and coverage. Currency failures hide prices and disable product navigation until correctly priced data is available.

Cards link to the existing `/plans/[id]` page. Cart, checkout, wallets, Stripe, email and fulfilment use the existing purchase path. No alternative checkout or browser-derived price was introduced. Four-column desktop, two-column tablet and single-column mobile layouts reuse existing styling.

The gap below the cards uses 24 px bottom padding plus 24 px top padding on the following destination section (16 px each on mobile), avoiding stacked full-section padding. Browser checks measure the gap at all four supported widths.

## Safe run against the real catalogue

Source: completed eSIM Access sync `d64aa3cd-3257-4769-a865-b2ce5aefd0c9`, dated `2026-11-10T23:28:05.021Z`; 3,283 package records. A read-only run retrieved the existing catalogue and applied the existing pricing engine **in memory** to preview selection. It made zero production writes and no supplier API calls.

All defaults below are 10 GB / 30 days. All four have genuine 5/10/20 GB options.

| Region        | Supplier product ID | Catalogue product ID          | Actual destinations |
| ------------- | ------------------- | ----------------------------- | ------------------- |
| Europe        | PGJBA365C           | esim-b0702e322fbcf8a23d9d69e8 | 33                  |
| Asia          | JC180               | esim-db0fb72526448cb80bf983d3 | 20                  |
| North America | CKH494              | esim-c525b3fa0ca7f258c7dd956c | 3                   |
| Global        | P34FHRF8J           | esim-faf726618a4c44744c58d8d3 | 117                 |

The supplier's Global product name says “120+ areas”; verified coverage contains 117 destinations, so cards use 117. North America's 5 GB option covers US/Canada (two countries), while its 10/20 GB options cover three. Coverage updates with the selected option.

See [featured-bundles-preview.json](featured-bundles-preview.json) for all twelve actual supplier IDs and projected retail prices. Those are preview prices, not live published prices or hardcoded application data.

## Release prerequisite and administration

**Initial pre-release blocker (subsequently resolved):** none of the 3,283 live records satisfied the new pricing metadata validator; they use the legacy schema and lack pricing version/status and catalogue-date fields. At that initial inspection the live `featured_bundles` collection was empty. Publishing against those records would present products that the new checkout rejects. This feature deliberately does not bypass pricing validation or migrate live prices without review.

After the existing pricing implementation and its migration are approved, the updated existing daily sync will automatically price products and publish bundles. Alternatively an authorised administrator can bootstrap references after a successfully completed, current priced sync. No new environment variable, Firestore index or scheduler is required. Existing Firebase admin credentials, existing rates and public API configuration are reused. Release the API capability before relying on it from the website.

Administrative commands (require existing Firebase Application Default Credentials):

```sh
npm run featured:generate
npm run featured:generate -- --preview-reprice
# Only after the pricing release and explicit authorisation to publish:
npm run featured:generate -- --apply
```

Default is read-only. `--preview-reprice` normalises legacy pricing only in memory and cannot be combined with `--apply`. Apply publishes references for already priced records; it never reprices products, places orders or changes scheduling. A current completed sync is required. Reports go to `/tmp/alozuri-featured-generation.json` with restricted file permissions. The checked-in preview is a safe, public-field-only report from the read-only REST audit, not an apply run.

## Verification

Automated coverage includes deterministic selection, all four regions, missing regions/options, invalid geography/prices/expiry, exact 5% thresholds, retention and replacement, atomic sync publication, idempotency, failed/interrupted sync, stale references, public projections and denied client writes. Browser coverage checks server rendering without catalogue scans, option/coverage/validity changes, currency transitions, missing regions, currency errors, correct product links and the existing cart path at mobile/tablet/desktop widths.

Validated on 11 November 2026:

- `npm test`: 116 passing tests (25 shared, 91 API).
- `npm run test:firestore` with the local Java 21 runtime: 26 passing emulator tests, including regeneration after a supplier cost change.
- `npm run test:e2e`: 22 passing browser tests; the separate real Stripe test is intentionally excluded from this fixture run.
- `npm run test:cypress`: all 13 cases pass.
- `npm run test:stripe` with local Firestore and matching Stripe TEST keys: one real sandbox Payment Element test passes, including decline, replacement-card retry on the same order and paid confirmation. Signed webhook transport is simulated locally; no supplier order or real charge occurs. The retry uses keyboard activation to avoid racing Stripe's optional Link-field expansion on input blur.
- `npm run typecheck`, `npm run typecheck:tests`, `npm run lint`, `npm run build`, changed-file Prettier checks and `git diff --check`: pass.
- Desktop/mobile screenshots reviewed; browser overflow checks cover 375/390/768/1440 px.
- Daily-source/spacing follow-up: all three focused featured-bundle browser tests pass, including measured section gaps; TypeScript, lint, formatting and diff checks pass.

Real Apple Pay/Google Pay authorisation and production fulfilment require a customer device and an actual purchase; this feature does not claim those were exercised by its fixture-based browser tests.

## File map

New implementation files:

- `apps/api/src/lib/featured-selection.ts`, `featured-bundles.ts`, `featured-preview.ts`: selection, publication/read service and administrative preview.
- `packages/shared/src/featured.ts`, `geography.ts`, `GEOGRAPHY_SOURCES.md`, `UNICODE_LICENSE.txt`: public contract, geography and attribution.
- `apps/web/src/components/featured-bundles.tsx`: homepage cards.
- `scripts/run-featured-bundles.mts`: read-only-by-default generation command.
- `apps/api/test/featured.test.ts`, `featured.firestore.mts`, `fixtures/featured.ts`, `tests/e2e/featured.spec.ts`: focused automated tests.
- This document and `docs/featured-bundles-preview.json`: implementation and real catalogue audit.

Existing integration files modified for this feature:

- `apps/api/src/lib/catalogue-sync.ts`, `apps/api/src/app.ts`: existing daily sync and public API.
- `apps/web/src/app/page.tsx`, `components/home.tsx`, `app/globals.css`, `lib/catalogue-server.ts`, `lib/store-proxy.ts`: homepage insertion, styling, SSR data and approved fallback route.
- Root `package.json` and `packages/shared/package.json`: test/admin scripts and shared export; no dependencies added.
- `tests/cypress/support/commerce.ts`: fixture for the new public endpoint; `tests/e2e/privacy.spec.ts`: wait for verified checkout readiness in the existing retry test; `tests/e2e/stripe-sdk.spec.ts`: stable keyboard activation for the replacement-card retry.

Other pre-existing local changes were retained and are outside this feature's scope.

## Authorised production data activation

Following explicit owner approval, the certified pricing migration completed with 3,283 backups and zero remaining changes/review-required products. Manual run [42959737165](https://github.com/RewoloTech/Alozuri-Web/actions/runs/42959737165) of the existing daily workflow then successfully published all four active regional records with source sync `78cd9157-8419-4152-bcdc-e5a41a7f3c61`, sourced at `2026-11-11T04:31:33.729Z`. Its `03:17 UTC` daily cron was unchanged. The live public API verified all twelve variant references in USD/GBP/EUR with no private pricing fields. See the release record for final frontend/checkout activation.
