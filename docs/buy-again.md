# Buy Again / top-up implementation and release gate

Status: **disabled by default; not approved for production activation**.
No live supplier purchase or top-up was performed.

## Existing architecture reused

- `supplier.ts`: the signed eSIM Access client, now with profile-specific TOPUP
  catalogue, profile lookup by esimTranNo and a non-retrying top-up mutation.
- `commerce.ts` and `commerce-routes.ts`: server catalogue pricing, currency
  conversion, guest/account PaymentIntents, verified Stripe webhooks, immutable
  purchases and child orders. Buy Again requires a verified account; ordinary
  guest checkout is unchanged.
- `fulfillment.ts`, `order-worker.ts`: existing paid-order claims, payment
  verification, durable work and delayed/attention recovery. No second worker.
- `order-confirmations.ts`, `order-email-installation.ts`: existing durable email
  claims and provider idempotency; top-up receipts omit the QR attachment.
- Existing Operations authorization protects the top-up inspection endpoint.

## Added flow

`POST /v2/buy-again/options` accepts an owned child order ID. It considers owned,
ready live profiles of the exact product, checks the supplier's current profile
and expiry, then obtains the fixed-data TOPUP catalogue for that ICCID. Unknown
statuses, deleted profiles, uncertain expiry, unknown counter history and
ambiguous package variants fail closed. Usage balances are not eligibility.
Multiple candidates are returned masked; the UI requires a choice. One candidate
is preselected; buying a new eSIM is always available.

`POST /v2/buy-again/quote` stores a ten-minute private quote in `buyAgainQuotes`.
Customer pricing is the existing catalogue/product price, using existing currency
conversion. Checkout verifies the quote's owner, product identity, expiry, single
quantity and current price. Promotion codes use the existing central pricing,
validation and reservation path. Top-up
cost cannot exceed the current base cost; higher cost requires review. Purchase
idempotency derives from the quote ID so repeated checkout requests using that
quote cannot create a second payment. The existing Buy now checkout isolates the
item without overwriting the browsing cart.

After verified payment, TOPUP uses the existing fulfilment path. A transaction
claims the original private activation record and writes a persistent mutation
marker before contacting the supplier. Success increments its counter and stores
a sanitized receipt exactly once. A shared lock/counter keyed by the hashed
supplier esimTranNo also protects against duplicate local profile records. Unknown results retain their lock and original
transaction ID indefinitely: worker retries never submit another mutation.
Unknown new-profile purchase results also retain their mutation marker and never
blindly repeat the supplier order. An expiry after quoting can switch to NEW_ESIM only before any mutation and only
when the same supplier product characteristics and bounded original cost are
revalidated. Otherwise the paid order remains recoverable for manual review.

Daily extensions use the original daily SKU, the purchased number of days
(1–365) and per-day cost. They extend validity rather than increasing daily data.

## Data and security

Existing `purchases` and `orders` gain an optional `repeatDecision` snapshot.
`orderActivations` gains `topUpCount`, `topUpHistoryKnown`, and a persistent
`topupLockOrderId` during mutation. Future newly fulfilled profiles initialize
known-zero history. Historical profiles without verified history are not assumed
to have zero top-ups. Orders record supplier transaction ID, pending/success state
and the confirmed supplier reference/expiry. Original activation credentials stay
private; browser options receive only masked ICCIDs.

`buyAgainQuotes`, `serviceLocks/topup_<hashed profile>` and
`serviceLocks/esimAccessHttp` are server-only under the
existing deny-all client Firestore rules. New queries use existing single-field
indexes; no new composite index is required. Quotes expire in application logic;
configure retention cleanup separately if needed.

When enabled, supplier HTTP calls share a Firestore permit across instances with
one active call and a 150ms cooldown (conservatively below 8 requests/second).
The crash lease exceeds HTTP timeouts. This includes the existing catalogue call
path. Database failures fail closed rather than bypassing the limiter.

## Operations and unresolved supplier results

`GET /v1/operations/orders/:id/topup` exposes the sanitized transaction/reference,
state and source profile to an authorized administrator. Existing order work
recovery exposes delayed/attention orders. A timeout or uncertain response must
be investigated against supplier records using the stored transaction ID.
Do not clear the marker/lock or issue a replacement while the outcome is unknown.

**Release blockers / incomplete acceptance criteria:**

- An authoritative, tested reconciliation workflow for uncertain supplier outcomes
  is not implemented. The documented profile lookup does not establish whether a
  particular timed-out transaction succeeded. Inspection is available; resolution
  requires supplier evidence and a separately reviewed administrative operation.
- Full browser + Stripe + webhook + supplier-mock + email Buy Again journeys have
  not yet been implemented as one end-to-end test. Existing checkout regressions,
  eligibility tests, UI component tests and Firestore concurrency tests cover
  separate boundaries, not every acceptance criterion.
- Original historical speed/FUP metadata and any out-of-band supplier top-ups need
  reconciliation before enabling top-ups for old profiles. Never backfill zero
  without evidence. The implementation compares SKU, coverage, volume, duration,
  data type, FUP and speed for supplier candidates and freezes quote identity.
- New customer-facing Buy Again and top-up email text needs translation and
  locale review before this multilingual storefront exposes the feature.
- Cross-instance limiter load/crash testing, monitoring/alert configuration,
  operator reconciliation tests and a controlled live supplier verification are
  still required. No automatic refunds are initiated for uncertain top-ups.

## Configuration and rollout

Keep `BUY_AGAIN_ENABLED=false` on the API and
`NEXT_PUBLIC_BUY_AGAIN_ENABLED=false` on the website until the blockers above
are resolved. Existing Secret Manager credentials are reused; no new secret or
payment integration is needed. After release approval, deploy API/worker first,
then rebuild/deploy the frontend with its feature flag. Do not enable the website
flag against an older backend. No deployment was performed during implementation.

## Validation commands

- `npm run test:unit`
- `npm run test:jest`
- `npm run test:firestore` (includes `buy-again.firestore.mts`; Java 21 required)
- `npm run test:e2e`
- `npm run lint`, `npm run typecheck`, `npm run typecheck:tests`, `npm run build`

All supplier mutations in tests use controlled mocks. Test-mode payments never
trigger the live supplier worker. An explicitly authorized real test eSIM is
required for any future live supplier verification.

## Recorded local verification

- `npm run test:unit`: 38 shared + 244 API + 18 language tests passed.
- `npm run test:jest`: 31 passed.
- `npm run test:firestore`: 132 passed in the broad regression run.
- Focused commerce + Buy Again emulator run: 96 passed, including quote/payment
  idempotency and duplicate webhook allocation. Final Buy Again concurrency and
  expiry run: 9 passed, including the ninth-top-up race and duplicate profile records.
- `npm run test:auth`: 3 passed.
- `npm run test:e2e`: 120 passed, 31 skipped. Skips remain skips, not passes.
- Local Auth emulator Buy Again browser test: 1 passed, covering zero/one/multiple
  profiles, explicit selection, authenticated requests, checkout navigation and
  overflow at 375/390/768/1440px. Mobile and desktop screenshots were reviewed.
- Lint, application/test TypeScript checks, formatting, whitespace and the web/API
  production build passed. A temporary Java 21 runtime was used for Firestore.

These results do not establish supplier-side production correctness or satisfy
all acceptance criteria. Full payment/fulfilment browser coverage and operational
reconciliation remain release blockers. No live Stripe charge, live supplier
purchase/top-up, deployment or production data migration was performed.

## Supplier references reviewed

- [Official API documentation](https://docs.esimaccess.com/): profile lookup,
  profile-specific TOPUP lists, top-up request/response fields, daily periodNum,
  signing and rate limits. The order endpoint explicitly documents duplicate
  transactionId handling; that must not be assumed for the separate top-up API.
- [Official top-up guide](https://esimaccess.com/docs/how-to-top-up-a-data-plan/):
  top-up limits and compatible-package guidance.

## Files in this change

Created:

- `apps/api/src/lib/buy-again.ts`
- `apps/api/src/lib/supplier-rate-limit.ts`
- `apps/api/src/lib/topup-eligibility.ts`
- `apps/api/test/buy-again.firestore.mts`
- `apps/api/test/topup-client.test.ts`
- `apps/api/test/topup-eligibility.test.ts`
- `apps/web/src/components/buy-again.tsx`
- `docs/buy-again.md`
- `tests/fixtures/buy-again.tsx`
- `tests/jest/buy-again.test.tsx`

Modified:

- `apps/api/.env.example`
- `apps/api/src/app.ts`
- `apps/api/src/lib/commerce-routes.ts`
- `apps/api/src/lib/commerce.ts`
- `apps/api/src/lib/fulfillment.ts`
- `apps/api/src/lib/operations.ts`
- `apps/api/src/lib/order-confirmations.ts`
- `apps/api/src/lib/order-email-installation.ts`
- `apps/api/src/lib/supplier.ts`
- `apps/api/test/commerce.firestore.mts`
- `apps/api/test/fulfillment.test.ts`
- `apps/api/test/order-email-installation.test.ts`
- `apps/web/.env.example`
- `apps/web/src/components/checkout.tsx`
- `apps/web/src/components/purchase-status.tsx`
- `apps/web/src/lib/store-proxy.ts`
- `package.json`
- `scripts/run-e2e-server.mjs`
- `tests/e2e/cart-auth.spec.ts`
