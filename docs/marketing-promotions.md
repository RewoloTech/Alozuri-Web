# Marketing promotions architecture audit

Before implementation:

- Existing discounts live in `promotions`, managed by `PromotionsPanel` in the
  existing Operations dashboard (`admin.tsx`). They are entered coupon codes,
  percentage-only (1–50%), apply to every cart line by default, and have UTC
  scheduling, usage reservations and settled revenue/discount totals.
- `Promotions` owns validation, holds, Stripe binding, settlement, deletion guards
  and release of abandoned holds. This service must remain the source of truth.
- `CommerceService.priced` calls `priceCart`, then applies a code. Purchase and
  child-order snapshots preserve original/discount/final amounts; the Stripe
  intent receives the server-calculated total.
- `pricing.ts` owns cost, fee and contribution policy. `exchange-rates.ts` owns
  GBP/EUR/USD conversion. Catalogue `packages` documents hold retail prices and
  supplier cost/mapping metadata; catalogue curation also makes value adjustments.
- Public listings, matching/search, featured bundles and product pages have
  separate read paths. All must use one promotion decorator, without changing
  stored base prices, to avoid duplicate discounts and stale campaign prices.
- The root Next layout owns navigation. Homepage and destination routes reuse
  existing components; an announcement above Header and separate page banners
  can reuse the language provider and existing fonts/buttons.
- Current IDs in `packages` originate from eSIM Access SKU hashes. They are not
  yet a fully independent cross-provider product registry. Safe supplier swaps
  need an explicit stable internal product key and verified offer mappings;
  renaming supplier IDs is not a safe substitute.

Implementation must preserve existing records by defaulting new targeting fields
and use existing Operations authorization. Prior uncommitted Buy Again work is
present and will be preserved separately.

## Implemented behavior

The existing `/operations` screen now has **Marketing**, containing Promotions &
Discounts, Website Banners, Campaign Management and Campaign Performance. The
original tab identifier, auth session, admin permission checks and coupon service
are preserved. There is no second admin application or pricing engine.

Discounts still use `promotions`. Missing extension fields mean the original
all-package percentage code behavior. Extensions support internal product IDs,
multiple products, complete destination coverage, verified regional bundle
classifications, tags and explicit product exclusions. Destination selection
matches plans whose **entire coverage** is inside the chosen countries; it does
not discount a large global plan merely because it includes France. Regional
selection reuses existing verified bundle coverage rules (local plans can be
selected by destination). Product tags survive supplier synchronization.

Percentage, fixed USD-cent reduction and optional USD-cent selling price use the
existing checkout FX rates and integer arithmetic. The existing 50% maximum
reduction remains mandatory for every type. Fixed amounts are per unit. Code
promotions may have a USD basket minimum or redemption cap. Automatic catalogue
promotions cannot have either restriction, because a package card must show an
unconditional, purchasable single-item price.

Promotions do not stack. A supplied eligible code replaces automatic promotions
for the basket. Without a code, each line gets its highest-priority matching
automatic promotion; equal priorities resolve by code ascending. A matching
promotion that breaches the configured promotion margin floor blocks that discounted purchase and is
excluded from public catalogue views. It never silently falls back to another
price. The overview lists blocked product/promotion combinations; its margin scan
is bounded to 1,000 active products and discloses truncation.

`promotion-policy.ts` delegates contribution estimates to the existing fee/cost
policy. `CommerceService` validates current supplier cost and FX, applies the
same discount helper as public catalogue decoration, freezes original/final
prices and promotion configuration, and sends the resulting total to Stripe.
Client price/total manipulation cannot authorize a lower charge. Automatic
promotion counters settle inside the existing verified-payment transaction;
replayed webhook deliveries do not increment twice or duplicate fulfilment.
Linked campaigns are rechecked transactionally before a new payment is created.
An already-created payment retains its frozen price, as existing coupon holds do.

## Publication and translation

Banners are independent of discounts. One announcement is selected above the
navigation, and one contextual page banner is selected by priority. Placements
are announcement, homepage, destination ISO code and the existing `europe`
regional page. No unpublished regional routes are invented. Announcement
homepage-only, desktop/mobile, dismissible and UTC schedule settings are separate
from page-banner settings.

Every banner has editable content for all existing website locales, English
fallback, CTA, translated dismissal label, colors and desktop/mobile previews.
Public components contain no hardcoded promotional English copy. Banner copy is
rendered as text, never HTML. CTA/image URLs allow internal paths or HTTPS;
credentials, script schemes, backslashes and protocol-relative URLs are rejected.
Text/background contrast must be at least 4.5:1. No animation was added.

The effective expiry is the earliest banner, promotion or linked-campaign expiry.
Connected discount banners are hidden unless a current matching product passes
margin protection. Public responses strip costs, holds and private purchase data.
Customers can dismiss a revision of a banner; editing it creates a new revision.
The announcement is excluded from checkout, account and administrative screens.

Public JSON and promotion-sensitive Next fetches use `no-store`. A public
publication revision is checked every five seconds while the page is visible,
and on visibility changes. Revision changes refresh the existing currency-driven
catalogue/detail/cart/checkout queries. Scheduled start/expiry is evaluated on
each server read; the client hides expired banners/prices on a one-second timer
until fresh server prices arrive. There is no browser discount calculation.
Base catalogue caching remains in the existing repository; current costs/tags
are reread for automatic discount eligibility. The public endpoint reuses one
catalogue read across linked banners per request. This is bounded polling, not
real-time push or a CDN cache invalidation service.

## Data, routes and security

Existing `promotions`, `packages` and purchase/financial snapshots are extended.
New collections have distinct purposes:

- `marketingCampaigns`: campaign grouping and UTC publication window.
- `websiteBanners`: content, translations, placement and display rules.
- `marketingAudit`: immutable actor/time/before/after records for admin mutations.
- `marketingState/current`: publication revision, updated atomically with edits.
- `marketingAssets`: known asset UUID, MIME type, uploader and timestamp. Binary
  images live privately in the configured Cloud Storage bucket.

The existing Firestore rules already deny all direct client reads/writes; no
relaxation or new composite indexes are needed for the new single-field queries.
Existing coupon indexes remain in use. Admin SDK access stays on the server.

New API routes:

- `GET /v1/marketing`: published public banner projection and revision.
- `GET /v1/marketing/images/:uuid`: known raster asset with immutable caching.
- `GET /v1/operations/marketing`: admin overview, configurations and performance.
- `PUT /v1/operations/marketing/{campaigns|banners}`: audited upsert.
- `DELETE /v1/operations/marketing/{campaigns|banners}/:id`: audited deletion;
  linked campaigns must be paused instead of deleted.
- `POST /v1/operations/marketing/images`: admin-only PNG/JPEG/WebP upload, MIME
  signature validation, maximum 500 KB; SVG and arbitrary storage paths are denied.
- `PUT /v1/operations/promotions/products/:id/tags`: audited catalogue tag update.

Existing promotion routes handle all targeting, pricing types and scheduling.
The storefront proxy only permits the public JSON/image reads, never admin writes.

Performance covers up to 1,000 paid purchase snapshots from the past 30 days and
explicitly reports truncation/invalid excluded records. It groups revenue and
discount by frozen campaign association and currency, with contribution allocated
from the frozen checkout estimate. These are gross historical figures before
refunds and other expenses, **not net profit** or combined-currency totals. Existing
Operations financial reports remain authoritative for reconciled financials.

## Canonical products and supplier independence

Promotion targets are `packages/{internal-id}`, never supplier codes or adapter
IDs. Existing IDs stay intact, even though legacy IDs originated as SKU hashes.
Private `productOffers` mappings inside the existing product document associate
one canonical ID with multiple provider/adapter IDs and exactly one selected
offer. Each mapping must include a reviewed `productServiceHash` from verified
service characteristics. Coverage, allowance, validity, activation, networks,
fair use, speed/restriction metadata and unknown material comparison fields must
match conservatively. Missing verified service metadata blocks a mapping.

`resolveCanonicalProducts` applies these mappings during the existing provider
sync, rejects duplicate mappings or changed service hashes, and retains the
canonical ID, existing price override and tags. A mapping change during sync or
checkout aborts that operation. Switching the selected equivalent offer therefore
does not change promotion targets; the selected cost is still checked against the
margin policy. Mappings are private infrastructure configuration, not unreviewed
customer inputs or automatic guesses about equivalence.

**Boundary:** catalogue mapping and pricing are provider-independent; live
fulfilment still has only the existing eSIM Access adapter. 1GLOBAL and Telna
API ordering integrations have not been implemented or verified here. Checkout
continues rejecting unsupported provider IDs until a real server adapter and its
fulfilment tests exist. No simulated alternate-provider offer is enabled for
production purchases.

## Files

Principal new modules:
`apps/api/src/lib/{promotion-policy,marketing-policy,marketing,canonical-products}.ts`,
`apps/web/src/components/{marketing-panel,website-marketing,promotion-price}.tsx`.

Existing services extended:
`promotions.ts`, `promotion-routes.ts`, `commerce.ts`, `financial-calculations.ts`,
`catalogue-sync.ts`, `package-pricing.ts`, `payments.ts`, `featured-selection.ts`,
`operations.ts`, API `app.ts`, validation, shared plan/search/featured/financial
types, and order-email promotional labels.

Existing website integrations extended:
root layout, Operations navigation and discount editor, currency refresh,
planner/details/featured cards, cart/checkout pricing display, catalogue server
fetches, storefront JSON/image proxy and global styles.

Tests added/extended:
`promotion-policy.test.ts`, `canonical-products.test.ts`,
`marketing.firestore.mts`, `commerce.firestore.mts`, `catalogue.firestore.mts`,
`marketing-panel.test.tsx`, `marketing.spec.ts`, and the existing Operations
real-auth browser scenario. Earlier Buy Again changes in the working tree are
preserved and are not claimed as part of this Marketing implementation.

## Deployment and verification boundaries

Deploy **both API and frontend**. Configure the API with `MARKETING_ENABLED=true`
after verifying the release. It defaults off in `.env.example`, preserving the
current public catalogue until deliberate enablement. Configure
`MARKETING_ASSET_BUCKET` to a private bucket and grant the API runtime service
account object read/write permission. Bucket configuration is a one-time release
step; later campaign edits use the dashboard without deployments. There is no
new public secret or frontend pricing flag. Preserve existing Stripe, supplier,
Firebase, CORS and API proxy settings.

Image upload/download was tested with a controlled storage adapter, including
both image variants and MIME/access controls. A real Cloud Storage bucket upload,
live Stripe charge, live supplier order and production deployment were NOT RUN.
The existing real payment webhook path was tested with signed synthetic Stripe
events and controlled supplier/Stripe mocks in Firestore emulators. Browser
checks use fixtures plus a real isolated Firebase Auth emulator for Operations.
Do not equate these checks with completed live integration acceptance.

## Verification performed (18 November 2026)

- `npm run test:unit`: 38 shared, 250 API and 18 language tests passed at the
  first full unit run. After the canonical-mapping tests were added,
  `npm test -w @alozuri/api` passed all 252 API unit tests.
- `npm run test:jest`: 33 component tests passed, including the existing editor,
  campaign save, translated banner content and separate image upload controls.
- `npm run test:firestore` with Java 21 on `PATH`: 143 integration tests passed.
  This includes catalogue/provider mappings, legacy discounts, commerce,
  settlement replay, fulfilment, private access and financial regressions.
- A later focused Firestore run passed 13 tests: six Marketing scenarios plus
  seven additional checkout tests for fixed/price promotions in all three
  currencies and minimum/expired code rejection. These focused checks reran
  the final overview/link validation after its correction.
- `npm run typecheck`, `npm run typecheck:tests`, `npm run lint`, the targeted
  `prettier --check` and `git diff --check` passed.
- `npm run build` passed for both Next frontend and API.
- The Operations Playwright test passed with the isolated real Auth emulator,
  including the existing discount controls, campaign creation, banner creation,
  permissions/revocation, keyboard navigation and 375/390/768/1440px overflow
  checks. Public Marketing tests cover responsive banners, translated fallback,
  CTA, dismissal, updates, scheduling, expiry, destination/region matching and
  separate image variants.
- Manual screenshot review covered the public homepage at 390px and Operations
  banner editor at 390px. The final refinement separates overview labels/counts
  and keeps the announcement preview compact.

Initial test runs exposed an undefined optional fixture value, an overview
parser that rejected stored bookkeeping fields, and a component test's incorrect
text selector. These were corrected and the affected checks rerun successfully;
there are no concealed failures in the reported passing checks.

The full `npm run test:e2e` regression run completed with **127 passed and 32
skipped** (9.1 minutes). The skipped groups are the repository's opt-in Auth
emulator and real Stripe SDK suites; a separate Auth-emulator Operations run was
executed as described above. Fixture wallet tests are not evidence that Apple Pay
or Google Pay is enabled on a production domain.

A final focused browser pass against the final banner/editor code passed **9 of
9 tests**, using the Auth emulator for Operations. It additionally checks a
mobile-only uploaded image fallback and session dismissal when local storage
rejects banner writes. Final screenshots were manually inspected at public
390px and 1440px, plus the 390px Operations editor; the announcement remains a
slim strip above navigation and the forms have no horizontal overflow.

## Active code rejection retest (18 November 2026)

Live quote requests reproduced RADU15 failing for United Kingdom, 1 GB, 7 days,
USD 1.49 (internal product `esim-40cf91478584a5a5c81b2405`). The API returned
409: minimum contribution margin not met. Its discounted unit price would be
USD 1.27. The code is active and within its schedule; activation alone does not
bypass package-level margin protection. Removing it restores the normal quote.

RADU15 and FRIENDS20 succeeded on a live Egypt quote in GBP. The active 30% code
failed on the cheapest Egypt package but succeeded on a higher-priced Egypt
package in USD, EUR and GBP. All production checks were quote requests; no new
payment, charge or order was created. Examined promotions had no outstanding
holds before these requests.

The misleading error classification is corrected locally: margin/discount/payment
minimum restrictions, targeting failures, basket minima and inactive campaign
eligibility return PROMO_CODE_NOT_APPLICABLE instead of generic validation.
That identifier now has a separate translated message in all 21 locales; it is
not presented as an invalid code. Supplier costs and margin figures are not
exposed in the customer message. Existing discount amounts and margin policy
remain enforced. Both API and frontend must be deployed for this change; a local
frontend using the old live backend will still receive its generic error code.

Validation: eight focused Firestore checkout tests passed, 18 localization tests
passed, three existing promotion/payment browser scenarios passed, and a further
two-scenario browser run passed including Romanian RADU15 feedback and recovery
by removing the code. Typechecks, lint and production build passed. The browser
regressions use controlled quote/Stripe fixtures, separate from live quote checks.

## Merchant-approved negative promotion margins

On 18 November 2026 the merchant explicitly authorized deliberate below-cost
promotions up to the existing 50% discount ceiling. Promotion eligibility now
uses a separate signed setting, `PROMOTION_MIN_CONTRIBUTION_BPS`, default
`-2000` (the merchant’s final chosen floor of minus 20%). Basis points refer to estimated net contribution divided by the
**discounted selling price**, not to the customer discount percentage.

- `-2000`: permit estimated net contribution down to minus 20% of discounted revenue.
  This includes supplier cost, estimated processing fees and configured other costs.
  A discount up to 50% is allowed only if it stays within this floor.
- `0`: require estimated break-even after supplier cost, estimated processing
  fees and configured other costs.
- `1500`: require a 15% estimated promotion contribution margin.

Signed integer values from -10000 through 9999 are accepted. Invalid values fail
startup. The ordinary `PRICING_MIN_CONTRIBUTION_*` settings remain unchanged and
continue to determine regular catalogue prices and supplier revalidation. Their
positive absolute contribution floor no longer blocks promotions. The existing
50% maximum discount, server-side calculations, Stripe currency charge minima,
product eligibility, code scheduling, quota and webhook protections remain.
This explicitly supersedes the earlier positive-margin-only promotion policy
and the prior active-code rejection troubleshooting examples above.

The new setting belongs on the API's Cloud Run service. Deploy the updated API;
set `PROMOTION_MIN_CONTRIBUTION_BPS=-2000` explicitly to record the intended
production policy (the same value is the code default when absent). This task
has not deployed the API or changed its live environment.

A read-only replay with the current UK 1 GB / 7 day product's supplier-cost record
confirmed the updated local policy accepts USD 1.27 with RADU15 and USD 0.75 with
50% off; the latter has negative estimated contribution. No supplier cost figure
was printed, and no live purchase or payment was created. Automated checkout
fixtures verify the 50% discounted amount, negative frozen estimate and duplicate
webhook protection in USD, GBP and EUR, plus the same public automatic USD price.

The final -20% boundary is tested explicitly: for a USD 1.00 sale, supplier
cost USD 0.84 and estimated payment fees USD 0.36 leave -USD 0.20 (accepted).
A supplier amount rounding up to USD 0.85 leaves -USD 0.21 (rejected). The
percentage denominator is the final discounted revenue, not the original price.

Final -20% verification: 254 API unit tests and 10 focused Firestore integration
checks passed, including 50% discounted checkout in USD/GBP/EUR and the exact
cost-plus-fee boundary. API build, test typecheck and targeted lint passed.
The live Cloud Run environment has not been modified by this change.

## Cart and account discount consistency

Cart and checkout share the applied coupon code in Redux. Only the code is saved
in sessionStorage (`alozuri-promotion-code`), allowing the current browser tab's
signup, email-verification redirect, navigation and reload to retain it. Account
cart merging continues to own product IDs/quantities; every changed basket or
currency is quoted again by the server. No client-stored discounted amount is
trusted for payment. This does not synchronize coupons across different devices.

Both cart and checkout's Your order summary show the verified original subtotal,
a separate discount/code row and the final total. Automatic discounts also get
the aggregate discount row. The promotion input and apply/remove controls appear only at the final
checkout step; the cart shows the existing discount without a second input. Removed or ineligible codes trigger revalidation; no discount breakdown
is shown from an unverified quote.

Percentage promotion badges use the configured nominal rate (30% in the reported
GBP example), rather than deriving 29.2% from rounded penny amounts. Currency
amounts retain the existing server rounding. Fixed-amount/promotional-price
badges continue to use their actual effective percentage. The shared summary
also uses a verified quote's nominal rate when receiving older API badge metadata.

Verification: 38 shared, 254 API and 18 localization unit tests passed; 34 Jest
component tests passed; seven Marketing Firestore integration tests passed,
including nominal-rate/penny-rounding parity for manual and automatic discounts.
Eight Playwright scenarios passed with the real isolated Auth emulator, including
signup, verification, merged cart, reload and exact checkout amount at 390px and
1440px. A further GBP compatibility scenario passed with old 29.2% badge metadata
and a verified 30% code, confirming both cart and checkout still display 30%.
A test selector initially matched the cart before navigation completed; scoping
it to checkout corrected that test. Final test typecheck and targeted UI visual
review passed. No live payment or production deployment was performed.
