# Alozuri production checkout and eSIM delivery

The code supports both Stripe test payments and real live payments. Production activation is separate from implementation: the currently available local Stripe credentials are test keys, and the Firebase CLI account received a 403 for project `alozuri`. No production deployment, real charge or supplier purchase was performed during implementation.

## Resulting flow

1. A verified customer selects an active, recently synced fixed-data package and confirms device compatibility. The API rechecks the supplier's package and price, then freezes the server-owned retail price and wholesale package snapshot.
2. Stripe Embedded Checkout collects the payment. The browser uses a publishable key in the same environment/account as the API secret key. Card authentication and eligible Apple Pay/Google Pay run inside Stripe's integration.
3. A signed webhook or authenticated server-to-Stripe reconciliation validates the order ID, customer UID, payment mode, session ID, currency and exact total. Payment and a delivery job are written atomically in a Firestore transaction. Test payments never create delivery jobs.
4. The scheduled delivery worker leases each job, independently verifies the live paid Checkout Session and PaymentIntent/charge, then orders one eSIM. Every retry uses the same supplier transaction ID, within the supplier's 50-character limit. A timeout never creates a new supplier transaction or triggers an unsafe automatic refund.
5. The supplier order number is saved before profile lookup. Pending allocations are retried with backoff. The returned profile must match the supplier order, transaction (when present) and package. Its installation credentials are saved separately from public order summaries.
6. The owner can open a ready order to reveal a locally rendered QR code and manual installation details. Direct Firestore access is denied. Installation responses require a verified owner and use `Cache-Control: no-store`.
7. A definite supplier rejection (price check, no balance, no stock or missing package) requests a full refund against the original PaymentIntent with a stable idempotency key. Pending refunds are reconciled; failed refunds require support. Refund/dispute webhooks block further delivery and access to installation details. Existing installed profiles are not automatically revoked; disputes and customer-requested refunds need operator review.

Payment event replays cannot downgrade a ready, refunding or refunded order. Concurrent workers cannot complete the same lease. A crashed worker is recovered after its lease expires. The durable queue continues without the customer keeping the browser open.

## Production configuration

Use **App Hosting**, rather than the sample-only static Hosting export, for arbitrary live-catalogue plan routes. Connect the `Alozuri-Web` repository and build the frontend with:

```ini
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_PAYMENT_MODE=live
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
NEXT_PUBLIC_API_URL=https://YOUR_ALOZURI_API
NEXT_PUBLIC_SITE_URL=https://alozuri.com
```

Keep the Firebase web configuration pointed at project `alozuri`. Rebuild after changing public variables. The key is public; the secret key must never be in the frontend. Until these values replace the committed preview defaults, checkout remains disabled on that deployment.

For the API, copy `infra/production-api.env.example.yaml` to a local deployment configuration and replace the API hostname and scheduler service-account email. Keep `PAYMENTS_MODE=disabled` while setting up infrastructure, then switch it to `live` after the scheduler, live Stripe endpoint, permissions and catalogue are ready.

Map these **Secret Manager secrets** to the API environment:

| Environment name        | Production value                                        |
| ----------------------- | ------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Matching Stripe account's `sk_live_...` key             |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the **live** API webhook endpoint     |
| `ESIM_ACCESS_CODE`      | eSIM Access account access code                         |
| `ESIM_SECRET_KEY`       | eSIM Access signing secret                              |
| `ESIM_WEBHOOK_TOKEN`    | Dedicated random callback token, at least 32 characters |

Required API runtime values:

```ini
GOOGLE_CLOUD_PROJECT=alozuri
DEMO_MODE=false
PAYMENTS_MODE=live
SITE_URL=https://alozuri.com
CORS_ORIGINS=https://alozuri.com
FULFILLMENT_ENABLED=true
FULFILLMENT_WORKER_AUDIENCE=https://YOUR_ALOZURI_API/internal/fulfillment/run
FULFILLMENT_WORKER_SERVICE_ACCOUNT=alozuri-scheduler@alozuri.iam.gserviceaccount.com
CATALOGUE_SYNC_AUDIENCE=https://YOUR_ALOZURI_API/internal/catalogue/sync
CATALOGUE_SYNC_SERVICE_ACCOUNT=alozuri-scheduler@alozuri.iam.gserviceaccount.com
```

Live checkout refuses to start with test secret keys, demo catalogue mode, disabled delivery, missing supplier credentials or missing worker identity configuration. Live `SITE_URL` must use HTTPS. If both bare and `www` domains are served, configure both exact CORS origins, Firebase authorized domains and Stripe payment domains; use one canonical site URL for redirects.

## Deploy and configure schedules

The API image builds from the root Dockerfile. Deploy it to Cloud Run in project `alozuri` using a dedicated runtime service account, a 300-second request timeout and Secret Manager mappings. Its customer endpoints must be publicly reachable; Firebase bearer tokens protect private routes, while Google-signed OIDC tokens protect internal worker/sync routes. The runtime account needs Firestore data access and access to these specific secrets. The deployer also needs permission to build/deploy Cloud Run, use the runtime/scheduler accounts and configure Scheduler. Provision Firestore and deploy the deny-by-default rules in `infra/firestore.rules` to `alozuri`.

Once the API origin and scheduler account exist, create or update the two jobs with:

```sh
node scripts/configure-fulfillment-worker.mjs \
  --project alozuri \
  --region europe-west4 \
  --api-url https://YOUR_ALOZURI_API \
  --service-account alozuri-scheduler@alozuri.iam.gserviceaccount.com
```

The script schedules delivery every minute and catalogue sync at 03:00 Europe/London. It does not grant IAM permissions or enable paid services. The scheduler identity must have permission to invoke the Cloud Run service, and Cloud Scheduler must be able to mint its OIDC token. Its audience must exactly match the configured endpoint. Run the catalogue job once and confirm active packages exist before enabling live checkout. Confirm the delivery job invokes successfully with OIDC; customer Firebase tokens must receive 401 on that route.

The worker processes up to three due orders per request, with leases and backoff. Configure monitoring for non-successful Scheduler invocations, `fulfillmentJobs` backlog/age, `deliveryDelayed` orders, `provision_error`, `refund_pending`, low supplier balance and Stripe disputes. Paid orders are not lost if a single worker attempt fails. Ambiguous supplier errors stay queued rather than refunding a potentially issued eSIM.

## Stripe and customer-facing setup

Register the **live** webhook at:

```text
https://YOUR_ALOZURI_API/v1/webhooks/stripe
```

Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`, `refund.updated` and `refund.failed`.

Enable Apple Pay/Google Pay and register the actual frontend hostnames as Stripe payment method domains. Wallet testing needs HTTPS and an eligible device/wallet. Enable Stripe payment/refund receipts as appropriate in the account. eSIM delivery is available in the signed-in account; this implementation does not send installation secrets by email.

The storefront's legal/support pages still contain draft content. Replace them with the business's actual terms, contact details and policies before accepting customers. Refunds for successfully issued eSIMs are intentionally an operator workflow: confirm supplier eligibility and customer rights before issuing a refund or cancelling/revoking a profile.

## Verification and remaining rollout evidence

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Requires Java 21+ and the Firebase CLI; all Firestore operations stay in demo-alozuri.
npm run test:firestore
```

Tests exercise live/test isolation, supplier timeout/idempotency, profile allocation, refunds, owned activation access, atomic paid-to-job creation, concurrent worker claims, stale leases, and late event replays after delivery/dispute. Stripe/supplier live calls are mocked in these tests. The prior actual Stripe smoke check used a test key to create and expire an embedded session; it did not charge a card or purchase an eSIM.

The following are still deployment checks, not completed claims: valid live Stripe account/key configuration, successful production webhook delivery, worker invocations in `alozuri`, an end-to-end real purchase with an explicitly agreed spending amount, actual QR installation, and wallet completion on eligible devices. The current agent's Firebase permissions error and unavailable browser prevent those checks in this session.

Primary references: [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment), [Stripe refunds](https://docs.stripe.com/refunds), [eSIM Access API](https://docs.esimaccess.com/), and [Cloud Scheduler HTTP/OIDC configuration](https://cloud.google.com/sdk/gcloud/reference/scheduler/jobs/create/http).
