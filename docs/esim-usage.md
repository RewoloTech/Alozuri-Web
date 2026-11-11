# Customer eSIM usage

My eSIMs and the private order page show usage for fulfilled live eSIMs. Each allocation already stores its supplier order reference and package code; its protected activation record stores the unique `esimTranNo`. The server uses these saved references to call the supplier's read-only `esim/query` endpoint. No supplier credentials or reference parameters are accepted from the browser.

`GET /v2/orders/:id/units/:unit/usage` returns `{ usage: { state, snapshot, stale } }`. It requires the existing verified customer session or secret guest order-access token. The allocation must belong to that purchase. Payment, activation ownership and reference linkage are checked before cache access and again after the supplier responds. Refunded, cancelled and test allocations cannot initiate a lookup.

The private `esimUsage/{unitId}` cache contains sanitized counters, status, expiry and a server check timestamp. Fresh readings are reused for 15 minutes. If a lookup fails, a previous reading can be shown for up to 24 hours with a stale label. Failed or empty responses have a 60-second cooldown; concurrent lookups use a 60-second lease. A shared Firestore budget limits usage queries to four per second, leaving supplier capacity for other operations. The route additionally limits requests to 30 per minute per IP. Existing default-deny Firestore rules keep the cache and budget inaccessible to browser clients.

Reads happen on demand when the panel opens or Refresh usage is pressed. This feature does not schedule background polling or process supplier DATA_USAGE webhook inbox records. Refresh can reuse the cache. A deferred lookup shows a pending message and can be retried later.

Fixed plans display reported used/total bytes and a calculated remaining allowance. Missing counters remain unknown, rather than zero. Daily and unlimited plans display reported usage without inventing a remaining high-speed allowance. Expiry and status come from the supplier. “Last checked” records our lookup time; supplier usage itself can lag by 2–3 hours. See the [supplier API documentation](https://docs.esimaccess.com/) for query fields and reporting limitations.

## Validation and deployment

Local validation: lint, application and test TypeScript checks, production build, 132 unit tests, 33 Firestore integration tests and 49 Playwright browser tests passed. One optional real Stripe browser test was skipped. Tests cover reference matching, absent counters, plan types, ownership denial, concurrent calls, budget limits, stale fallback, refunds during lookup and mobile layouts. Usage panels were visually inspected at mobile and desktop widths; browser bounds checks cover 375, 390, 768 and 1440px.

Deploy the API before the web application, using the project's manual rollout process. No new supplier credentials are required. These changes have not been deployed. A read-only production check found no ready live eSIM allocation, so actual live supplier counters remain unverified. The owner will place the real test order; no paid supplier purchase was made for this work. After fulfilment, confirm that its usage appears only for the correct customer and matches the supplier profile.
