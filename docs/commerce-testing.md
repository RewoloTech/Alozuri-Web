# Live catalogue and Stripe test checkout

This release imports real eSIM Access **fixed-data BASE packages** into Firestore and enables Stripe **test payments only**. It never orders an eSIM or spends supplier credit. A successful test payment produces a clearly labelled paid test order, without activation credentials.

## Daily catalogue

The `voyaspan-catalogue-daily` Cloud Scheduler job runs at **03:00 Europe/London every day**. It POSTs to `/internal/catalogue/sync` using a Google-signed OIDC token for the dedicated scheduler service account. Customer tokens and unsigned requests cannot trigger the sync.

The server fetches `/api/v1/open/package/list` with `type: BASE`, validates explicit country coverage, USD prices, bytes, total validity and activation rules, then upserts stable package IDs and disables removed packages. Daily/day-pass products and invalid or unsupported records are excluded rather than mispriced. Supplier requests retry 429/5xx responses. A Firestore lease prevents overlapping syncs, and a severe unexpected catalogue shrink aborts the run.

Retail uses the existing 1.8 markup and minimum-margin helper, with a 50-cent USD floor for Stripe. Wholesale cost and supplier package codes stay server-side. Public catalogue reads have a five-minute per-instance cache, invalidate after sync, and reject plans older than 36 hours. Checkout re-queries the supplier package and asks the customer to reconfirm if coverage, allowance, validity or retail price changed.

The country picker and destination directory are populated from the supported live catalogue. Single-destination mode starts empty, supports changing country, recommends distinct data sizes and lets the user show all matching plans.

## Test checkout

1. Open the App Hosting website and choose a country.
2. Search plans, open one and review coverage, activation and price.
3. Confirm device compatibility and continue to Stripe test checkout.
4. Sign up or sign in if prompted. Email/password users must verify their email before private account access or checkout. Firebase-verified Google users continue without an additional verification email.
5. Stripe hosts card entry and eligible Apple Pay / Google Pay wallets. Wallet visibility depends on browser, device, wallet setup and Stripe eligibility; no dummy wallet buttons are shown in the storefront.
6. Complete a Stripe test payment. Only a verified Stripe webhook can mark the server order paid. The return URL alone never proves payment.
7. The order page polls for confirmation and clearly labels the order as a test. No eSIM is issued.

The backend only enables checkout when `PAYMENTS_MODE=test`, a `sk_test_` key, a webhook signing secret and `SITE_URL` are configured. It rejects live payment events and all client-supplied pricing. It freezes prices in a private order snapshot, uses a UID/request-ID-derived order ID and Stripe idempotency key, verifies raw-body webhook signatures, checks session UID/order ID/amount/currency/mode, and atomically deduplicates payment events. Expired events cannot undo a paid test order.

The Stripe webhook URL is `/v1/webhooks/stripe`. Its signing secret is separate from the eSIM callback URL token. Card/wallet test settings belong to REWOLO TECHNOLOGIES LTD's test account; live Stripe keys and live supplier fulfilment are intentionally unsupported in this release.

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

Web build values: `NEXT_PUBLIC_DEMO_MODE=false`, `NEXT_PUBLIC_PAYMENT_MODE=test`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, and the Firebase public web configuration.

Do not enable real sales until supplier issuance/reconciliation, secure activation delivery, live payments/refunds, policies, support and controlled live fulfilment testing are completed.
