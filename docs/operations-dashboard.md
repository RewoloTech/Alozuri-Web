# Operations dashboard

The combined dashboard is `/operations`. `/admin` redirects there for old links.
Its Financial Overview and Pricing History sections share protected navigation.
Financial Overview contains six metrics, a date-only report and paginated
transactions; an expandable service-configuration overview remains available. There is no new service, database
or scheduled financial job.

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
- Supplier costs become booked only after a supplier order reference is saved.
  An explicit supplier rejection can be zero cost; unknown outcomes remain
  pending. A refund does not erase an already purchased supplier profile's cost.
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
