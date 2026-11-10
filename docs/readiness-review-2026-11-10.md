# VoyaSpan readiness review — 10 November 2026

## Decision

**Ready for a storefront/account preview; not ready to accept customer payments or promise eSIM delivery.** No charge, supplier purchase or production test customer was created during this review.

## Payment account and why checkout is unavailable

A read-only Stripe account lookup using the saved test key returned **REWOLO TECHNOLOGIES LTD**, account `acct_1T9SXaRRI0Wf4wWK`, country GB. Stripe reports charges and payouts enabled on that account, but the saved credentials are test credentials. This does not establish that the website can collect payments or that a live payout flow has been tested.

The web review page deliberately renders a disabled “Payments not available yet” button. The API's authenticated, verified-email checkout route still returns 503. No Stripe SDK/Checkout Session integration, Stripe webhook handler, webhook signing secret or payment fulfilment workflow exists. The Cloud Run API does not have the local Stripe secret attached. The existing eSIM Access callback is a different service integration and does not verify Stripe payments.

## Email verification policy

Allow a customer to sign up, sign in, browse and use their limited account before verification. They need access to resend verification and check status. Require a verified email on the backend before creating a checkout or initiating a supplier order. Existing order reads remain protected by verified Firebase identity and UID ownership; they do not rely on a browser flag.

The backend already checks the revocation-checked Firebase ID token's verified-email claim and returns 403 for an unverified checkout attempt. Tests cover this separately from signed-out 401 and disabled-payment 503. The dashboard can resend verification, reload the user and force-refresh the token.

This review fixed:

- Missing Firebase Authentication authorized domains for the current App Hosting URL and both static Hosting domains. Existing domains were preserved.
- Firebase's server password policy: minimum increased from six to eight characters to match signup. Existing accounts are not forced to upgrade their password on sign-in.
- React auth state now republishes a fresh session when Firebase refreshes the same mutable User object, so verification updates reach all consumers.
- A failed name update no longer prevents an attempt to send the verification email after successful signup.
- The review page now explains sign-in/registration and unverified-email requirements while keeping unavailable payments disabled.
- App Hosting configuration explicitly sets the API and site URLs. Preview pages are marked noindex/nofollow.

## Launch blockers

| Area | Verified state | Remaining work |
|---|---|---|
| Payments | Saved Stripe test key works; account identified; checkout disabled | Server-owned price snapshots, Checkout Sessions, verified Stripe webhooks, idempotency, refund/dispute handling and payment tests |
| Catalogue | API and website run in sample mode | Supplier package/location adapters, validated price sync, availability/freshness checks and scheduled updates |
| Supplier connectivity | Read-only signed balance query returned success | Actual order adapter, stable transaction IDs, retry/reconciliation workflow and controlled fulfilment tests |
| Supplier notifications | Deployed authenticated callback validates and deduplicates events into private Firestore | Consumer that re-queries the authenticated supplier and reconciles orders; records currently await reconciliation |
| Customer delivery | Owner-only order-summary API exists | Secure activation/QR retrieval, installation display, usage, receipts and delivery communications |
| Account flows | Email/password and Google providers enabled; authorized domains repaired; verification gate implemented | Real mailbox verification/reset delivery and Google popup testing on the deployed domain |
| Customer support/legal pages | Pages load; explicitly labelled drafts | Final selling-entity/contact information, support channel, completed terms/privacy/refund content and account deletion/retention process |
| Operations | Admin claim checks exist | Refund/reconciliation tools, alerts, operational reports and end-to-end staging validation |

## Validation and limits

- Lint, workspace type checks, all 20 API/shared tests, and the targeted production frontend build pass.
- Fifteen public website routes returned HTTP 200, including login, signup, reset, dashboard, plan/review, help and legal routes.
- Live API health reports `mode: preview` and `paymentsEnabled: false`.
- Anonymous order, admin and checkout requests return 401. Invalid country parameters and unsupported customer filters return 400.
- The earlier webhook deployment smoke test verified health POST 200, validation 400, authentication 401, persistent receipt, duplicate acknowledgement without rewrite, conflicting ID rejection, and denied anonymous Firestore reads. Its synthetic inbox record was deleted.
- Browser automation was unavailable in this session. HTTP 200 and enabled Auth providers do not prove working browser login, email delivery, payment or installation. No live payment, bank payout or supplier issuance was tested.

## Sources

- Project code: `apps/web/src/components/plan-details.tsx`, `auth-form.tsx`, `auth-provider.tsx`, `dashboard.tsx`; `apps/api/src/app.ts`, `lib/esim-webhook.ts`; `apps/web/src/app/legal/[slug]/page.tsx`.
- Read-only Stripe account API, eSIM Access balance API, live Firebase Auth config/password policy, App Hosting config and Cloud Run service config.
- Stripe key modes: https://docs.stripe.com/keys
- Stripe fulfilment/webhooks: https://docs.stripe.com/checkout/fulfillment.md?ui=full-page
- Firebase user verification: https://firebase.google.com/docs/auth/web/manage-users
