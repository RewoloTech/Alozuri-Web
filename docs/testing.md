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

Tawk.to now uses an explicitly opened hosted chat link after optional support consent. No vendor script runs on Alozuri account/checkout pages. Necessary-only shopping remains available after rejection; Cookie settings in the footer supports withdrawal. Fonts and destination images are served locally. The earlier global lazy-loaded Tawk embed has been replaced.

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
