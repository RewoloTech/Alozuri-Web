# VoyaSpan — first draft

Next.js storefront + independent Fastify API for an itinerary-based travel eSIM service.

Published draft: https://voyaspan-cf6b7.web.app (Firebase project `voyaspan`).

**This is a functional preview, not a live shop.** All included plans and prices are clearly labelled samples. Payments, supplier orders and activation credentials are not created. Firebase accounts are real when configured. Do not enable sales until the payment/fulfilment milestones in CODEX_IMPLEMENTATION_BRIEF.md are completed and reviewed.

## Run locally

Use Node 22.13+ and npm. From the repository root:

```sh
npm ci
cp apps/web/.env.example apps/web/.env.local
# Populate the public Firebase configuration in apps/web/.env.local.
npm run dev
```

Open http://localhost:3000. An existing configured `.env.local` should be preserved rather than overwritten. The first draft can be explored without signing in: select an itinerary, compare the first four matching plans, open a plan, confirm device compatibility, and review it. Dashboard preview is at `/dashboard`.

In another terminal:

```sh
npm run dev:api
```

The API listens on http://localhost:8080, in sample mode by default. `/health` reports its current mode. Use `NEXT_PUBLIC_DEMO_MODE=false` in the frontend to fetch the sample catalogue through the API instead of its bundled preview fixture. Restart Next.js after changing public environment variables.

## Firebase account setup

Public web configuration belongs in `apps/web/.env.local`; it is not an Admin credential. Never place a service-account key or supplier/payment secret in a `NEXT_PUBLIC_*` variable.

Enable Email/Password and Google providers in the Firebase console for the VoyaSpan project. Set the Google provider's support email, authorize `localhost` and your eventual frontend domain, and configure verification/reset email templates. The app supports email registration, verification sending and resending, email login, Google popup login/signup, password reset, sign-out and display-name updates. Verification is checked on the API purchase boundary. Google provider configuration and real-account email delivery must be tested in the Firebase project; no test customer was created automatically.

For real API reads use Application Default Credentials (`gcloud auth application-default login` locally) and set `GOOGLE_CLOUD_PROJECT=voyaspan`. The API verifies Firebase ID tokens including revocation, checks ownership and explicitly serializes customer responses. `DEMO_MODE=false` switches the API to server-side Firestore catalogue/order reads. It only returns active packages with `syncedAt` within 12 hours; a live catalogue writer/sync job is still required. Customer order list is limited to the latest fetched 100 records; pagination is a later milestone. No wholesale or activation secrets are returned.

Firestore collection shapes: `packages` stores the shared `StoredPlan`; `orders` stores `{ uid, plan: StoredPlan, status, createdAt: ISO8601, amountCents, currency }`. Direct client reads/writes are denied by `infra/firestore.rules`. The Admin SDK uses IAM and does not rely on these client rules. These rules are provided locally and have not been deployed to your project.

## Account and data validation audit (9 November 2026)

Signup is available next to Log in in the header and at `/register`. Email/password login, Google sign-in, password reset, verification email/resend, sign-out and name editing are implemented. Signup and account settings collect first and last name separately, validate them, and combine them into Firebase Auth's `displayName`. There is no separate first/last-name database record; existing and Google display names are split into editable suggestions, which may need correction for compound given names.

Authentication requests go directly to Firebase Authentication, not the Fastify API or Firestore. Firebase validates credentials; browser name/terms/password-length checks are user experience checks and can be bypassed. Enforce the desired password policy in Firebase Authentication settings. Terms acceptance is currently not recorded as an auditable backend consent record.

The eSIM Access webhook validates notifications before writing a private event inbox; it never creates customer orders. Checkout validates the verified user's request, rejects additional fields such as client prices, and returns 503 without writing or charging. Package queries validate country codes and bounds; document routes validate IDs; customer order queries use the UID from a revocation-checked Firebase ID token, never a supplied customer UID. Admin routes require the verified admin claim. Unsupported filters are rejected. CORS is a browser policy, not authorization.

Firestore reads now validate runtime schemas, not just TypeScript casts. Invalid, inactive, stale or future-dated catalogue records are excluded. Invalid owned orders fail with a generic service error, and public responses strip supplier/activation fields. Future supplier sync, payment webhook and order writers must validate their own inputs before every Admin SDK write; that write pipeline is not implemented yet.

`infra/firestore.rules` denies all direct client document reads/writes. Admin SDK operations bypass these rules and rely on backend validation and IAM. This code audit does not verify the rules currently deployed, live provider/domain/password-policy settings, email delivery or actual customer accounts. The Hosting preview forces sample mode and does not call the order API; empty orders there do not demonstrate a Firebase query failure. API deployment and a real catalogue writer are still pending.

## Routes

- `/`, `/destinations`, `/destinations/[code]`: storefront and itinerary matching.
- `/plans/[id]`, `/checkout/[id]`: coverage, activation, fair-use and sample-price review; no charge action.
- `/login`, `/register`, `/forgot-password`: Firebase account forms.
- `/dashboard`: account, verification, eSIM/order list and honest empty state.
- `/dashboard/orders?id=ORDER_ID`: authenticated order summary. Secure QR retrieval is pending.
- `/help`, `/legal/privacy`, `/legal/terms`, `/legal/refunds`: device/installation guidance and explicitly marked legal drafts.
- `/admin`: backend-verified `admin: true` custom-claim access to service status. Full operations/reporting is pending.

Redux Toolkit owns itinerary state across client navigations. Firebase Auth remains in its auth context; tokens are not persisted to Redux. Preview itinerary state resets on a full page reload. Shared matching/pricing remains framework-independent TypeScript.

## API

- `GET /health`
- `GET /v1/packages?country=FR`
- `GET /v1/packages/match?countries=GB,FR,IT&minGb=10`
- `GET /v1/packages/:id`
- `GET /v1/orders` and `GET /v1/orders/:id`: Bearer Firebase ID token required.
- `POST /v1/checkout`: authenticated, verified-email gate; rejects client pricing and returns 503 because payments are disabled.
- `GET /v1/admin/status`: verified admin custom claim required.

Configure `CORS_ORIGINS` as a comma-separated exact origin list. Request rate limits, 64 KB body limits, no-store responses, validation and credential-header log redaction are enabled. Single-instance in-memory rate limits need a shared limiter/edge enforcement before scaling.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover complete-country containment, pricing units/margin, safe public serialization, state transition rules, API parameter validation, owner-only order access, denied unauthenticated requests, admin claims, CORS and disabled checkout. They do not prove Stripe/supplier fulfilment; neither integration is connected.

Dependency overrides pin patched transitive gRPC, glob and minimatch versions, plus Node 22 compatible Firebase app packages. Recheck these overrides against upstream dependencies during upgrades.

## Deployment targets

Frontend preview: Firebase Hosting site `voyaspan-cf6b7`. Run `npm run build:hosting` to create `apps/web/out`; `firebase.json` publishes that folder, not a default `public` folder. The Hosting build forces sample mode and disables indexing. Public plan/destination/legal routes are pre-rendered; private order IDs are read from the URL only in the browser and never enumerated at build time. Security/cache headers are configured in Hosting. The private order summary uses a query parameter so each customer order can be opened without a server-rendered route or public order snapshots.

Once signed into the owning Google account, deploy only the frontend:

```sh
firebase login:add
firebase projects:list
npm run deploy:hosting -- --project YOUR_FIREBASE_PROJECT_ID
```

Use the owning Firebase **project ID**, which is not necessarily the Hosting **site ID**. `predeploy` automatically runs the sample export build. This command does not deploy Firestore rules, the API, or supplier/payment integrations. The Hosting build includes the verified public Firebase web configuration so fresh GitHub checkouts can build the authentication UI without a local environment file; Admin, supplier and payment credentials are never included. Add `voyaspan-cf6b7.web.app` and `voyaspan-cf6b7.firebaseapp.com` to the Firebase Authentication authorized domains before testing accounts there. Google/email provider setup must also be completed.

Firebase App Hosting uses app root `apps/web`. The root `turbo.json`, pinned `turbo` dependency and `packageManager` declaration enable supported monorepo detection, using the repository lockfile and the shared package. Test the targeted web build with `npm run build:apphosting`. In the Firebase App Hosting backend settings, set **App root directory** to `apps/web`; do not target `/`, which runs the combined web/API build and makes the Next.js adapter look for a nonexistent root `.next/routes-manifest.json`. A plain npm workspace without `turbo.json` instead fails looking for a lockfile inside `apps/web`. Keep the single lockfile at the repository root.

`apps/web/apphosting.yaml` supplies the server hosting settings and defaults to sample mode; Console environment overrides take precedence. Set the `NEXT_PUBLIC_FIREBASE_*` values in that App Hosting backend before building and trigger a new rollout after changing them. The static Hosting preview and App Hosting are separate deployments. Use App Hosting or expand the static build's plan manifest before serving live supplier SKUs; the current static Hosting build deliberately exports only the sample plan IDs. The Docker container recipe is included but has not been Docker-built in this environment.

Backend: Cloud Run using the root Dockerfile. Build from the repository root; set `GOOGLE_CLOUD_PROJECT`, exact frontend `CORS_ORIGINS`, and `DEMO_MODE=true` for preview. Cloud Run must permit public HTTP access for catalogue/customer endpoints; protected routes validate Firebase Bearer tokens themselves. Attach a least-privilege service account for Firestore reads. Do not grant supplier/Stripe access until their implementation is complete.

Deploy Firestore rules separately with Firebase CLI after reviewing the target project. Keep staging and production in separate projects. The static storefront has been deployed to Firebase Hosting. The independent preview API and deny-all Firestore rules are deployed; see the webhook setup below. GitHub currently has CI validation only; automatic Hosting deployment still needs `firebase init hosting:github` with an account able to write the repository and its Actions secrets.

## eSIM Access webhook

Deployed API: https://voyaspan-api-g74tu22y5q-ez.a.run.app (Cloud Run, `europe-west4`). Firestore is provisioned in the same region. The complete private callback URL is saved locally in the Git-ignored `apps/api/.env.webhook` file; it must not be committed. The deployed receiver was verified with health, authorization, validation, persistence, duplicate and conflict checks. Direct unauthenticated database access was also denied. The API remains in preview mode with payments disabled.

The API accepts `POST /v1/webhooks/esim-access?token=YOUR_WEBHOOK_TOKEN`. Use a separately generated `ESIM_WEBHOOK_TOKEN` of at least 32 characters, stored in Google Secret Manager and attached to the API service. This is not the eSIM Access SecretKey or a Stripe credential. The supplier must be given the complete private URL including its query token. Application request URLs are redacted; Cloud Run infrastructure request logs can still contain the URL, so restrict access to those logs and rotate the token if disclosed.

The receiver follows the envelope documented at https://docs.esimaccess.com/: `notifyType`, `notifyId`, `eventGenerateTime`, and `content`. It supports `CHECK_HEALTH`, `ORDER_STATUS`, `ESIM_STATUS`, `SMDP_EVENT`, `DATA_USAGE`, and `VALIDITY_USAGE`. Health checks return HTTP 200 without creating an order. Business notifications are validated and stripped to known fields, then atomically stored in the private `supplierWebhookEvents` collection before returning 200. Duplicate notifyIds with the same payload are acknowledged without another write; conflicting reuse returns 409. Database errors return 503. Missing or incorrect credentials return 401, and an unconfigured receiver returns 503. Request bodies are limited to 32 KB.

Inbox records have `processingStatus: awaiting_reconciliation` and a 30-day `expireAt` timestamp. Firestore TTL is enabled on that field for automatic cleanup. Notifications only prove possession of the callback URL; they are not proof of payment or supplier provisioning. The future fulfilment worker must query the authenticated supplier API before changing any customer state. This receiver does not purchase eSIMs, generate QR codes, or process Stripe payments.

The API runs separately from the website, using a dedicated Cloud Run service account. It needs Firestore data access, Firebase Auth read access for revocation checks on customer endpoints, and Secret Manager access to its webhook token. Direct browser Firestore access remains denied by `infra/firestore.rules`. Local API development now loads `apps/api/.env` automatically through the Node.js environment-file flag. See `docs/esim-webhook.openapi.yaml` for the webhook request/response contract.
