# Checkout contact and optional accounts

Checkout collects one delivery email. The repeat-email input is removed. The Payment Element hides its email field and receives the saved checkout email explicitly at payment confirmation, following [Stripe's billing-details guidance](https://docs.stripe.com/payments/payment-element/control-billing-details-collection). Other required payment fields remain controlled by Stripe. The payment session holds its original delivery email so later token/account refreshes cannot change it silently.

The guest option reads “Or check out as a guest” and “We’ll email your eSIM details. No account needed.” Account creation and login actions have a 32px gap with padded touch targets. The four focused account browser cases passed after this copy/spacing update, including spacing checks at 375/390/768/1440px; scoped lint, test TypeScript and formatting/diff checks also passed.

Customers can continue as guests, use Google, create an email/password account or log in without leaving checkout. Email/password signup reuses the delivery email and asks only for a password (at least eight characters); names are not required here. Google uses the existing Firebase popup integration. Passwords go through the Firebase SDK and are not sent to Alozuri's commerce API or saved in browser storage. Account creation has its own explicit action and terms notice; opening the optional password panel does not make signup a requirement for payment. Pending authentication and cart synchronization disable payment preparation.

Signed-in users' email is prefilled. New password accounts remain unverified until Firebase's verification link is used. Verification is requested after signup, but payment can continue via the existing guest flow without account privileges. Verification links preserve direct Buy now checkout queries. The server still rejects unverified bearer tokens for private account/order access. After verification, the existing verified-email ownership checks make the customer's guest purchases visible in My eSIMs. Google-created verified accounts use the authenticated checkout path and existing cart merge.

The updated API accepts a single validated `email`. The old `emailConfirmation` property is optional there; when supplied it must still be a valid matching email. The frontend sends the same single input as both properties so it also works with the currently deployed API, which still requires the legacy property. Customers only enter their email once. Compatibility consent, server pricing, payment idempotency, webhook authorization and supplier fulfilment rules are unchanged. This work does not deploy either service.

The localhost compatibility fix was checked against the schema in deployed commit `56d2458`. Four focused Playwright payment regressions passed with a strict legacy-contract fixture that rejects missing/mismatched `emailConfirmation`; scoped lint, application/test TypeScript, formatting and diff checks passed. This verifies the request format without starting a live payment or deploying the optional-field API update.

## Verification

`npm run test:auth` runs the production email authentication helper against the local Firebase Auth emulator. It checks real SDK signup without names, verification message generation, unverified token claims, incorrect-password rejection, login and verified claims only after applying the verification code. It uses a demo project and cannot email real customers.

`tests/e2e/checkout-account.spec.ts` covers the rendered optional-account controls with injected callbacks: email reuse, Google success, pending states, popup/login failures, guest fallback, optional incomplete signup and responsive layouts. Its fixture exists only in the temporary test application; there is no production authentication bypass. These callback tests do not prove an actual Google OAuth exchange.

The commerce Firestore integration test exercises the single-email HTTP boundary, rejects malformed/mismatched emails and unverified tokens, preserves legacy requests, and checks guest/verified ownership. Existing shopping, currency, privacy, Cypress and Stripe sandbox journeys use the single email field. Stripe browser mocks additionally require hidden email collection and the correct email in `confirmPayment`.

A read-only Firebase configuration check on 11 November 2026 confirmed Google and email/password providers are enabled. A real production Google popup sign-in still needs a customer session on the deployed domain. No real payment, supplier purchase or production account was created for this change.

Actual validation on 11 November 2026:

- `npm run lint`, `npm run typecheck`, `npm run typecheck:tests`, Prettier checks and `git diff --check`: passed.
- `npm test`: 134 shared/API unit tests passed.
- `npm run test:firestore` with the local Java 21 runtime: 34 integration tests passed.
- `npm run test:auth`: Firebase SDK signup/verification/login integration passed against the local Auth emulator.
- `npm run test:e2e`: 56 browser tests passed; the opt-in Stripe SDK case was skipped in that run. The four account component cases passed again after the final layout/return-link changes.
- `npm run test:cypress`: all 13 cases passed.
- `npm run test:stripe` with the local Java 21 runtime: the real Stripe TEST Payment Element declined/retried/paid on the same order successfully. No supplier was called.
- `npm run build`: web and API production builds passed; the production route list excludes both temporary account fixtures.

Screenshots were reviewed on mobile and desktop; bounds checks cover 375, 390, 768 and 1440px. The Google popup success/failure UI uses controlled callbacks in browser tests; a live Google OAuth exchange has not been performed.
