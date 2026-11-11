# Testing Alozuri

Install dependencies with `npm ci`. Use Node 22.13 or newer. Cypress downloads its browser binary during installation; if installation scripts were disabled, run `npx cypress install` first.

## Unit and API tests

```sh
npm run test:unit
# Same suite through the default test command:
npm test
```

These tests use Node's existing test runner and `tsx` for the API. No extra unit-testing framework is required. They cover destination state/restoration, full-country matching, cart aggregation and limits, authoritative minor-unit pricing, supplier snapshots, unavailable cart items, input validation, payment transitions, provider adapters, fulfilment retries and refunds. Network providers are mocked. No Firebase credentials or paid supplier calls are needed.

## Cypress browser tests

```sh
# Starts an isolated Next.js server, runs headlessly, then stops that server.
npm run test:cypress
# Starts the same isolated server and opens the interactive Cypress runner.
npm run test:cypress:open
```

Cypress tests live in `tests/cypress/e2e`. Their TypeScript settings are separate from the app and Playwright to avoid conflicting global test types:

```sh
npm run typecheck:tests
```

The test server uses port 3100 and a temporary source copy, preserving the developer's normal Next.js server and generated files. Stop any previous test server on that port before starting another browser suite. Do not run Cypress and Playwright simultaneously because they use the same isolated test port. For an already running **test-configured** server, use `npm run cypress:run`.

API requests are intercepted at `http://127.0.0.1:8189`; unexpected commerce endpoints fail the test. Tests cover explicit single/trip selection, full coverage, refresh and browser history, persistent cart quantities/totals/removal, empty cart, 375/390/768px layouts, guest email validation, declined-payment retry, Apple Pay/Google Pay callback contracts and unsupported-wallet card fallback. Search regression cases also cover 50 GB/unlimited results, stale-response cancellation, local-only coverage, pagination without duplicate or omitted products, catalogue-revision refresh, filter counts and country aliases. Playwright additionally checks native Enter activation and focus restoration in the country picker. Test isolation clears browser storage between cases; refresh tests check persistence within a case. Browser exceptions fail tests.

Cypress uses a Stripe contract stub. These tests verify our UI and callback handling, **not** Stripe authentication, actual wallet availability or completed wallet transactions. They require no Stripe keys, Firebase login, Resend account or supplier balance. Do not replace fixtures with live credentials. The launcher removes an inherited `ELECTRON_RUN_AS_NODE` flag that can prevent Cypress from starting inside editors/agents.

Failure screenshots are saved in `test-results/cypress/screenshots` and ignored by Git. CI runs unit/API tests and Cypress on pushes and pull requests, and uploads Cypress failure artifacts. No Cypress Cloud recording key is required.

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

Tests now cover compatibility-row alignment at 375/390/768/1440px; blocked cross-origin catalogue/quote calls recovered through the same-origin store route; origin rejection, operation allowlisting and request-size limits; and new-versus-historical legal snapshots. Run the full unit/Firestore/Cypress/Playwright checks plus the real local Stripe TEST runner before release. That runner does not purchase an eSIM, send delivery email or charge real money. Updated backend and frontend must both be released for the new checkout notice; no deployment is implied by these local checks.

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
