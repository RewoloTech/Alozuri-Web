# Operations dashboard

The combined dashboard is `/operations`. `/admin` redirects there for old links.
Its Financial Overview and Pricing History sections share protected navigation.
Financial Overview contains six metrics, a date-only report and paginated
transactions; an expandable service-configuration overview remains available. There is no new service, database
or scheduled financial job.

Transaction rows include unpaid checkout attempts, labelled “Awaiting payment”,
and cancelled checkouts. These are excluded from financial summary totals;
profit and supplier cost are not presented as pending financial calculations for
unconfirmed sales. Paid orders retain provisional figures and expandable reasons
until actual historical supplier and Stripe information is available. Older
orders may require the reliable-data backfill described below.

Country lists longer than three entries are collapsed under a country-count
summary in both sections. Click or keyboard-activate the summary to view the
complete recorded coverage list.

## Grant access once, from a trusted terminal

1. Create your user in Firebase Authentication and sign in through the normal
   Alozuri login page. Verify the account's email using the existing flow.
2. Authenticate the local Admin SDK with an operator account that has Firebase
   Authentication administration permission in the intended project:
   `gcloud auth application-default login`.
3. Copy the intended account's UID from Firebase Authentication. Run:

   ```sh
   npm run operations:admin -- --project alozuri --uid YOUR_UID --confirm-uid YOUR_UID --grant
   ```

4. Sign out of Alozuri and sign back in to obtain the new ID token. Open
   `https://alozuri.com/operations` or use the Operations account-menu link.

No email, password or UID is embedded in application code. The tool preserves
unrelated custom claims. There is no browser/API role-assignment endpoint. To
remove access, replace `--grant` with `--revoke`; this also revokes refresh tokens.
If the API's optional `ADMIN_OWNER_UID` is configured, the granted account must
also match that restriction. Granting the custom claim cannot override it.
Never distribute service-account credentials to customers.

Every `/v1/operations/*` API operation verifies the Firebase token, verified email
and current administrator permissions. The existing authentication helper checks
revocation and re-reads the current user's admin claim. Financial APIs reject
ordinary, anonymous, disabled and revoked administrator accounts. The browser's
menu claim is only a navigation hint. Existing deny-all Firestore client rules
remain in force; financial writes use backend IAM/Admin SDK access. Customer API
responses explicitly select public fields and do not expose financial snapshots.

## Financial basis

- The transaction is a purchase, not each individual eSIM allocation. Child
  orders are excluded from the report so quantities never double-count sales.
  Legacy standalone orders are included separately.
- Existing order documents hold a `financial` object. New checkout captures the
  ordered products and original supplier units (1/10,000 USD), quoted amount,
  currency, supported discounts (zero in the current checkout), customer,
  creation timestamp and historical FX. These never come from browser prices.
- A supplier order reference confirms a purchase, but not its actual debit.
  Historical quoted supplier costs and profit stay provisional until matched
  supplier transaction evidence is recorded (see Supplier cost reconciliation).
  Unknown purchase outcomes remain pending; refunds retain already purchased costs.
- Payment and refund events retrieve the current Stripe charge and expanded
  balance transactions. Settled refunds adjust revenue; original fees are retained
  unless Stripe records a fee adjustment on the related balance transactions.
  Pending refunds, missing balance transactions or disputes remain provisional.
- GBP Stripe settlement amounts and fees are preferred. Original currencies,
  transaction references and Stripe exchange rates are retained. If settlement
  is not GBP or is unavailable, frozen FX can supply provisional revenue, but
  profit cannot be final without actual GBP fees. Original USD supplier units
  are valued in GBP using the frozen historical reference rate; this is not a
  claim that the supplier charged your bank a particular GBP amount.
- Financial values use integer amounts and rational FX arithmetic. Profit is
  revenue less purchased supplier costs and payment fees, before other operating
  expenses and taxes. Zero-revenue margins are undefined, not 0%.
- Date ranges use **order creation time**, inclusive calendar days in
  Europe/London (including daylight-saving changes). Refunds restate their
  original order within that cohort, not the refund date's cohort. Total Sales
  counts paid orders, including subsequently refunded ones; Revenue is net of
  settled refunds. Test payments do not contribute to live reports.
- A payment/refund webhook marks its financial reconciliation pending until the
  verified Stripe refresh completes. Unknown historical refund totals are null,
  never assumed to be zero. Missing data displays Pending; a summary with any missing component does not
  silently add zero. No historical cost is sourced from today's catalogue.

## Events and deployment

Deploy the API and manually roll out the website from the same reviewed source.
The Stripe webhook endpoint remains `/v1/webhooks/stripe`; retain existing
subscriptions and include `charge.updated`, `charge.succeeded`,
`payment_intent.succeeded`, `payment_intent.processing`,
`payment_intent.payment_failed`, `charge.refunded`, `refund.created`,
`refund.updated`, `refund.failed`, `charge.dispute.created` and
`charge.dispute.closed`. Retain Checkout Session events for legacy orders.
`charge.updated` repairs the normal asynchronous delay before Stripe exposes a
balance transaction; no daily financial sync is needed. Configure these events
in the same live/test mode as the API. Do not use the account-wide balance event
as an order attribution source when sharing Stripe across brands.

Stripe's charge balance-transaction fees cover the integration's transaction
fees. Separately invoiced account-level adjustments and IC+ fee reports are not
allocated by this dashboard; missing/inapplicable actual fee data must be
reviewed rather than substituted with the pricing algorithm's fee estimates.

## Historical backfill

Preview a bounded date range using trusted Application Default Credentials:

```sh
npm run operations:backfill -- --project alozuri --from 2026-11-01 --to 2026-11-30
```

Add `--apply --confirm-project alozuri` to write snapshots. To recover actual fees,
supply the existing Stripe secret through the operator environment (never paste
it into source code or commit it). Without that secret, only reliable stored
order/supplier data is recovered; missing fees and historical exchange data stay
pending. Up to 500 documents per collection are allowed per backfill range; use
smaller date ranges if needed. The tool never changes prices, payments, supplier
orders or fulfilment state.

## Query cost and indexes

Report reads are projected, scoped to the selected creation-date range and
bounded to 5,000 records per collection. The small-business implementation sums
that selected range on the backend, then returns 25 transaction rows with a
cursor; each page reports the same complete-range summary. Larger ranges are
rejected instead of silently returning incomplete totals. There is no scan of
unrelated dates and no stored aggregate service. This uses Firestore's standard
single-field `createdAt` descending index and `parentOrderId` equality index;
no additional composite index is required for these query shapes. If volume
outgrows the bound, introduce event-maintained aggregates before raising it.

## Configuration observed during implementation

A read-only check found the production Stripe default currency is GBP. The
existing Alozuri webhook endpoint was enabled but did not subscribe to
`charge.updated`, `charge.succeeded`, `refund.created` or
`charge.dispute.closed`. Add those four subscriptions when releasing the API.
No live webhook setting, administrator claim, historical record or deployment was
changed during implementation. This observation is not a guarantee of future
Stripe configuration.

## Pricing History

`/operations` has two keyboard-accessible sections: **Financial Overview** and
**Pricing History**. Both use the same server-verified administrator permission.
The pricing API is `GET /v1/operations/pricing-history`; the public storefront
proxy does not forward it. Customer Firestore access remains denied by the
existing rules.

The existing daily sync and checkout revalidation continue writing only to
`packages/{packageId}/pricingHistory/{historyId}`. There is no second history
collection or scheduled job. New entries extend the existing `before`/`after`
audit record with a frozen package name/destination, exact supplier units
(1/10,000 USD), selling cents, direction, percentage movement and gross-margin
changes. Pricing calculations and selling-price rules are unchanged.

- Price-change percentages refer to supplier prices. Current/new values are the
  prices **after that recorded change**, not values looked up from today's
  catalogue. All pricing history is USD, independent of GBP order reporting.
- Margins are catalogue gross margins before payment fees, operating expenses
  and taxes. They do not claim to be actual order profit. Old/new margins and
  percentage-point movement are shown separately from supplier percentage change.
- A first observation is a baseline, not a zero-priced previous product. Missing,
  invalid or zero sentinel prices are unavailable; they are not presented as free.
- Unchanged daily runs do not add price points. Existing availability/review-state
  audit changes may legitimately show unchanged prices. History IDs include the
  previous document version so genuine A→B→A→B price movements in one day remain
  distinct, while transaction retries and unchanged syncs remain idempotent.
- Supplier withdrawal marks the existing product inactive; history is retained.
  New history labels survive even if a parent package document is later deleted.
- Older audit records are reused directly. If they have no frozen identity, the
  UI explicitly labels a current name/destination fallback. If the package no
  longer exists, it displays its ID without inventing historical metadata.

The date range uses inclusive Europe/London calendar dates. Reports query only
that range, with 25-row Firestore cursor pagination (including nanosecond and
record-path ordering). **View history** scopes the same table to one package and
retains the selected date range; **All packages** returns to the catalogue view.
No current catalogue scan or historical price rewrite is required.

### Pricing-history index release

The new collection-group report requires a descending `recordedAt` collection-
group index. Its configuration is in `infra/firestore.indexes.json`, referenced
by `firebase.json`; per-package collection indexes are preserved. The read-only
project inspection during implementation found no existing composite indexes.
Deploy the index configuration using an appropriately authorized Firebase CLI:

```sh
firebase deploy --only firestore:indexes --project alozuri
```

Wait for index creation to complete, deploy the API, then manually roll out the
website. The emulator tests do not establish production index readiness. No live
index, scheduler, pricing rule, financial transaction or role assignment was
changed for this feature.

## Supplier cost reconciliation

A catalogue quote is not proof of a supplier debit. `financial.supplier.quotedUnits`
preserves the checkout quote; `purchasedUnits` tracks that historical quoted cost
for profiles actually ordered. `verifiedUnits` is the separate sum of confirmed
supplier charges. Costs and profit use the verified sum when available; otherwise
they use the purchased historical quote and are explicitly **provisional estimates**.
Existing records without charge evidence also remain provisional. Refunds do not
remove costs of profiles that were already purchased. Explicitly rejected purchases
or confirmed unattempted cancellations can have a verified zero cost.

The documented eSIM Access ordering response supplies an order reference, and the
profile query supplies allocation details, not a transaction debit ledger. Do not
use today's catalogue, an account balance difference, or an unverified portal price
to rewrite historical costs. There is no additional scheduler or polling job.

To reconcile actual debits from an original supplier transaction statement, a
trusted operator can prepare a private JSON file (outside Git) with this structure:

```json
[
  {
    "orderId": "ORDER_DOCUMENT_ID",
    "charge": {
      "amountUnits": 5200,
      "currency": "USD",
      "supplierOrderNo": "SUPPLIER_ORDER_NUMBER",
      "source": "supplier_statement",
      "reference": "STATEMENT_TRANSACTION_REFERENCE"
    }
  }
]
```

The amount above is an example: use the **actual debit** in 1/10,000 USD units
($0.52 = 5200), matched to that exact order. Keep the source statement privately.
Validate without writing first:

```sh
npm run operations:supplier-cost -- --project alozuri --file /private/path/charges.json
```

Then apply the validated statement:

```sh
npm run operations:supplier-cost -- --project alozuri --file /private/path/charges.json --apply --confirm-project alozuri
```

This uses existing operator ADC/IAM permissions, never a browser role or public
endpoint. Each immutable `orders/{id}.supplierCharge` records the USD amount,
supplier order number, statement reference and verification time. Exact replays
are harmless; conflicting charges, wrong supplier references and non-live/unpaid
orders are rejected. Every purchased unit needs evidence before the aggregate
cost becomes verified. The tool refreshes the existing purchase financials while
preserving Stripe fees, original quotes and frozen exchange rates. It never
creates supplier purchases, charges customers, sends email or changes catalogue pricing.

Roll out the backend and frontend together for these new fields and labels;
legacy snapshots are treated as unverified automatically, with no full-database migration.

## Finding an eSIM for support

In Financial Overview, expand **eSIM details** beside an order, or use the **Orders**
search field with the customer's full `AZ-…` order reference, eSIM Tran No, supplier order number or complete customer email. Full internal order
IDs also remain supported. The lookup uses bounded Firestore index queries, including
historical order references, without scanning the catalogue or all orders. The
financial date filter remains separate from this exact support lookup.

Each allocated eSIM shows its supplier order number, `esimTranNo`, fulfilment
state, supplier lifecycle state, installation state, used data, and fixed-plan
remaining data when reported. No QR code, activation code, EID or card information
is returned. Customer-owned order/usage pages also display the transaction number
and installation state. Customer ownership checks still apply to every request;
Operations access requires current, verified administrator permission server-side.

Installation labels use the documented `smdpStatus`: `RELEASED` means ready to
install; `DOWNLOAD` confirms download but not installation; `INSTALLATION`,
`ENABLED` and `DISABLED` report installed profiles; `DELETED` reports deletion.
Unknown or missing states stay “Not reported”. `esimStatus` is displayed separately
because “Ready”/`GOT_RESOURCE` alone does not prove whether a profile is installed.
These supplier readings support manual refund review, not automatic eligibility.

The existing usage service retrieves status on demand, caches it for 15 minutes,
and applies the same concurrency and supplier rate budget. There is no new cron,
background poll or per-minute refresh. Usage can lag by 2–3 hours; daily/unlimited
plans do not fabricate a remaining high-speed allowance. Support may inspect a
previously paid refunded/blocked order, while the customer access restrictions
remain unchanged. An old reading is identified with its last-check time.

Supplier reference: https://docs.esimaccess.com/ (Query All Allocated Profiles).
Refund policy version 2026-11-13.1 adds the uninstalled-and-unused 14-day full-refund
offer and the installed/activated change-of-mind restriction, preserving statutory
rights and technical-fault remedies. Previously accepted policy text is frozen
under its original version, including already-open checkouts.

Deploy the updated API **before** the frontend: it accepts the new policy version
as well as previous checkout versions, so existing checkout sessions can complete.

## Universal order search

`GET /v1/operations/orders/search?q=…&cursor=…` is independently protected by
current verified-administrator authorization. Search is exact (email addresses
are case-insensitive and stored normalized); order references accept either the
current historical format or another **already stored** reference format. Search
never generates or rewrites customer references. It is independent of the
financial date range and includes legacy standalone orders where matching data
was originally stored. Missing historical emails are not guessed.

Results show at most ten customer orders per page, with reference, purchase date,
email, payment state, plans, selling amount and original currency. Clicking a
result loads full details and the existing cached usage check; supplier calls do
not run while listing results. Each purchased eSIM stays separate within its
customer order. Copy buttons beside Alozuri and supplier references report success
or a useful clipboard-permission failure.

Queries use existing single-field/document-ID Firestore indexes. A scoped cursor
advances over at most 50 matching index records per request, with sibling checks
bounded by the existing ten-eSIM order limit. Shared supplier order numbers and
coincident transaction identifiers resolve to one result per customer order,
including across page boundaries. If a page contains only duplicate or excluded
records, the next-page control remains available. No whole-database/browser scan,
search service, additional schedule or index deployment is required.

Supplier identity is separate from the original supplier's **product name**.
Current `esimaccess`/`esim_access` records display “eSIM Access”. Future order records
can supply `supplierId` and `supplierDisplayName`; the same search/details interface
shows them and their existing `supplierOrderNo`/`esimTranNo`. Unknown suppliers do
not trigger eSIM Access usage requests. Adding another supplier's actual usage
adapter is separate from this provider-neutral search interface.

Order search results show **Provider + eSIM Tran No** for each allocated eSIM,
with a copy button, before opening full details. `esimTranNo` is the supplier-assigned
profile reference used in that provider's dashboard; it is not a Stripe/payment
identifier. Use the provider and its exact reference together when multiple
suppliers are connected. These references come from existing activation records,
with ownership checks and field projections excluding QR/activation credentials.
No supplier status/usage requests run while listing these references.

### Finding the original Stripe payment

Full protected order details show the saved **Stripe payment ID (PaymentIntent)**,
with a copy button and **Open payment in Stripe** link. This is the original
`paymentIntentId` stored on the parent purchase, shared by its allocated eSIMs.
The link opens the payment details in Stripe; the operator reviews and performs
any refund there. No refund is created by Alozuri's link or by viewing the order.
Missing/invalid historical payment IDs stay “Not recorded”, and secret-bearing
values are rejected rather than displayed. Only the existing verified-admin API
returns this field. No additional Stripe request or payment/fulfilment change is
needed. The existing refund webhook integration continues to track refund events.

## Trends

The protected **Trends** tab reuses Financial Overview's date range, GBP amounts,
paid-order cohort and existing `/v1/operations/financials` request. Its `trends`
response field is computed on the server from **all matched orders before table
pagination**, not from the browser's current 25 rows. There is no new endpoint,
database, background job, chart dependency or supplier/Stripe polling.

- **Revenue over time:** refund-adjusted GBP revenue, with successful-order counts.
- **Profit over time:** revenue less supplier costs and Stripe fees, before other
  operating expenses and taxes. Quoted costs remain explicitly provisional;
  unknown amounts are pending, never zero. Negative values are rendered below zero.
- **Top-selling plans:** top eight recorded plan-name/coverage groups ranked by
  gross purchased quantity. Refunded orders remain in these gross quantities;
  refunds reduce the money charts consistently with Financial Overview.

Buckets use Europe/London order dates and include empty periods. Up to 31 selected
days use daily buckets, up to 124 days weekly, and up to ten years monthly. Longer
ranges use bounded year groups. Partial periods contain only selected dates;
refunds restate the original order-date cohort, rather than a separate refund-date
cash-flow series. Existing historical costs and exchange rates remain unchanged.

The charts provide hover/click readouts, arrow-key selection, accessible data
tables, explicit provisional/pending labels and a mobile horizontal chart region
without page overflow. Empty, loading, error and missing-backend-version states
are explicit. Roll out the API before the manually deployed Firebase frontend.

## Promotions

Operations includes a Promotions section for administrator-managed percentage codes (maximum 30%), package profitability previews and server-paginated code management. Financial Overview includes promotion performance for its selected date range. See [Phase 1 promotions](promotions.md) for accounting, reservation lifecycle, indexes and the release/acceptance checklist.

## Manually recording supplier credits

Open an order in Operations (search or transaction details), then expand **Supplier cost / record refund** beneath the relevant eSIM. Enter the **total supplier refund received in USD** (up to four decimal places), the supplier refund reference/evidence, and select **Record supplier credit**. Enter the actual confirmed supplier credit, not the desired net cost. For additional partial credits, enter the new cumulative total. A correction to zero removes the credit's effect but retains its audit history.

Original supplier quotes and verified charges remain unchanged. Confirmed credits reduce net supplier cost and contribution/profit calculations, separately from Stripe/customer refunds. Where the original supplier debit is unverified, the net cost stays provisional. Credits cannot exceed the recorded cost. Actual GBP comparisons use existing historical conversion rules; original USD amounts remain available.

Only verified administrators can use the server endpoint `POST /v1/operations/orders/:id/supplier-credit`. The server supplies the actor UID and timestamp, validates the original paid order/cost, enforces revision checks, and stores an idempotent change record under `orders/{id}/supplierCreditHistory/{requestId}`. Direct client Firestore access remains denied. Financial results are marked pending until recalculation succeeds, and the dashboard refreshes its selected report after saving. No supplier cancellation, Stripe refund, API supplier-credit sync or scheduled job is performed by this action.

This feature needs backend and frontend deployment. No additional indexes, rules, secrets or backfill are required. Existing orders default to zero recorded supplier credit. Implementation and emulator/browser verification do not change live orders.
