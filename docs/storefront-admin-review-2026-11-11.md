# Storefront and admin review — 11 November 2026

The admin area is incomplete. There are also confirmed customer-history inconsistencies and a local/live release mismatch. Passing checkout tests do not establish a complete operational admin experience.

## Findings, in priority order

### 1. High: customer order history has two sources of truth

`apps/web/src/components/dashboard.tsx:29` and `:40` fetch `/v1/orders`. That endpoint reads allocation documents from `orders` by exact customer UID (`apps/api/src/lib/repository.ts:82`). The newer My eSIMs page fetches `/v2/orders` (`apps/web/src/components/purchase-status.tsx:249`), whose history reads parent `purchases` by UID and verified delivery email (`apps/api/src/lib/commerce.ts:634`).

Consequences: a guest purchase later accessed through a verified account can appear in My eSIMs but be absent from the dashboard reached through Account settings. Pending purchases can be absent before allocation documents exist. The dashboard's Orders count counts individual allocation records, so one multi-eSIM purchase can be counted as several orders. Its order links also lead into the legacy order-details flow.

Recommendation: use one purchase history contract for customer counts, lists and navigation. Keep purchase counts separate from eSIM-unit counts; preserve access to historical orders through an explicit compatibility path.

### 2. High operational gap: admin is a status overview, not an order-management system

`apps/web/src/components/admin.tsx` fetches only `/v1/admin/status`, displays four status fields, and instructs operators to monitor the API and Stripe dashboard. The only admin-specific API route is that status endpoint (`apps/api/src/app.ts:382`).

Missing from Alozuri's admin UI: order search/list/detail, customer lookup, payment/fulfilment/supplier references, a paid-but-unfulfilled queue, delivery attempts and sanitized errors, reconciliation controls, refund visibility, delivery-email resend, supplier balance/credit visibility, catalogue freshness/pricing-review views and an operator audit trail.

Automatic recovery/refund logic does exist in the fulfilment worker. This finding concerns the absence of operator visibility and controls in the admin application, not an assertion that no recovery exists anywhere. Adding retry controls must preserve reconciliation and atomic claims; it must never blindly repeat a chargeable supplier purchase.

Recommendation: build the read-only orders/exception queue and private order detail first. Add narrowly authorized, audited recovery actions afterward.

### 3. High: admin status can report a supplier connection without one

`apps/api/src/app.ts:387–390` sets `supplierConnected: !demo` rather than checking supplier configuration or connectivity. The page renders that as “Connected.” Its payment-enabled flag uses the legacy payment service rather than actual cart-checkout availability, and the UI shows the generic catalogue mode instead of the returned Stripe payment mode.

Reproduced in an isolated API instance with `demo:false`, `payments:null`, `fulfillment:null` and `commerce:null`: an authenticated admin receives HTTP 200 with `supplierConnected:true`, while payments are disabled and catalogue count is zero. No live provider was contacted for this reproduction.

Recommendation: distinguish configured, reachable, checked-at and unknown/error states. Show the authoritative checkout mode and paused state. Do not label a supplier “Connected” based only on demo mode.

### 4. High release gap: localhost points at live services that lack the new usage route

The localhost frontend uses the deployed production API. A read-only check returned `cartCheckoutMode:live` from `/v1/config`. A GET using synthetic nonexistent purchase/unit IDs returned a framework “Route … not found” for `/v2/orders/:id/units/:unit/usage`, confirming that the new usage endpoint is not deployed there yet.

The local usage implementation and tests are not evidence that usage works against the current deployed API. The single-email checkout compatibility fix already accommodates the old API, but other unreleased contracts still need a coordinated release. Localhost is not automatically a Stripe test environment.

Recommendation: use an isolated test stack for development, keep the release boundary explicit, and release compatible API/frontend versions together through the manual rollout process. Do not silently switch the owner's payment environment or deploy during a review.

### 5. Medium: admin access is hard to discover and errors lack a recovery path

The account menu (`apps/web/src/components/account-menu.tsx`) offers My eSIMs, Account settings and logout, but no administrator entry. No other storefront navigation links to `/admin`. The backend correctly requires a verified administrator claim; a normal Google/email account does not acquire that claim by signing in.

The admin page combines permission failures and service outages into one generic error and offers no retry action. This makes a missing role, expired session and API outage look alike.

Recommendation: add an admin entry only for appropriately authorized accounts, while keeping server authorization authoritative. Show distinct access-denied/session/service states with a safe retry. Do not grant roles or relax access controls to make the page appear.

### 6. Medium UX: customer-facing plan names and copy need another pass

The current Chrome search results visibly expose supplier title fragments such as `(USIP)` and `FUP1Mbps`. Similar variants look almost identical to customers. Long allowance text pushes prices/actions to different vertical positions in the same row. These are presentation findings; the reviewed reduced-speed plans do display their high-speed allowance and fair-use speed.

`apps/web/src/components/planner.tsx:642` renders raw `plan.name`. The homepage installation step (`apps/web/src/components/home.tsx:163`) tells customers to find their eSIM in their account, although guest checkout does not require one.

Recommendation: produce clear customer-facing titles while preserving exact supplier identifiers internally, align card action areas, and explain both email-link and account installation access. Do not invent network, IP-routing or fair-use claims when simplifying supplier names.

## Checks and limits

- Reviewed the current Chrome storefront/search screen without changing the user's page or placing an order.
- Traced admin UI, account navigation, both history endpoints, payment preparation and service-status logic.
- Isolated admin-status reproduction: anonymous 401, ordinary customer 403, admin 200. The supplier-status false positive above was reproduced.
- Read-only production checks: `/v1/config` 200/live, anonymous `/v1/admin/status` 401, synthetic usage URL 404/missing route.
- `node --import tsx --test apps/api/test/app.test.ts apps/api/test/commerce.test.ts`: 17 passed. These tests do not cover a complete admin workflow because that workflow is absent.
- No production administrator session was used. No role grants, refunds, supplier purchases, customer-record edits, payment submissions or deployments were performed.

Recommended implementation order: unify customer history; correct operational status; add role-aware admin navigation and read-only order/exception views; add protected recovery actions; then address the remaining presentation issues. Actual live wallet authorisation, supplier allocation, installation and inbox delivery remain outside this review's verification.
