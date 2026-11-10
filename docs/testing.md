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

API requests are intercepted at `http://127.0.0.1:8189`; unexpected commerce endpoints fail the test. Tests cover explicit single/trip selection, full coverage, refresh and browser history, persistent cart quantities/totals/removal, empty cart, 375/390/768px layouts, guest email validation, declined-payment retry, Apple Pay/Google Pay callback contracts and unsupported-wallet card fallback. Test isolation clears browser storage between cases; refresh tests check persistence within a case. Browser exceptions fail tests.

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
