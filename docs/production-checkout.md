# Alozuri checkout and eSIM delivery

## Customer flow

Destination selection has one canonical state shared by the search UI, URL and session persistence. A trip must contain at least two countries; switching back to one destination requires an explicit country choice. Matching packages must cover every selected country.

`/cart` persists guest items locally. Signed-in carts use authenticated, versioned API writes, a deduplicated guest merge, and recovery of pending changes after refresh. Unavailable cached items remain removable. Quantities are limited to five per package and ten eSIMs per purchase.

`/checkout` accepts guests and signed-in customers. Buy now and the cart use the same `/v2/checkout` flow. The API loads current supplier products, freezes their identifiers and prices, validates the confirmed delivery email/device acknowledgement, and creates an idempotent Stripe PaymentIntent. A changed total requires confirmation again. A card decline can retry the same intent. New creation through the former `/v1/checkout` endpoint returns 410; legacy receipt/resume and webhook handling remain for existing orders.

Stripe Payment Element collects card details; Express Checkout Element offers eligible Apple Pay and Google Pay. Stripe controls eligibility, so unsupported devices retain card checkout without fake wallet buttons. The browser receives only the public key and intent client secret. Card data never passes through Alozuri's API.

Only a signed webhook, independently checked against Stripe's current intent, amount, currency, mode and order metadata, authorises delivery. A success redirect cannot mark an order paid. Each purchased unit gets a distinct child order and installation credential. Atomic jobs, leases, stable supplier transaction IDs and reconciliation prevent webhook replay or supplier timeouts from creating blind repeat purchases. Test payments never issue real eSIMs.

Customers can view purchase progress at `/checkout/success` and signed-in history at `/account/esims`. A verified account with the delivery email can retrieve matching guest purchases. Guest access uses a private HMAC-derived token, stored hashed on the server. Email links carry the token in a URL fragment, which the client removes and keeps in session storage. Private responses disable caching. Firestore rules deny direct client access. Delivery email contains a private order link, not raw installation secrets.

The worker independently verifies payment before issuing each unit, retries pending allocations, and requests an idempotent per-unit refund for definite supplier rejection. Unknown outcomes remain recoverable rather than triggering another chargeable purchase. Refund/dispute events restrict further issuance and activation access. Already installed profiles are not automatically revoked; customer-requested refunds and disputes require operator review.

## Currency and tax limits

USD is the only supported checkout currency. Unsupported currencies are rejected; no invented conversion rates are used. The current quote adds no separate tax or fee (`taxCents: 0`). This is not a regional tax engine. The business must establish its applicable tax treatment and configure any required collection before opening live sales. The reviewed server total is the exact Stripe charge amount.

## Frontend configuration

Use Firebase App Hosting for live catalogue routes. Backend `alozuri` in `europe-west4` now points at `apps/web`, fixing the root/workspace selection error. The empty API URL entry was removed from `apps/web/apphosting.yaml`, because App Hosting rejects empty env values.

Set these build variables when the production API is ready:

```ini
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_PAYMENT_MODE=live
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
NEXT_PUBLIC_API_URL=https://YOUR_ALOZURI_API
NEXT_PUBLIC_SITE_URL=https://alozuri.com
```

Set the `NEXT_PUBLIC_FIREBASE_*` browser configuration for project `alozuri` too. Public variables require a rebuild. The active storefront uses the live catalogue and matching live Stripe configuration. Keep separate previews in demo/test mode; do not mix test and live Stripe keys.

## API secrets and runtime

Store these values in Google Secret Manager and map them to the API service. Never put private values in `NEXT_PUBLIC_*`, Git or chat.

| Secret name             | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Matching account's test/live Stripe secret key                   |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the deployed API webhook endpoint             |
| `ESIM_ACCESS_CODE`      | eSIM Access account access code                                  |
| `ESIM_SECRET_KEY`       | eSIM Access request signing secret                               |
| `ESIM_WEBHOOK_TOKEN`    | Dedicated random supplier callback token, at least 32 characters |
| `ORDER_ACCESS_SECRET`   | Stable random guest-link signing secret, at least 32 characters  |
| `RESEND_API_KEY`        | Resend API key authorised to send from the verified domain       |

The live Stripe and supplier credential secret names already exist in project `alozuri`; `ORDER_ACCESS_SECRET` was created without revealing its value. Preserve it across deployments so existing guest links keep working. The `STRIPE_WEBHOOK_SECRET` and `RESEND_API_KEY` secret names now exist; the signing secret must match the actual live endpoint before activation. The Resend sending domain was verified.

Use `infra/production-api.env.example.yaml` for runtime values, including:

```ini
GOOGLE_CLOUD_PROJECT=alozuri
DEMO_MODE=false
PAYMENTS_MODE=disabled
SITE_URL=https://alozuri.com
CORS_ORIGINS=https://alozuri.com
ORDER_EMAIL_FROM=esim@alozuri.com
FULFILLMENT_ENABLED=true
FULFILLMENT_WORKER_AUDIENCE=https://YOUR_ALOZURI_API/internal/fulfillment/run
FULFILLMENT_WORKER_SERVICE_ACCOUNT=alozuri-scheduler@alozuri.iam.gserviceaccount.com
CATALOGUE_SYNC_AUDIENCE=https://YOUR_ALOZURI_API/internal/catalogue/sync
CATALOGUE_SYNC_SERVICE_ACCOUNT=alozuri-scheduler@alozuri.iam.gserviceaccount.com
```

Verify `alozuri.com` in Resend with its required DNS records before using `esim@alozuri.com`. Live cart checkout fails closed without the signing secret, email provider, live payment configuration, supplier credentials and authenticated delivery-worker configuration. Change `PAYMENTS_MODE` to `live` only after deployment checks pass.

Deploy the root Dockerfile to Cloud Run with a dedicated runtime account, Firestore access, access to the specified secrets and a 300-second request timeout. Customer routes must be reachable publicly; private routes verify Firebase identity or the guest token. Worker/catalogue routes verify Google-signed OIDC tokens. Deploy `infra/firestore.rules` to project `alozuri`.

Configure the recurring jobs after the API origin and scheduler identity exist:

```sh
node scripts/configure-fulfillment-worker.mjs \
  --project alozuri \
  --region europe-west4 \
  --api-url https://YOUR_ALOZURI_API \
  --service-account alozuri-scheduler@alozuri.iam.gserviceaccount.com
```

The script configures minute delivery and daily catalogue sync; it does not grant IAM or enable paid services. Confirm OIDC invocation and sync a fresh supplier catalogue before enabling checkout. Monitor delivery queue age, delayed allocations, failed refunds, email retries, supplier balance and disputes.

## Stripe webhooks and wallets

Register the matching-mode endpoint `https://YOUR_ALOZURI_API/v1/webhooks/stripe` and subscribe to:

- `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`, `payment_intent.canceled`;
- `charge.refunded`, `charge.dispute.created`, `refund.updated`, `refund.failed`;
- legacy `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed` while old orders remain.

Stripe payment method domains were registered and reported Apple Pay and Google Pay active in both live and test modes for `alozuri.com`, `www.alozuri.com`, and `alozuri--alozuri.europe-west4.hosted.app`. Wallets still require HTTPS, an eligible browser/customer wallet, supported currency and account settings. Domain activation alone is not evidence of a completed wallet payment.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
# Requires Java 21+ and Firebase CLI; uses demo-alozuri only.
npm run test:firestore
# Requires local test keys only; real Stripe sandbox card calls, no supplier purchases.
npm run test:stripe
```

The Stripe sandbox browser test completes a declined card followed by successful retry on the same PaymentIntent and checks the paid receipt. It uses Stripe's real Payment Element/API; the harness forwards a locally signed webhook after observing Stripe's status, so production webhook transport is not exercised. Firestore integration tests cover multi-unit allocations, replay, failed/test payment isolation, private retrieval, mocked delivery/email and cart merge/version conflicts. Browser tests cover destination state, cart persistence/mobile widths, guest validation, card retry and mocked eligible Apple/Google wallet callbacks.

Still unverified: actual Apple Pay/Google Pay transactions on eligible hardware, Resend delivery, a real charged supplier purchase and QR installation. The deployed sandbox test now verifies actual Stripe webhook delivery, and the production worker has returned HTTP 200 with its scheduled OIDC identity. No live charge or supplier purchase was made. A catalogue-only API and daily sync are now deployed (see [catalogue status](catalogue-and-filters.md)). Live Stripe/supplier/email secrets and the minute fulfilment worker are now mapped. Supplier credit and real payment-to-installation verification are required; tax treatment and final business/legal content still need owner review.

References: [Stripe Express Checkout](https://docs.stripe.com/elements/express-checkout-element), [Stripe payment domains](https://docs.stripe.com/payments/payment-methods/pmd-registration), [Stripe webhooks](https://docs.stripe.com/webhooks), [eSIM Access API](https://docs.esimaccess.com/).

## Activation verification on 2026-11-10

- Production API: `https://alozuri-api-rnm3hsyqia-ez.a.run.app`; its config reports live catalogue, live cart checkout and eSIM Access fulfilment.
- Live webhook: `https://alozuri-api-rnm3hsyqia-ez.a.run.app/v1/webhooks/stripe`; its own signing secret is stored in Secret Manager.
- Sandbox API: `https://alozuri-api-sandbox-rnm3hsyqia-ez.a.run.app`, with separate test Stripe secrets and endpoint. A real test card decline and retry succeeded against that service; Stripe itself delivered the signed webhook and the receipt became paid. No webhook simulation was used. Test orders create neither supplier jobs nor delivery-email jobs.
- The live publishable/secret key pair was verified through Stripe.js on `alozuri.com` using an unconfirmed verification intent, which was cancelled without collecting money.
- `alozuri-fulfillment` runs every minute using the dedicated scheduler identity. A real scheduled invocation returned HTTP 200; an unsigned request returned 401. Firestore deny-by-default rules were deployed.
- Local browser checks confirmed immediate tabs, 19 France-only plans versus 82 including regional coverage, and a usable contact/review checkout. The old configuration notice is gone.
- Supplier balance was zero at the last pre-payment check. Checkout returned a clear temporary-unavailability response before creating a charge. The owner is topping up the account; sufficient balance will be rechecked on each checkout. This guard does not require another deployment after funding.

No live customer charge or supplier purchase has been performed in this session. A funded, real purchase and installation remain the final operational verification.
