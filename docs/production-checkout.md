# Alozuri checkout and eSIM delivery

## Customer flow

Destination selection has one canonical state shared by the search UI, URL and session persistence. A trip must contain at least two countries; switching back to one destination requires an explicit country choice. Matching packages must cover every selected country.

`/cart` persists guest items locally. Signed-in carts use authenticated, versioned API writes, a deduplicated guest merge, and recovery of pending changes after refresh. Unavailable cached items remain removable. Quantities are limited to five per package and ten eSIMs per purchase.

The cart allows navigation to checkout while its price confirmation runs. Known unavailable items and an account-cart sync still block navigation. Checkout confirms the current total independently while the customer fills in their details; payment stays blocked until availability, total and device acknowledgement are valid. Busy controls retain their purple styling, show a spinner and explain the current step. Read-only checkout configuration and quote requests stop waiting after 10 seconds and offer a retry. Payment creation and confirmation retain their existing idempotency and recovery behaviour; this timeout does not retry or cancel money-moving requests.

`/checkout` accepts guests and signed-in customers. Buy now and the cart use the same `/v2/checkout` flow. The API loads current supplier products, freezes their identifiers and prices, validates the confirmed delivery email/device acknowledgement, and creates an idempotent Stripe PaymentIntent. A changed total requires confirmation again. A card decline can retry the same intent. New creation through the former `/v1/checkout` endpoint returns 410; legacy receipt/resume and webhook handling remain for existing orders.

Stripe Payment Element collects card details; Express Checkout Element offers eligible Apple Pay and Google Pay. Stripe controls eligibility, so unsupported devices retain card checkout without fake wallet buttons. The browser receives only the public key and intent client secret. Card data never passes through Alozuri's API.

Only a signed webhook, independently checked against Stripe's current intent, amount, currency, mode and order metadata, authorises delivery. A success redirect cannot mark an order paid. Each purchased unit gets a distinct child order and installation credential. Atomic jobs, leases, stable supplier transaction IDs and reconciliation prevent webhook replay or supplier timeouts from creating blind repeat purchases. Test payments never issue real eSIMs.

Customers can view purchase progress at `/checkout/success` and signed-in history at `/account/esims`. A verified account with the delivery email can retrieve matching guest purchases. Guest access uses a private HMAC-derived token, stored hashed on the server. Email links carry the token in a URL fragment, which the client removes and keeps in session storage. Private responses disable caching. Firestore rules deny direct client access. Delivery email contains a private order link, not raw installation secrets.

The worker independently verifies payment before issuing each unit, retries pending allocations, and requests an idempotent per-unit refund for definite supplier rejection. Unknown outcomes remain recoverable rather than triggering another chargeable purchase. Refund/dispute events restrict further issuance and activation access. Already installed profiles are not automatically revoked; customer-requested refunds and disputes require operator review.

## One complete purchase confirmation

Verified Stripe success creates per-purchase Cloud Tasks work. New `email-v2-ready` confirmations wait until every purchased eSIM has saved, validated installation details. The minute fulfilment scheduler is paused; see [order processing](order-processing.md). Its sender is `Alozuri <orders@alozuri.com>`, reply-to is `support@alozuri.com`, and subject is **Your Alozuri eSIM order confirmation**. The email contains a readable order reference, the recorded payment date, full plan details, one secure status/install link, installation steps, and the complete accepted Terms and Refund Policy beneath the practical information. HTML uses inline styles, a fluid layout and the existing brand logo; plain text contains the same transaction and contract. New, unattempted ready confirmations include QR PNGs as private inline CID attachments under the existing **Install when you are ready** section. Each eSIM has its own QR, SM-DP+ address, activation code, optional confirmation code and ICCID, plus Wi-Fi, device-settings and keep-profile instructions. These details are included in plain text too. QR generation runs locally in the API; no external QR service or public credential URL is used. Only the owned private records for the purchased units enter this section; supplier transaction references stay excluded. There are no PDF email attachments or additional services. Customers can separately download their contract as a PDF from the private order page.

Checkout freezes the business identity, terms/refund versions and full policy text with the existing legal acceptance timestamp. The worker reads those snapshots and plan prices/countries, never the current catalogue or website policy content. The payment timestamp comes from the signed Stripe success event, not email-generation time. Test payments do not send customer email or issue supplier profiles. Missing customer names, tax rates and expiry dates are not invented.

A Firestore lease serialises workers. One fixed Resend idempotency key and persisted payload hash protect retries, including the inline PNG content. The private `confirmationIncludesInstallation` marker is selected before the first send: older in-flight messages retain their original attachment-free body, while new messages keep deterministic QR content across retries. Send failures back off from one minute to one hour; uncertain sends stop for review after 23 hours, before Resend's 24-hour idempotency retention ends. A changed payload, invalid snapshot or ambiguous legacy send also requires review instead of a blind resend. See [Resend idempotency](https://resend.com/changelog/idempotency-keys).

The worker records provider acceptance separately from confirmed delivery, using [Resend's sent-email status](https://resend.com/docs/api-reference/emails/retrieve-email). Existing `email-v1` orders retain their delivery-before-supply gate. New ready confirmations are sent after provisioning; bounces require support and never trigger another supplier purchase or routine email. `confirmationStatus`, `confirmationAttempts`, sanitised `confirmationError`, provider ID and delivery checks are stored on the private purchase. Worker logs contain counts and generic operation names, not customer data or private links. The ready email is withheld while any unit or its owned private activation record is missing. The secure order page remains available during preparation. No second installation email is sent.

Checkout no longer supplies `receipt_email` to Stripe, which otherwise forces an additional receipt even when automatic receipts are off. Disable Stripe Dashboard **Customer emails → Successful payments** at the production cutover; billing email remains available for the payment method. This is an account setting, not changed by this code. See [Stripe receipts](https://docs.stripe.com/receipts). Already-open PaymentIntents retain their existing settings.

Deployment must update the API worker and publish `/images/alozuri-email-logo.png` on the storefront. Confirm the Resend domain and API-key permissions, run a controlled real mailbox test, and check Gmail, Outlook and Apple Mail before claiming live client rendering. Automated tests decode the generated QR PNGs and scaled browser previews; these do not establish rendering in real mailbox clients. See [Resend inline image requirements](https://resend.com/changelog/embed-images-using-cid). Do not overlap old and new worker revisions during the cutover. Unattempted legacy notifications can join the single-email queue; already-sent or ambiguous legacy messages are retired without an automatic resend. Review `legacy_send_review_required` records against provider history manually. Never clear an uncertain send's timestamp/hash or change its key just to retry it.

The implementation preserves existing accepted legal content; it does not establish a new legal or VAT policy. Business/legal review of the underlying content and tax configuration remains applicable.

## Contract PDF downloads

The order page downloads `Alozuri-Order-Confirmation.pdf` using `GET /v2/orders/:id/contract.pdf`. The same guest access header or verified-owner checks used for private orders apply; an administrator cannot bypass ownership. Unpaid orders return 409. The PDF uses immutable purchase/terms snapshots and recorded timestamps, excludes activation credentials and access tokens, and is returned with PDF/attachment and no-store headers. Opening or polling the order page does not generate a PDF.

PDFKit renders only after the customer clicks Download; each request is handled in memory without saving a PDF in Firestore, Firebase Storage or the server filesystem. The existing single email remains HTML/plain text without a PDF attachment. Static licensed Inter fonts are bundled during the API build by `scripts/copy-assets.mjs`; no browser engine is used. Deploy both the website download control and the API endpoint before enabling the feature in production.

On 12 November 2026, a read-only Stripe check found all three checkout domains active for both wallets, but the live default payment configuration had Google Pay off/unavailable. Its Google Pay display preference was enabled and then retrieved again: both Google Pay and Apple Pay reported available/on. Browser/device eligibility still applies. No wallet payment was made during this configuration change.

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
# Fixed confirmation sender: Alozuri <orders@alozuri.com>
FULFILLMENT_ENABLED=true
FULFILLMENT_WORKER_AUDIENCE=https://YOUR_ALOZURI_API/internal/fulfillment/run
FULFILLMENT_WORKER_SERVICE_ACCOUNT=alozuri-scheduler@alozuri.iam.gserviceaccount.com
CATALOGUE_SYNC_AUDIENCE=https://YOUR_ALOZURI_API
CATALOGUE_SYNC_SERVICE_ACCOUNT=alozuri-catalogue-scheduler@alozuri.iam.gserviceaccount.com
```

Verify `alozuri.com` in Resend with its required DNS records before using `orders@alozuri.com`. The confirmation worker retrieves sent-email delivery status; its Resend key must permit retrieval as well as sending. Sending-only keys cannot perform this check. The legacy `ORDER_EMAIL_FROM` variable no longer changes the sender. Live cart checkout fails closed without the signing secret, email provider, live payment configuration, supplier credentials and authenticated delivery-worker configuration. Change `PAYMENTS_MODE` to `live` only after deployment checks pass.

Deploy the root Dockerfile to Cloud Run with a dedicated runtime account, Firestore access, access to the specified secrets and a 300-second request timeout. Customer routes must be reachable publicly; private routes verify Firebase identity or the guest token. Worker/catalogue routes verify Google-signed OIDC tokens. Deploy `infra/firestore.rules` to project `alozuri`.

Configure the single daily catalogue job after the API origin and scheduler identity exist:

```sh
node scripts/configure-catalogue-scheduler.mjs \
  --project alozuri \
  --region europe-west4 \
  --api-url https://YOUR_ALOZURI_API \
  --service-account alozuri-catalogue-scheduler@alozuri.iam.gserviceaccount.com
```

The script configures only daily catalogue sync at 03:17 UTC and pauses an existing legacy minute fulfilment job. The former script filename remains a compatibility entry point with the same catalogue-only behaviour. It does not grant IAM or enable services. GitHub catalogue sync is manual-only; order processing uses Cloud Tasks. Confirm OIDC invocation and sync a fresh supplier catalogue before enabling checkout. Monitor delivery queue age, delayed allocations, failed refunds, email retries, supplier balance and disputes.

## Stripe webhooks and wallets

Register the matching-mode endpoint `https://YOUR_ALOZURI_API/v1/webhooks/stripe` and subscribe to:

- `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`, `payment_intent.canceled`;
- `charge.refunded`, `charge.dispute.created`, `refund.updated`, `refund.failed`;
- legacy `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed` while old orders remain.

Stripe payment method domains were registered and reported Apple Pay and Google Pay active in both live and test modes for `alozuri.com`, `www.alozuri.com`, and `alozuri--alozuri.europe-west4.hosted.app`. Wallets still require HTTPS, an eligible browser/customer wallet, supported currency and account settings. Domain activation alone is not evidence of a completed wallet payment.

A read-only Stripe API check on 11 November 2026 reconfirmed that those three domains are enabled in live mode and both wallet domain statuses are `active`. The local frontend now uses the Express Checkout `always` settings for Apple Pay and Google Pay, ordered before Link. These settings broaden supported-browser coverage and can offer wallet setup; Stripe still suppresses methods on unsupported platforms/currencies. The standard Payment Element leaves their duplicate wallet controls disabled because Express Checkout owns the wallet buttons. Link and Revolut Pay are separate methods selected by Stripe, rather than replacements for device wallets.

Stripe requires HTTPS for Express Checkout wallets in development as well as production. `http://localhost:3000` does not verify wallet availability. Test on a registered HTTPS domain with an eligible browser/device, or use a registered HTTPS development tunnel. See [supported browsers and display settings](https://docs.stripe.com/elements/express-checkout-element#supported-browsers) and [development prerequisites](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment?payment-ui=elements). Actual Apple Pay/Google Pay authorisation still requires eligible-device verification; the local settings have not been deployed.

For this wallet-display update, four focused Playwright wallet/card regressions passed, including unavailable-wallet fallback and the broader display options/order. The real Stripe TEST card decline/retry/payment case passed separately. Scoped lint, application/test TypeScript and formatting/diff checks passed. These results do not verify an actual Apple Pay or Google Pay transaction.

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
- The initial zero supplier balance correctly blocked checkout before payment creation. After the owner funded the account, a live checkout on `https://alozuri.com` passed the capacity check, created a live PaymentIntent matching the exact server total, and displayed the real Stripe card form. That verification intent was cancelled without collecting money; its signed webhook updated the saved order to cancelled. Balance is rechecked on every live checkout.

The frontend rollout `build-2026-11-10-017` succeeded for commit `2351505`. Hosted browser checks confirmed immediate tabs, 19 France-only plans, two local 50 GB plans, nine local unlimited options and 18 unlimited trip matches for France/Switzerland/Italy, with no browser exceptions.

No live customer charge or supplier purchase was made by the agent. The owner-controlled charged purchase, actual eSIM allocation, delivery email and installation remain the final operational verification.

## Simplified checkout / store transport rollout

Deploy the updated API before the Next.js App Hosting frontend. The API accepts the concise `2026-11-11.2` order-placement notice and the strict prior `2026-11-11.1` checkbox format for already-open checkouts. New orders do not record express early-supply consent or cancellation-loss acknowledgement. Preserve archived policies and historical order snapshots.

The browser normally calls `NEXT_PUBLIC_API_URL`. Blocked network requests to approved store operations can fall back to `/api/store/...` on the frontend origin; the Next.js server forwards to `ALOZURI_API_URL` when set, otherwise `NEXT_PUBLIC_API_URL`. Use the configured public `NEXT_PUBLIC_SITE_URL` for App Hosting origin checks. This route needs a server deployment and is unavailable with legacy static export. It forwards no website cookies or service-account credentials and never exposes internal worker/webhook operations. Checkout IDs and cart merge/version data must remain unchanged across transport fallback. HTTP errors are not automatically replayed.

After release verify public configuration, add-to-cart, cart quote and guest checkout on the actual frontend domain. Test blocked direct API requests and explicit price retry; verify the authoritative paid amount, signed webhook and private order state. This release does not authorise or apply the separate live catalogue pricing migration.

## Authorised bundle/pricing activation — 11 November 2026

The owner subsequently approved the live pricing migration and API/frontend rollout. Both are now deployed, checkout is open in live mode, and the four derived bundle records refresh through the existing daily workflow. The backed-up migration and live product/currency/cart/checkout-quote checks passed. The owner chose to retain the current supplier balance; capacity checks continue to block orders before charging when available supplier credit is insufficient. Full activation evidence and remaining real-wallet/delivery verification limits are in [production-release.md](production-release.md).

## Payment-triggered queue migration

The replacement for the minute fulfilment poll is implemented but has not been activated. Follow [the order-processing runbook](order-processing.md) for queue configuration, service identity/IAM, pending-order migration, verification and rollback. The default remains scheduler mode to preserve the existing live flow until approval. Do not deploy queue mode with an unconfigured queue or disable the existing scheduler before the replacement is validated. No additional application service is required.
