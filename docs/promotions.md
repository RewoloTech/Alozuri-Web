# Phase 1 promotions

Status: backend and promotions index deployed to production on 13 November 2026 following explicit approval. Frontend deployment remains pending.

## Behaviour and architecture

- Operations → Promotions uses existing verified Firebase administrator access. Every management, package lookup and preview request passes the existing server administrator check. Codes are uppercase, immutable identifiers (3–32 letters, digits, hyphens or underscores); edits preserve counters and reservations. Search is a code prefix, with active/inactive filtering and 20-code server pages.
- One percentage code per purchase, whole numbers 1–50. The strict API schemas reject extra discount/price fields and stacking. Start/expiry fields in Operations are explicitly UTC. Previews use a selected active, current, provenance-validated live USD catalogue package and its supplier wholesale quote. Conservative estimated Stripe fees use existing pricing policy; warnings are advisory, including negative contribution.
- The store already uses PaymentIntents and Stripe Payment/Express Checkout Elements. Native Stripe coupon/promotion-code flows are principally Checkout/Billing flows; Phase 1 keeps the embedded integration and calculates the PaymentIntent amount in the backend. No new Stripe coupons, subscriptions or payment configuration are needed. Account/domain/payment-method configuration remains existing configuration and needs sandbox verification before release.
- Checkout revalidates catalogue, FX and code before creating an intent. Discounts round **down per unit in checkout currency**, then multiply by quantity. This never exceeds the chosen percentage and preserves exact per-eSIM refund allocation. Existing per-profile payment/fulfilment minimums still apply. Supplier wholesale cost, supplier SKU and canonical original USD retail remain unchanged.
- Purchase records freeze `promotion`, `originalRetailCents`, `discountCents`, each item's `originalPriceCents`, discounted unit prices, original supplier quotes and FX. Existing `financial` records add the promotion, discount and a clearly labelled `checkoutEstimate` (native checkout currency, one estimated processing fee per payment, before refunds). Existing actual Stripe settlement/refund and supplier reconciliation remain authoritative. Later catalogue or promotion edits cannot rewrite an order.
- Confirmation email and purchase contract metadata show original retail and discount for promoted orders; historical orders without a promotion retain their existing format.
- Financial Overview → Promotion performance uses its existing inclusive Europe/London order-date range. It groups paid orders by code and original currency, shows refund-adjusted revenue, original discounts granted, GBP costs/fees/contribution, provisional status and daily paid usage. Existing transactions show the code/discount and frozen checkout estimate. No new date queries or financial jobs are added.

## Limited-use reservations

A Firestore transaction reserves a slot alongside purchase creation. Limits include paid redemptions plus pending reservations, preventing simultaneous checkouts from overselling a code. Only a verified first successful payment increments redemptions and original-currency gross sales/discount totals; webhook replay is guarded by existing purchase/event idempotency. Cancellation releases a hold. Declined payments can retry the same intent without another redemption. Refunds retain the historical redemption and original discount; Financial Overview reports their net revenue and actual financial effect.

Pending holds older than 30 minutes are reclaimed **on demand when the code is quoted/used**, at most ten per call. The backend retrieves and cancels the unpaid Stripe intent before freeing a slot. Processing/succeeded payments and unknown cancellation outcomes keep their holds. Binding and cleanup races are checked transactionally; a newly created intent whose hold expired is cancelled before its client secret is returned. This does not introduce a scheduler, polling loop or background service. An already-issued intent remains payable until it is cancelled; date expiry/deactivation stops new reservations, while existing reservations are honoured until paid/cancelled/reclaimed.

The per-code reservation map is capped at 100 concurrent pending purchases to bound document size. This is separate from the configurable paid-use limit. Very high future contention would need a different reservation design; current scale does not warrant new infrastructure.

## Release/configuration

1. Review changes and approve production deployment separately.
2. Deploy the `promotions` composite index in `infra/firestore.indexes.json`: `active ASC, code ASC`. Existing indexes remain intact. Wait until ready before enabling status-filtered lists.
3. Deploy backend first, then frontend; the old backend rejects the new strict `promotionCode` request field. Use existing deployment commands. No database backfill, migration, new secrets, native Stripe coupon configuration or scheduler is required.
4. Firestore rules remain deny-all for direct browser access, including `promotions`; only the existing backend Admin SDK accesses this collection.
5. Use an isolated Firebase/Stripe test environment for payment acceptance testing. Do not run fixtures or sandbox purchases against the production database.

## Verification checklist

Automated tests cover:

- [x] Whole-number ceiling/no stacking, 5/10/15/20/25/30/40/50% rounding, dates and invalid/exhausted/inactive codes.
- [x] Package-specific normal/reduced/low/negative contribution warnings and explicit estimated fees.
- [x] Guest/account checkout and GBP/EUR/USD; exact discounted Stripe amounts and frozen supplier costs.
- [x] Concurrent one-use reservations, failed/cancelled/abandoned intents and duplicate success events.
- [x] Historical discounts, costs and checkout estimates through partial/full refunds.
- [x] Existing fulfilment with controlled supplier/Stripe mocks; no duplicate supplier purchase.
- [x] Server administrator enforcement and strict management/preview boundaries; pagination.
- [x] Browser apply/remove/invalid code, checkout review, existing guest/auth/cart flows and Operations management at mobile/desktop sizes.
- [x] Existing destination mode/navigation and wallet fallback regressions with controlled Stripe UI mocks.

Before production acceptance (not performed by this local task):

- [ ] New Firestore index ready in the intended project.
- [ ] Isolated Stripe test-mode card payment with a code, decline/retry, partial/full refund; inspect actual settlement fees.
- [ ] Eligible Android Chrome Google Pay and Apple Pay device payments on registered HTTPS test domain.
- [ ] Approved supplier sandbox or explicitly approved live fulfilment; check delivery and historical costs.
- [ ] Live email rendering and real Firebase administrator/customer access after release.

Mock/emulator tests do not establish live wallet, supplier or email deliverability. Existing missing supplier debit evidence or settlement FX continues to produce provisional financials.

## Files and local verification

- `apps/api/src/lib/promotions.ts`: code validation, management, transaction reservations and paid-use accounting.
- `apps/api/src/lib/promotion-routes.ts`, `promotion-estimate.ts`, `promotion-report.ts`: protected management/preview endpoints, frozen estimates and date reporting.
- `apps/api/src/lib/commerce.ts`, `commerce-routes.ts`: validated discount quotes, checkout snapshots and webhook integration.
- `apps/api/src/lib/financial-calculations.ts`, `operations.ts`, `packages/shared/src/financial.ts`: historical financial schema and reporting.
- `apps/api/src/lib/confirmation-order.ts`, `order-email.ts`: promoted purchase contract/email disclosure.
- `apps/web/src/components/promotions.tsx`, `admin.tsx`, `checkout.tsx`, `cart.tsx`, `apps/web/src/app/globals.css`: management/reporting UI, checkout apply/remove and quote display.
- `infra/firestore.indexes.json`: promotion status/code index; no rule changes.
- Promotion unit tests, commerce/financial emulator tests and shopping/account browser tests accompany these changes.

Executed locally on 13 November 2026:

- `npm run test:unit`: 38 shared + 179 API tests passed.
- `npm run test:firestore` (isolated emulator, Java 21): 106 tests passed, including discounted supplier fulfilment and refund accounting.
- Auth-emulator Playwright runs of `tests/e2e/cart-auth.spec.ts` and `tests/e2e/shopping.spec.ts`: all 38 distinct checks passed across the broad run and focused reruns. Initial failures (client directive placement and test locator selection) were corrected; focused Operations and promotion checkout checks both passed afterwards.
- `npm run typecheck`, `npm run typecheck:tests`, `npm run lint`, production `npm run build`, Prettier checks for changed files and `git diff --check`: passed.
- Screenshots inspected for promotion checkout and Operations at 390px and desktop; browser overflow checks also exercised 375px and 768px. Keyboard tab navigation is covered in the Operations browser scenario.

During local implementation/testing, no production deployment, live database mutation, live Stripe payment, live supplier purchase or confirmation email send was performed.

## Approved backend/index deployment — 13 November 2026

- Created the `promotions` collection composite index (`active ASC`, `code ASC`) in project `alozuri`, default database. Index `CICAgJiUpoMK` reached `READY`. Read-only production queries with active filtering and a code prefix both succeeded.
- Ran `npm run deploy:api` with the existing authenticated Google Cloud CLI wrapper. Cloud Build `0233ad56-e914-42c8-aa54-dd1d47ab69ee` succeeded; Cloud Run revision `alozuri-api-manual-20261113020121452` is Ready and serves 100% of `alozuri-api` traffic in `europe-west4`.
- Live checks: `/health` returned HTTP 200 with catalogue/live payments enabled; unauthenticated promotion management/preview requests returned 401; a forged discount/invalid quote payload returned 400. No ERROR logs were returned for the new revision during verification.
- Frontend was not deployed in this step. No promotion codes or customer/order records were created or edited, and no live payment, supplier purchase, email send or scheduler change was made.
- Prior revision retained for rollback: `alozuri-api-manual-20261113012452703`.

## Save-button feedback refinement

The frontend save action now lists missing or invalid code, dates, percentage, usage limit or package preview beside the button instead of silently disabling it. The button disables while a request is in progress. A successful save has an explicit confirmation. This refinement requires a frontend deployment; the backend and index are unchanged.

The Operations quick-select buttons include 40% and 50%. The maximum discount is 50%, enforced for saving codes, previews, stored snapshots and checkout calculations. Deploy the API before the web update so the server accepts the higher discounts. Existing minimum payable amounts and advisory profitability warnings still apply.
