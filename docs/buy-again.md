# Buy Again / top-up implementation and release gate

Status: **implementation updated for owner-managed deployment and manual live testing**.
Production flags have not been changed by this task. No live Stripe charge or
supplier purchase/top-up was performed. The owner will deploy and test manually.

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
New-profile purchases use the existing order endpoint's documented transaction-ID
deduplication: retries reconcile the exact same immutable request and transaction,
never generate another ID. This guarantee is not assumed for top-up requests.
An expiry after quoting can switch to NEW_ESIM only before any mutation and only
when the same supplier product characteristics and bounded original cost are
revalidated. Otherwise the paid order remains recoverable for manual review.

Daily extensions use the original daily SKU, the purchased number of days
(1–365) and per-day cost. They extend validity rather than increasing daily data.

## Data and security

Existing `purchases` and `orders` gain an optional `repeatDecision` snapshot.
New purchase items and child orders also freeze `originalSupplierPackage` from
verified catalogue attributes, including speed/FUP. Profiles without this evidence
offer NEW_ESIM instead of inferring their original terms from today's catalogue.
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

`POST /v1/operations/orders/:id/topup/reconcile` records a **supplier-confirmed
successful receipt**. It requires a verified administrator, the original transaction
ID, full matching ICCID, supplier top-up reference, confirmed expiry, a request UUID
and a supplier evidence reference. The administrator must obtain confirmation for
that specific transaction from eSIM Access first; a changed balance or expiry alone
does not establish success. The server independently corroborates the physical
profile/expiry, ownership, original supplier order, payment records and persistent
locks. It writes an immutable operator audit, increments once and resumes the existing
receipt/financial worker atomically. Replays retry queue dispatch without another
supplier mutation. Active worker leases must finish before settlement.

Example body (synthetic values; send only over authenticated HTTPS):

```json
{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "supplierConfirmed": true,
  "evidenceReference": "eSIM Access support ticket confirming this transaction",
  "receipt": {
    "transactionId": "tu_original_transaction_id",
    "iccid": "8900000000000000019",
    "expiredTime": "2030-02-01T00:00:00Z",
    "topUpEsimTranNo": "confirmed_supplier_topup_reference"
  }
}
```

Never invent a receipt, reset a counter, release an unresolved lock, or refund and
buy a replacement while a supplier outcome is unknown. If supplier evidence does
not confirm success, retain the reconciliation state and resolve it with supplier
support and the existing payment/Operations process. No automatic uncertain-top-up
refund is introduced.

## Monitoring and remaining live verification

- Use existing delayed/attention order work inventory and the protected top-up
  inspection endpoint to investigate paid orders that do not become ready. Inspect
  `topupState`, the original supplier transaction, retained lock and operator audit.
  Existing queue redrive/recovery remains available; it never resends a pending top-up.
- Customer text and top-up receipts now use all 21 locale catalogues; top-up-only
  emails omit new-installation instructions and QR attachments. Translation tests
  do not replace native-speaker editorial review.
- Shared Firestore permit tests cover concurrent callers, cooldown, expired crash
  leases, network failures and changed lock ownership. Supplier/database outages
  still fail closed; production throughput and alert delivery need observation.
- The owner will perform the live payment/supplier/receipt test. Automated browser
  tests use controlled Stripe/supplier transports and isolated Firebase emulators.
  No native wallet or real eSIM activation is claimed by these tests.

## Configuration and rollout

Existing Secret Manager credentials are reused; neither feature flag is a secret.
The owner has chosen to perform deployment and the live test manually.

1. Publish the new email-logo asset on the frontend with the public feature flag
   temporarily **false**. Verify `/images/alozuri-email-logo-padded-v2.png` returns
   HTTP 200 before releasing the updated mailer. This avoids breaking existing emails.
2. Deploy the updated API/worker to `alozuri-api` in `europe-west4`, project `alozuri`.
   In Cloud Run **Containers → Variables and secrets**, add the ordinary environment
   variable `BUY_AGAIN_ENABLED=true`. Preserve existing credentials and worker settings.
3. Rebuild/deploy the frontend with `NEXT_PUBLIC_BUY_AGAIN_ENABLED=true`. This value
   is now prepared in `apps/web/apphosting.yaml`; a runtime-only change is insufficient.
   Remove the temporary false override. Keep both API and website versions aligned.
4. Sign in with a verified Alozuri account and open **My account → Orders** or
   **My eSIMs**. Ready live orders show **Buy Again**; mobile and desktop share the
   same component. Activation is not required before checking supplier eligibility.
5. Select the UK 1 GB / 7-day package for the manual test. Older orders lacking
   original supplier terms intentionally issue a new eSIM. New verified purchases
   preserve those terms, allowing the next Buy Again to select an eligible existing
   eSIM. Review the checkout's actual retail amount; supplier cost is not retail price.
6. After a successful top-up, confirm one Stripe payment, one supplier transaction,
   an incremented counter and a receipt with no new installation QR. In account usage,
   the refill is not counted as a second physical eSIM. Perform this test through
   Alozuri checkout, rather than topping up directly in the supplier portal;
   out-of-band supplier changes require counter/history reconciliation before
   further automatic top-ups.

API and frontend `.env.example` defaults remain false for unconfigured environments.
An attempted frontend deployment stopped with a Google Cloud permission error before
upload/build/rollout. No production deployment or flag change was completed by this task.

## Validation commands

- `npm run test:unit`
- `npm run test:jest`
- `npm run test:firestore` (includes `buy-again.firestore.mts`; Java 21 required)
- `npm run test:e2e`
- `npm run test:buy-again` (both isolated emulators; Java 21 required)
- `npm run lint`, `npm run typecheck`, `npm run typecheck:tests`, `npm run build`

All supplier mutations in tests use controlled mocks. Test-mode payments never
trigger the live supplier worker. An explicitly authorized real test eSIM is
required for any future live supplier verification.

## Earlier local verification (before this update)

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

These earlier results did not establish supplier-side production correctness.
The update below adds the previously missing browser journey and manual recovery.
No live Stripe charge, supplier purchase/top-up or production data migration was performed.

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

## 2026-11-18 verification update

- Read-only production preflight found a ready, unexpired UK 1 GB / 7-day test
  profile and a supplier-specific refill at US$0.57 wholesale. Retail checkout
  remains server-priced. The preflight made no purchase and wrote no production data.
- Corrected matching: a profile-specific refill may report supportTopUpType=1 even
  when its original eSIM supports top-up. Original capability is still enforced;
  coverage, allowance, duration, type, speed and FUP must match.
- Added frozen supplier terms for new purchases; historical unknown terms fail
  closed to NEW_ESIM, with no fabricated backfill.
- Added audited, administrator-only confirmed-success recovery, including queue
  redrive, duplicate/concurrent settlement, refunded-payment and ownership tests.
- Added a browser journey from the actual account Orders button through payment
  decline/retry, real application services, signed duplicate webhooks, concurrent
  workers, controlled supplier HTTP and a single QR-free receipt. Firebase databases
  and authentication are isolated emulators; the Stripe SDK uses a controlled HTTP
  transport. This is not a live Stripe/supplier transaction.
- Added all 21 locale catalogues for Buy Again and top-up receipts; Romanian and
  Arabic browser checks cover selection and checkout navigation at responsive widths.
- Unit: 38 shared + 258 API + 18 language tests passed. Jest: 35 passed.
- Broad Firestore regression: 162 passed. Formatting, lint, application/test
  TypeScript checks and production build passed. `npm run test:buy-again` passed
  16 focused database/recovery/limiter tests and 3 browser scenarios, including
  the actual account Orders entry, Romanian/Arabic selection, 375/390/768/1440px
  overflow checks, payment retry, duplicate webhooks and exactly one refill/receipt.
  Mobile, desktop and right-to-left screenshots were reviewed.

Deployment and the real paid test are explicitly reserved for the owner. The
public build flag is prepared as true in apphosting.yaml; set the API flag and
follow the asset/API/frontend deployment order above. Neither production flag
was changed by this task.
