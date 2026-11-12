# Live catalogue and Stripe test checkout

This release imports real eSIM Access **fixed-data BASE packages** into Firestore and enables Stripe **test payments only**. It never orders an eSIM or spends supplier credit. A successful test payment produces a clearly labelled paid test order, without activation credentials.

## Daily catalogue

The `alozuri-catalogue-daily` Cloud Scheduler job runs at **03:17 UTC every day**. It POSTs to `/internal/catalogue/sync` using a Google-signed OIDC token for the dedicated scheduler service account. Customer tokens and unsigned requests cannot trigger the sync.

The server fetches `/api/v1/open/package/list` with `type: BASE`, validates explicit country coverage, USD prices, bytes, total validity and activation rules, then upserts stable package IDs and disables removed packages. Daily/day-pass products and invalid or unsupported records are excluded rather than mispriced. Supplier requests retry 429/5xx responses. A Firestore lease prevents overlapping syncs, and a severe unexpected catalogue shrink aborts the run.

Retail uses the existing 1.8 markup and minimum-margin helper, with a 50-cent USD floor for Stripe. Wholesale cost and supplier package codes stay server-side. Public catalogue reads have a five-minute per-instance cache, invalidate after sync, and reject plans older than 36 hours. Checkout re-queries the supplier package and asks the customer to reconfirm if coverage, allowance, validity or retail price changed.

The country picker and destination directory are populated from the supported live catalogue. Single-destination mode starts empty, supports changing country, recommends distinct data sizes and lets the user show all matching plans.

## Test checkout

1. Open the App Hosting website and choose a country.
2. Search plans, open one and review coverage, activation and price.
3. Confirm device compatibility and choose Continue to payment.
4. Sign up or sign in if prompted. Email/password users must verify their email before private account access or checkout. Firebase-verified Google users continue without an additional verification email.
5. The embedded Stripe form handles card entry, payment confirmation, card authentication and eligible Apple Pay / Google Pay wallets on the checkout page. Wallet visibility depends on browser, device, wallet setup and Stripe eligibility; no dummy wallet buttons are shown in the storefront.
6. Complete a Stripe test payment. A signed Stripe webhook or an authenticated server-to-Stripe status check verifies the session against the stored order before marking it paid. The return URL and browser completion callback never prove payment.
7. The order page reconciles with Stripe, polls for confirmation and clearly labels the order as a test. Customers can resume an open session after cancelling authentication or returning to an unpaid order. Expired sessions offer a fresh checkout. No eSIM is issued.

The backend only enables checkout when `PAYMENTS_MODE=test`, a `sk_test_` key, a webhook signing secret and `SITE_URL` are configured. It rejects live payment events and all client-supplied pricing. It freezes prices in a private order snapshot, uses a UID/request-ID-derived order ID and Stripe idempotency key, verifies raw-body webhook signatures, checks session UID/order ID/amount/currency/mode, and atomically deduplicates payment events. Expired events cannot undo a paid test order.

The Stripe webhook URL is `/v1/webhooks/stripe`. Its signing secret is separate from the eSIM callback URL token. Card/wallet test settings belong to REWOLO TECHNOLOGIES LTD's test account; test environments never issue eSIMs. Live mode is available separately; see [production setup](production-checkout.md).

## Firebase verification and password reset

Email/password signup creates only a verification session. Firebase sends the verification email, and `/verify-email` offers resend and status refresh. Private pages and APIs require the verified ID-token claim. Google sign-in uses Firebase's verified provider identity and does not send a second verification email.

Password reset uses Firebase's reset email and hosted action handler, with a return to `/login`. The local Auth emulator test covers signup, verification, refreshed token claims, reset-code validation, replacement password, rejection of the old password and reused reset code, and Google sign-in without an extra email:

```sh
firebase emulators:exec --only auth --project demo-voyaspan --config infra/auth-emulator.json "node scripts/test-auth-flow.mjs"
```

`test-auth-flow.mjs` refuses to run against production. Real inbox delivery still depends on the customer's email provider and Firebase mail quotas. No production mailbox delivery or wallet payment is claimed by the emulator test.

## Runtime configuration

API Secret Manager references: `ESIM_ACCESS_CODE`, `ESIM_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the existing `ESIM_WEBHOOK_TOKEN`.

API plain values: `DEMO_MODE=false`, `PAYMENTS_MODE=test`, `SITE_URL`, `CATALOGUE_SYNC_AUDIENCE`, `CATALOGUE_SYNC_SERVICE_ACCOUNT`, `GOOGLE_CLOUD_PROJECT`, `CORS_ORIGINS`.

Web build values: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` (the same Stripe account/sandbox as the API secret key), `NEXT_PUBLIC_DEMO_MODE=false`, `NEXT_PUBLIC_PAYMENT_MODE=test`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, and the Firebase public web configuration.

For real sales, use the separate [production checkout configuration and verification steps](production-checkout.md). Test mode always remains isolated from supplier issuance.

## Enable embedded test checkout

Use App Hosting for live-catalogue plan routes. The static Hosting export intentionally contains sample plans only, and those plans cannot be purchased.

Set the frontend build environment and rebuild:

```ini
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_PAYMENT_MODE=test
NEXT_PUBLIC_API_URL=https://YOUR_ALOZURI_API
NEXT_PUBLIC_SITE_URL=https://alozuri.com
```

Set the API environment (use `http://localhost:3000` for local `SITE_URL` and `CORS_ORIGINS`):

```ini
GOOGLE_CLOUD_PROJECT=alozuri
DEMO_MODE=false
PAYMENTS_MODE=test
SITE_URL=https://alozuri.com
CORS_ORIGINS=https://alozuri.com
```

Map `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ESIM_ACCESS_CODE` and `ESIM_SECRET_KEY` from Secret Manager into the API. The Alozuri service account needs Firestore access, and the catalogue must be synced before choosing a real plan. Keep API credentials out of the frontend. The publishable key is public and must be available when Next.js builds. The committed App Hosting defaults remain preview-only until the Alozuri API URL and build values are supplied.

Configure a Stripe **test** webhook endpoint at `https://YOUR_ALOZURI_API/v1/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired` and `checkout.session.async_payment_failed`. Use that endpoint's signing secret. For local tests, run `stripe listen --forward-to localhost:8080/v1/webhooks/stripe` and use the CLI listener's signing secret instead.

Enable Apple Pay and Google Pay in Stripe's payment method settings and register every frontend hostname used for embedded checkout, including `alozuri.com` and `www.alozuri.com` if both are served. Test wallets over HTTPS with an eligible configured wallet. Wallet visibility is controlled by Stripe; card entry remains the fallback. See [Stripe's embedded Checkout setup](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=embedded-page) and [payment method domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration).

Manual acceptance checks (Stripe test mode only):

- Pay using `4242 4242 4242 4242`, a future expiry, any three-digit CVC and billing details. Confirm the order page says **Test payment complete**, and the payment appears in the matching Stripe sandbox.
- Use `4000 0025 0000 3155` to exercise card authentication; complete it and verify the same paid order result.
- Use `4000 0000 0000 9995` for a decline. The form must show Stripe's error and allow correction without a second order.
- Cancel card authentication or reload an unpaid order; Continue payment must reopen the existing session. A completed or expired session must not reopen.
- Delay webhook delivery and verify the authenticated payment-status endpoint still confirms a paid order directly with Stripe. Replay the webhook and confirm there is no duplicate state transition.
- Verify sign-out, unverified accounts, another customer's order ID and changed prices cannot authorize payment or retrieve another session's client secret.

Automated coverage includes both hosted and embedded session creation, request idempotency, resumed sessions, webhook verification, delayed confirmation, expired-to-paid reconciliation, session/order mismatch rejection, and authenticated status routes. A real Stripe test session was created and expired successfully during implementation. Browser submission and wallet completion still need the manual checks above; browser automation was unavailable in this environment.
