# Catalogue pricing audit — 11 November 2026

Read-only supplier fetch: **3283 products**. Compared against
**3283 stored package records** from production. No production
writes, purchases, migrations or deployments were performed. Policy:
`contribution-usd-v2-8988d8d43ad7`.

The old engine's $1.99 minimum, 50-cent rounding and pre-fee margin checks
collapsed low-cost allowances to the same retail price. Every supplier variant
was listed without service-equivalence or dominance checks. The replacement
uses fee-aware contribution, continuous cost bands, explicit value comparisons,
and public-visibility decisions during the existing daily sync. Unrecognised
supplier naming qualifiers and unknown array order remain part of equivalence
checks, retaining ambiguous variants rather than merging them.

Observed supplier costs: p10 $0.77, p25 $1.60, median $4.05, p75 $10.74,
p90 $26.33, p95 $41.47, p99 $93.20. These observations inform versioned cost
bands; they do not change daily price policy automatically.

## Full catalogue preview

- Public: **3,179**; hidden: **96**; review required: **8**.
- Across all stored variants: 377 candidate prices rise,
  1845 fall and 1061 remain unchanged.
  Hidden/review products are included in these price-change counts.
- Lowest estimated contribution among public offers: **$0.51**;
  all pass the configured $0.50 and 15% contribution requirements under every fee scenario.
- Largest comparison family: 17 products.
  Publication guards found no equivalent duplicate or dominated public offers.

## Representative before/after prices

Retail prices are USD. Hidden rows show their candidate price for audit purposes;
they are not public offers. Contribution is per one-item order, after rounded
supplier cost and estimated international + FX fees (5.15% + $0.30). Actual account
fees, taxes, refunds, disputes and overhead may differ. This is contribution,
not net profit. Domestic and EEA scenarios are also checked by the engine.

| Supplier product                           |   Cost | Old retail | Proposed retail | Estimated contribution | Decision                       |
| ------------------------------------------ | -----: | ---------: | --------------: | ---------------------: | ------------------------------ |
| United States 500MB/Day (USIP)             |  $0.47 |      $1.99 |           $1.49 |                  $0.64 | Public: useful variant         |
| United States 1GB/Day (USIP)               |  $0.78 |      $1.99 |           $1.99 |                  $0.80 | Hidden: equivalent higher cost |
| United States 1GB/Day                      |  $0.75 |      $1.99 |           $1.99 |                  $0.83 | Hidden: inferior at price      |
| United States 1GB/Day FUP1Mbps             |  $0.80 |      $1.99 |           $1.99 |                  $0.78 | Public: useful variant         |
| United States 500MB/Day                    |  $0.86 |      $2.49 |           $2.49 |                  $1.20 | Hidden: equivalent higher cost |
| United States 1GB/Day FUP1Mbps (USIP)      |  $0.92 |      $2.49 |           $2.49 |                  $1.14 | Hidden: equivalent higher cost |
| United States 1.5GB/Day                    |  $1.60 |      $3.49 |           $3.99 |                  $1.88 | Hidden: inferior at price      |
| United States 2GB/Day (USIP)               |  $1.47 |      $2.99 |           $2.99 |                  $1.06 | Public: value discount         |
| France 1GB 7Days                           |  $0.70 |      $1.99 |           $1.99 |                  $0.88 | Public: useful variant         |
| France 5GB 30Days                          |  $2.70 |      $5.49 |           $5.49 |                  $2.20 | Public: useful variant         |
| France 20GB 30Days                         |  $8.20 |     $14.99 |          $14.49 |                  $5.24 | Public: useful variant         |
| France 50GB 30Days                         | $17.00 |     $28.49 |          $26.99 |                  $8.30 | Public: useful variant         |
| South America 5GB 30Days                   | $21.00 |     $34.99 |          $32.49 |                  $9.51 | Public: useful variant         |
| Global139 5GB 30Days                       | $20.72 |     $34.49 |          $31.99 |                  $9.32 | Public: useful variant         |
| Japan No-Throttling-Unlimited 3Days (KDDI) |  $6.92 |     $12.49 |          $12.49 |                  $4.62 | Review: review required        |

The $0.75 and $0.78 US 1 GB/512 Kbps products share verified networks, routing,
activation, expiry and other service conditions. Keep the cheaper source as the
equivalence winner. At $1.99, the verified 1 Mbps fallback product is then better
value, so the 512 Kbps offer is hidden; lowering it to $1.49 would breach minimum
contribution. Replacement links resolve to the final public product, but orders
never swap supplier IDs automatically. The expensive 500 MB variant is hidden
behind its cheaper equivalent. Top-up eligibility is compared using documented
supplier conditions; different supported top-up types are not treated as identical.

Eight Japan products claim unlimited in their names while reporting total-data
type and a finite 999 GB volume. They are quarantined rather than silently sold
as verified unlimited. Their records and source names remain available for review.

## Implementation and rollout

Authoritative pricing: `apps/api/src/lib/pricing.ts` and `package-pricing.ts`.
Comparison: `catalogue-curation.ts`. Sync, repository, legacy checkout and cart
validation integrate the same price and visibility policy. Private history lives
under `packages/{id}/pricingHistory`; original supplier codes and historical order
snapshots are preserved. The offline report is reproducible with:

`node --import tsx scripts/audit-catalogue-pricing.mts <stored-export.json> <supplier-export.json> <private-output.json>`

The full private report for this run is `/tmp/alozuri-pricing-comparison.json`.
No secrets or customer records are included in this document.

Confirm actual processing fees, FX settlement, direct costs and applicable tax
treatment before adopting these assumptions. Pause checkout/import writes for
the version transition, deploy the reviewed matching backend, run a fresh supplier
sync, inspect review flags/curation, verify sandbox checkout, and resume only after
verification. The old version's production records will not pass the new policy
version check; deploying without a planned sync would make products unavailable.
The price-only migration alone cannot populate supplier comparison metadata.
GBP/EUR conversion now rounds to whole cents, without a second marketing price
step that could make different USD prices equal again.

The current localhost storefront points at the deployed API, so it will continue
to show existing prices until the reviewed backend and fresh catalogue are released.

## Validation

- `npm run lint`, `npm run typecheck`, `npm run typecheck:tests`: passed.
- `npm test`: 35 shared and 109 API tests passed, including every supplier-unit
  increment through $40, fee contribution checks, classification, equivalence,
  unknown restrictions, value discounts, stable prices and FX rounding.
- `npm run test:firestore`: 35 passed, including curated sync, no-op repeat
  imports/history, retained supplier IDs, $1.49 quotes and hidden-plan rejection.
- `npm run test:e2e`: 65 passed; one optional real Stripe test skipped in this
  fixture-only run.
- Separate real `npm run test:stripe` runs in USD, GBP and EUR: one passed each,
  exercising declined card, retry on the same intent and verified paid state.
  The fixture uses the new $1.49 USD price; signed webhook transport is simulated
  locally. Firestore and fulfilment are isolated test fixtures.
- `npm run build`: frontend production build and API build passed. The API was
  rebuilt after the final curation changes.
- Standalone TypeScript checks for both changed audit/Stripe scripts passed.
- Manual/read-only checks: fresh supplier catalogue retrieval, production
  catalogue export, all-catalogue comparison, and inspection of the supplied
  screenshot. No new visual layout change was made.

No live payment, supplier purchase, production write or deployment was performed.
Actual live fees, tax treatment, wallet authorisation and supplier delivery were
not verified by these local tests.
