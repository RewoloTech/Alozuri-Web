# Testing Alozuri

Install dependencies with `npm ci`. Use Node 22.13 or newer. Install the browser with `npx playwright install chromium` (Linux CI uses `--with-deps`). Playwright is the only browser test runner. Historical results below retain the names of runners used at the time; they are not current instructions.

## Unit and API tests

```sh
npm run test:unit
# Same suite through the default test command:
npm test
```

These tests use Node's existing test runner and `tsx` for the API. No extra unit-testing framework is required. They cover destination state/restoration, full-country matching, cart aggregation and limits, authoritative minor-unit pricing, supplier snapshots, unavailable cart items, input validation, payment transitions, provider adapters, fulfilment retries and refunds. Network providers are mocked. No Firebase credentials or paid supplier calls are needed.

## Playwright browser tests

```sh
# Starts an isolated Next.js server, runs headlessly, then stops that server.
npm run test:e2e
# Interactive test runner:
npm run test:e2e:ui
# Check browser tests, fixtures and the Auth integration test:
npm run typecheck:tests
```

Tests live in `tests/e2e`, with shared fixtures in `tests/fixtures` and TypeScript settings in `tests/tsconfig.json`. The test server uses port 3100 and a temporary source copy, preserving the developer's normal Next.js server and generated files. Stop an older test server on that port before starting a suite. The separate Stripe integration runner uses the same port and must run sequentially.

Provider requests are controlled with local server fixtures and route mocks. Coverage includes single/trip selection, full-country matching, cart persistence and quantities, mobile bounds, guest checkout, decline/retry, wallet callback contracts, optional accounts, usage, privacy, currencies and featured bundles. Search regressions also cover 50 GB/fair-use plans, delayed responses, local-only coverage, pagination, sort/facet counts, catalogue-revision refresh and country aliases. Currency regressions cover GBP/EUR quantities, currency locking and separate idempotency attempts for equal numeric totals in different currencies.

Checkout progress regressions cover immediate navigation during a slow cart price check, blocked payment before a verified total, failed verification/retry, and a stalled quote reaching its 10-second timeout without starting payment.

Order email regressions cover full immutable Terms/Refund text in HTML and plain text; recorded timestamps; absent customer names; USD/GBP/EUR amounts; escaping; no attachments; secure links outside the visible contract; concurrent workers and webhook replay; provider retries and the 23-hour reconciliation stop; pending/bounced delivery; and legacy duplicate prevention. Browser previews check the full contract, six installation steps and layout at 320/375/390/600/1024px. These browser renders do not establish actual Gmail/Outlook/Apple Mail delivery or client compatibility; a real mailbox check is still required.

Contract download tests cover PDF output in USD/GBP/EUR, recorded dates and full policy text, unpaid/unauthorised denial, private download headers, zero database/email side effects, and browser download/retry without page-load generation. Wallet UI tests also cover Apple-only and Google-only eligibility. PDF previews are rendered and inspected locally; they do not require a real purchase or customer credentials.

Stripe contract mocks test UI/callback handling, not real wallet eligibility or completed wallet transactions. The opt-in real Stripe SDK test runs separately with test keys. Ordinary browser tests do not need Firebase login, Resend credentials or supplier credit. Playwright creates isolated browser storage for each test and retains screenshots/traces for failures in `test-results/`, which is ignored by Git.

CI runs unit/API/static/build checks plus the Playwright suite on pushes and pull requests, installs Chromium with its OS dependencies, and uploads failure artifacts. No paid browser-testing service or recording key is required.

## Existing integration and payment checks

```sh
npm run test:e2e
# Java 21+ and Firebase CLI; Firestore stays in demo-alozuri:
npm run test:firestore
# Local matching Stripe test keys; real sandbox card calls, no eSIM issuance:
npm run test:stripe
```

The Firestore suite exercises transaction claims, replay protection, per-unit allocation, private retrieval and authenticated cart merge/version conflicts against an emulator. The Stripe browser test uses the real Payment Element/API, with locally simulated signed webhook transport. Production webhook delivery and actual Apple Pay/Google Pay completion need separate verification on the configured production endpoints and eligible devices. See [checkout deployment requirements](production-checkout.md).

## Static checks and build

```sh
npm run lint
npm run typecheck
npm run typecheck:tests
npm run build
```

Run Prettier checks on the changed supported source/config files. Do not include local secret files or generated screenshots in commits.

For Stripe's actual webhook transport against the deployed sandbox API:

```sh
STRIPE_SANDBOX_API_URL=https://YOUR_TEST_API npm run test:stripe:deployed
```

This runner refuses a backend unless `/v1/config` reports test checkout mode. It uses a verified catalogue product and real Stripe test cards, waits for the deployed signed webhook to mark the order paid, and does not simulate webhook delivery. Keep `STRIPE_TEST_PUBLISHABLE_KEY` in the ignored local API environment file when the local storefront uses a live publishable key. Test payments never create real supplier delivery jobs or delivery-email jobs.

## Search and pricing audit (2026-11-11)

The read-only current supplier audit and its scope/measurements are documented in [catalogue and filters](catalogue-and-filters.md). Search tests cover strict parameter validation before database access, cursor/filter/revision binding, stable global sorting, complete country intersection, daily/unlimited distinctions, public-field projection and forwarded-address rate-limit isolation. Gross-margin figures are computed from actual stored cost/retail values, not assumed Stripe fees.

For this release, 19 shared tests, 52 API tests, 11 Firestore tests, 11 Cypress cases and six Playwright fixture cases passed. The real Stripe case was skipped in the fixture suite and passed separately against the deployed sandbox with Stripe-delivered webhooks. Lint, app/test typechecks, changed-file formatting and the production build passed. Live browser search verification covered 375/390/768/1440 px. This does not verify a real charge, wallet authorisation, supplier purchase or delivery email.

## Pending tiered pricing implementation

[Automatic pricing and migration](automatic-pricing.md) records the new algorithm, UTC today/yesterday fallback, server-side currencies, private-field safeguards and deployment boundary. Current local verification: 95 unit/API tests, 20 Firestore tests, 13 Cypress cases, six Playwright fixture cases and real Stripe TEST decline/retry runs in USD/GBP/EUR passed. Actual wallet authorisation and live eSIM delivery remain unverified. The production database migration was previewed read-only and has not been applied.

## Legal, privacy, customer support and SEO (2026-11-11)

Tawk.to now uses an explicitly opened, sandboxed third-party frame after optional support consent. Vendor code cannot read the parent Alozuri account/checkout page. Necessary-only shopping remains available after rejection; Cookie settings in the footer supports withdrawal. Fonts and destination images are served locally. The earlier global lazy-loaded Tawk embed has been replaced. The corner Chat launcher opens a 380px desktop panel and full-screen mobile chat; Help remains in the footer.

The seven canonical legal pages, version archives, company footer, checkout acknowledgements, immutable order/contract snapshots, durable confirmation emails, confirmation-before-provisioning gate, public metadata/JSON-LD, robots and sitemap are documented in [LEGAL_COMPLIANCE.md](../LEGAL_COMPLIANCE.md). That document also lists legal, supplier and operational questions; this implementation is not a compliance certification.

Current observed verification:

- `npm test`: 100 shared/API tests passed.
- `npm run test:firestore` (Java 21/local emulator): 21 passed, including missing/negative legal consent, private contract retrieval, failed confirmation/retry and provisioning gates.
- `npm run test:cypress`: 13 passed.
- `npm run test:e2e`: 10 passed; the real Stripe case is deliberately skipped in this fixture command and runs separately. The six shopping cases also passed after adding assertions for four initially unchecked checkout choices and the exact posted legal version.
- `npm run test:stripe` (local Firestore, real Stripe TEST SDK/API, USD): passed decline, same-intent retry, completed sandbox payment and private paid-order confirmation. The runner simulates signed webhook transport locally; it does not verify Stripe’s external production webhook delivery. Masked Stripe fields are entered with key events and blurred to commit their state.
- Production HTTP/browser checks passed for all seven documents, canonical/indexing metadata, robots, sitemap, private/no-store headers, filter noindex headers and optional-provider request absence.
- Mobile/desktop cookie, contract and checkout views were checked at 375/390/768/1440px; screenshots were reviewed locally. Keyboard dismissal/focus restoration and initially unchecked consent are tested.

Lint, app/test TypeScript, changed-file formatting and the production build passed; no real charge, wallet authorisation, supplier purchase or actual delivery-email receipt is implied by fixture tests. Search-console ownership, Cloudflare account rules, live mailbox/bounce handling and processor/legal review remain external checks. No deployment or live database migration is part of this change.

## Checkbox, hover and security follow-up (2026-11-11)

The latest shared/API count is 102 passing tests; Firestore remains 21 passing tests, with direct authenticated and anonymous access checks expanded to customer collections and catalogue listing. The full browser fixture suite passed 11 cases, including the new desktop/mobile hover and checkbox regression. Sign-in redirect validation now covers literal/encoded controls and external URL variants. A read-only inspection confirmed deployed Firestore deny-all client rules; `npm audit` reported zero known advisories. See [security review](security-review.md) for the scope and limitations.

## Responsive chat follow-up

The Chat launcher opens an isolated provider frame only after an explicit action and optional support permission. Desktop uses a compact corner panel; mobile uses a full-screen modal with safe-area spacing and a close control. Tests cover no provider calls before opening, consent withdrawal removing the frame, sandbox/referrer restrictions, 375/390px full-screen dimensions, desktop sizing and focus restoration. Provider rendering and operator availability are separate from layout fixture checks; no customer message is sent by the tests.

Responsive chat verification: all six privacy/chat browser cases passed, along with 102 shared/API unit tests, lint, TypeScript and the production build. Desktop and mobile panel screenshots were reviewed. The real provider page returned HTTP 200 to the HTTP client, but Chromium blocked its embed script for a missing CORS response header; the same failure occurred on Tawk's standalone chat page outside Alozuri. The live iframe remained blank, so provider rendering and an operator conversation are **not verified**. No message was sent, no browser security restriction was bypassed, and no deployment was performed. Email fallback remains visible in the panel.

## Simplified checkout and network fallback

Version `2026-11-11.2` uses one initially unchecked device-compatibility checkbox and a concise policy-link notice. The notice is also present before card/wallet confirmation. Removed early-supply/waiver controls are not recorded as consent: new order snapshots explicitly retain false flags. Strict version-one compatibility supports already-open checkout forms and their archived documents.

Tests now cover compatibility-row alignment at 375/390/768/1440px; blocked cross-origin catalogue/quote calls recovered through the same-origin store route; origin rejection, operation allowlisting and request-size limits; and new-versus-historical legal snapshots. Run the full unit/Firestore/Playwright checks plus the real local Stripe TEST runner before release. That runner does not purchase an eSIM, send delivery email or charge real money. Updated backend and frontend must both be released for the new checkout notice; no deployment is implied by these local checks.

Observed follow-up results: 105 shared/API unit tests, 21 Firestore tests and 13 Cypress cases passed. Six shopping browser cases passed with the single compatibility checkbox; all eight privacy/network browser cases passed, and the two transport recovery/error-retry cases passed again after the final origin check. Real Stripe TEST decline, same-intent retry and successful USD payment passed with the simplified checkout. Lint, application/test TypeScript and the production build passed. Mobile checkout screenshots were reviewed; no live payment, supplier purchase, pricing migration or deployment was performed.

## Buying-flow simplification

Single-destination mode now always sends `coverage=local`; the removed regional/global checkbox cannot be restored by an old `coverage=all` URL. Multi-country mode still requests complete multi-country matches. Allowance, sorting, pagination and back/forward state retain the same search paths.

Buy now goes directly to guest checkout; Add to cart keeps browsing available. Device compatibility stays initially unchecked, with one short policy notice linking Terms, Refunds, Privacy and Compatibility. The payment button shows the exact server-verified order total, including currency, beside the payment choices. Additional supplier notes use a Plan conditions disclosure while coverage, activation, allowance, fair use and final pricing remain visible. Confirmation-page legal version/audit details and the contract download remain available under Order documents. Optional cookies/chat still use the separate preference system; no marketing or cancellation waiver is inferred.

The flow regression checks direct Buy now, collapsed/expandable conditions, one policy notice at payment, no account requirement, amount-labelled payment, and desktop/mobile widths. Cypress checks removed controls and strict local coverage even from an old wider-coverage URL.

Buying-flow results: 105 unit/API tests, 13 Cypress cases and the 15-case browser fixture run passed (real Stripe intentionally skipped there). The eight shopping cases passed again after adding the old-URL/Back regression. The separate real Stripe TEST run passed decline, same-intent retry, amount-labelled payment and access to the confirmation contract download. Desktop/mobile screenshots at 375/390/768/1440px were reviewed. Lint, app/test TypeScript and production build passed. No deployment, real charge, supplier purchase or live pricing change was performed.

## Regional/global bundle visibility

The current fix normalises multi-country API requests to all-coverage matching, including a stale local-only flag. A restrictive allowance is now distinguished from absent coverage, with Show all data plans offered only when complete-coverage plans exist. No partial-coverage substitute is introduced.

Verification: 106 shared/API unit tests, nine shopping browser tests and 13 Cypress cases passed; lint, TypeScript and production build passed. A local production build using the live catalogue was checked at 390px: UK/USA with fixed 50 GB had no match, then Show all data plans returned 17 plans with Global bundles and no horizontal overflow. Direct live checks found 63 France/Germany matches when all coverage was requested. No deployment or database modification was performed.

## Stable quantity updates and trip-mode persistence

Cart and checkout keep their summary mounted while an updated quote is requested. Quantity changes immediately preview the current quantity using cached prices in the correct currency; this preview never authorises payment. A reserved status line avoids layout movement, the checkout control remains in place, and payment is disabled until the latest cart signature/currency is verified. Rapid updates are debounced for 180 ms and obsolete requests are cancelled. Failed quote checks retain the cart and keep checkout disabled. Cached USD amounts are never relabelled as GBP/EUR.

Removing trip stops no longer selects the single-country filter automatically. One/zero-country draft trips retain their selected tab across refresh and wait for a second country or an explicit single-destination choice. Coverage intersection continues to include both European and global products with full coverage.

Unit tests cover the retained mode, restoration, exact minor-unit previews, currency safety and matching European/global bundles. Browser regressions measure a persistent summary node and unchanged height during delayed rapid quantity updates, verify payment remains disabled until confirmation, and confirm explicit tab switching after removing all stops.

Observed results for this follow-up: 108 unit/API tests, 11 shopping browser cases and all 13 Cypress cases passed. The two new mode/quantity browser regressions passed again after the stale-response guard, including a forced click that cannot leave the cart while prices are pending. The real Stripe TEST decline/retry/payment and order-document checks passed. Lint, application/test TypeScript and the production build passed; mobile/desktop cart screenshots were reviewed. No real charge, supplier purchase, live data change or deployment was performed.

# Signed-in account navigation — 11 November 2026

The header's account disclosure provides My eSIMs, Account settings and Log out on mobile and desktop. Unverified users retain Verify email and logout access. Logout uses the existing Firebase Auth provider and returns to the homepage on success; failures remain retryable. Account settings targets the actual profile section on `/dashboard`.

`tests/e2e/account-menu.spec.ts` covers keyboard focus/Escape, outside dismissal, 375/390/768/1440px bounds, successful/failed logout callbacks and unverified navigation. Its fixture is copied only into the temporary app created by `scripts/run-e2e-server.mjs`; no fixture route or test authentication bypass is added to the deployed app. These component checks use a controlled logout callback, not a real customer session. The production build was checked to exclude the fixture route. Usage tracking is covered separately in [Customer eSIM usage](esim-usage.md), including its live-verification limitation.

`tests/e2e/seasonal-destinations.spec.ts` checks the [seasonal destination grid](seasonal-destinations.md): four cards, Japan restored, no carousel controls, winter/spring changes, stable reload order, image loading, mobile bounds and keyboard access. Shared selection tests cover London month boundaries and Japan's presence in every season.

The [single-email checkout and optional account flow](checkout-account.md) documents Firebase Auth emulator validation, the checkout account component fixture, API ownership regressions and actual Stripe sandbox results. Run `npm run test:auth` for real Firebase SDK signup/verification/login against the local emulator; Google UI callback tests do not substitute for production OAuth verification.

The data allowance picker in `tests/e2e/shopping.spec.ts` verifies that the label, value, arrow and padding all receive native select clicks and open the picker at 375/390/768/1440px. It checks keyboard opening, value changes and overflow; the existing empty-filter regression verifies search integration. Native popup dismissal uses a second trigger click because headless macOS does not consistently forward synthetic Escape keys to its platform popup. For this fix, 12 existing shopping cases passed, followed by both the corrected picker test and empty-filter test. Lint, TypeScript, production build, formatting and diff checks passed; mobile/desktop field screenshots were reviewed. No deployment was performed.

## Signup/cart total regression — 12 November 2026

Run `npm run test:jest` for the mounted Redux/React cart and checkout regressions. Before the fixes, delayed responses from an earlier sign-in restored quantity two over a newer quantity one; signout left synchronisation locked; verification on the same Firebase User object did not trigger synchronisation. A separate checkout test reproduced a $24 summary after preparing a $12 payment. Payment-stage summaries now use the prepared server quote. Failed account synchronisation blocks payment creation, including forced form submission.

Cart requests are bound to the expected account and a sign-in generation. A frozen guest merge body and merge ID survive interrupted requests; subsequent local edits are applied as quantity differences, rather than merging the entire cart again. Saves are serialised and retain newer edits while an earlier write is pending. Verification refreshes a stale unverified Firebase token before authenticated requests. Choosing Use saved account cart explicitly discards the pending guest intent before reload, preventing another merge of that saved snapshot. Pricing remains authoritative on the server.

Run `npm run test:cart:browser` for four Playwright scenarios using real Firebase Auth against the local Auth emulator: signup, email verification, reload and login at 390/1440px, plus a delayed-response signout/login race and recovery using the saved account cart after an interrupted merge. They assert that the chosen quantities survive synchronisation and that the final checkout request contains one item/$12. API cart/quote responses are controlled fixtures with version checks; payment creation is deliberately stopped. The emulator connection exists only in the disposable test application, never deployed source.

`npm run test:firestore` additionally verifies four concurrent retries of one guest merge, the exact resulting quote, and the stored order/Stripe mock amount for one item. These checks do not charge a real card or purchase supplier inventory. The standard Playwright suite skips the emulator-only scenarios; run the separate command above explicitly.

Jest dependencies are development-only. The dependency audit on 12 November reported five low-severity development dependency findings through Jest's `deepmerge` dependency, with no compatible upstream patch available; `npm audit --omit=dev` reported zero findings. Do not blindly apply the suggested major Jest downgrade.

Observed validation: 11 Jest tests, four real-Auth Playwright cases, 152 existing shared/API unit tests and 41 Firestore emulator tests passed. The general browser run passed 76 cases, skipped four optional/emulator cases, and found one existing retry-test timing assertion that ran before its debounced request. After waiting for the request and confirmed total explicitly, all ten privacy/network cases passed on rerun. Lint, application/test TypeScript, formatting, diff checks and the final production build passed. No deployment, real charge or supplier purchase was performed.

## Payment-triggered order queue — 12 November 2026

The [order-processing runbook](order-processing.md) describes the opt-in queue, resources/costs for approval, migration, monitoring and rollback. No production activation is implied by tests. Normal local checks use a mock queue transport and the Firestore emulator; they do not create Cloud Tasks resources or send provider email.

`apps/api/test/order-task-queue.test.ts` covers deterministic task names, scheduled timestamps, strict identity/target configuration, ALREADY_EXISTS versus other queue failures, service-account identity verification, the private worker boundary and scheduler retirement. Firestore regressions cover atomic payment/outbox persistence; webhook replay after failed submission; targeted, concurrent processing; email retry/delivery gating; supplier allocation without repeat purchases; failed successor-task submission repaired by the old task; one-time migration and generation redrive; legacy checkout; ten-eSIM bounded batches; and missing fulfilment work requiring support. The migration CLI is included in test TypeScript checks and defaults to read-only inventory.

Observed results: 159 shared/API unit tests, 11 Jest tests, 52 Firestore emulator tests and 77 standard Playwright cases passed. The browser suite skipped four Auth-emulator-only cases and the separately invoked Stripe test. The real Stripe sandbox browser test then passed decline, retry on the same intent and successful test payment. Its simulated signed webhook now includes the required event timestamp. Lint, application/test TypeScript, formatting, diff checks and the production builds passed. The final HTTP integration follows a signed payment webhook into targeted processing, scheduled supplier waiting, task replay and completed private order access. Google Cloud Tasks transport, IAM and identity minting use mocks locally and remain unverified in production until approved activation. No new cloud resources, live payment, supplier purchase or production deployment was performed.

## User profiles and account usage navigation — 12 November 2026

See [User profiles and ownership](user-profiles.md) for the schema, ownership rules, API boundaries and read-only production audit. New profile/account-switch Jest regressions and the real-Auth browser journey cover the shared account navigation, structured name edits, private usage, orders and logout. Firestore tests cover profile integrity, privilege rejection, atomic verified guest claims and permanent UID ownership. Live data was inspected with projected fields and aggregate-only reporting; no production records or IAM bindings were modified.

Observed results: 166 shared/API unit tests, 14 Jest tests, 58 Firestore emulator tests, 77 standard Playwright cases and five real-Auth emulator browser cases passed. The standard run skipped six optional/emulator cases. A separate 390px profile-edit case also passed. Navigation bounds were checked at 320/390/768/1440px and screenshots were reviewed. Lint, application/test TypeScript, formatting, diff checks and production builds passed. Real Stripe checkout and fresh supplier usage were not run for this profile change; browser API responses used controlled fixtures. No production deployment or backfill was performed.

## Browser contract download and direct usage — 12 November 2026

The authorised order page generates a PDF locally on demand with the existing PDFKit library, dynamically imported on click. It does not request `/contract.pdf`, upload a document or store one. The browser and optional API renderer share the same layout. Older paid order responses without a PDF capability flag still work. Missing payment timestamps are labelled unavailable; recorded order/acceptance dates, amounts and saved policy text are retained. Unit checks reject unpaid/incomplete/inconsistent records. Playwright downloads real PDFs from current and older response shapes while the PDF endpoint is unavailable, exercises font-load retry, and checks no PDF generation request occurs on initial page load.

Data Usage renders a card per live eSIM and requests each ready unit's own authorised usage endpoint. Orders and installation links are secondary actions with 16px separation; test eSIMs are excluded and pending/refunded units have explicit messages. Real-Auth emulator browser coverage checks two distinct readings in one purchase without opening an order, no requests for pending/test/refunded units, reload, and bounds/action spacing at 375/390/768/1440px.

Read-only live investigation confirmed the currently deployed API has no contract PDF route and the older website proxy rejects that route. The production usage route exists. Two read-only supplier queries using the stored references of the two ready live eSIMs both returned valid daily-plan usage counters; no database writes, payments, inventory purchases or activation credentials were involved. This proves supplier readings are available, not that the revised UI is deployed.

Observed checks for this change: 168 shared/API unit tests, 14 Jest tests, 58 Firestore emulator tests, 37 targeted commerce/usage/menu browser tests and six real-Auth browser cases passed. Lint, application/test TypeScript, production builds, formatting and diff checks passed. Current and legacy browser-generated PDFs were opened/rendered and their full saved Terms and Refund Policy text matched the fixture snapshots after whitespace normalization; both were about 38KB/six pages. Mobile/desktop usage cards and action gaps were visually reviewed. No deployment was performed.
