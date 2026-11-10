# Implementation status and launch work

## First draft delivered

- Firebase Hosting sample export and site configuration for `voyaspan-cf6b7`; published successfully to https://voyaspan-cf6b7.web.app using the owning Firebase account.
- Independent npm workspace install and lockfile; Next.js App Router frontend and Fastify TypeScript API.
- Requested blue/ink/soft-white/lime palette, Inter and Manrope, responsive existing storefront.
- Redux itinerary state, full-country matching and best-value/price/data sort, four initial results.
- Destination index/pages, plan details with exact coverage, review step, compatibility acknowledgement.
- Firebase email/Google auth flows and usable post-login account dashboard with verification actions.
- Order list/detail API with verified ID tokens and owner checks. Server-only Firestore access and deny-all client rules.
- Safe sample mode, no fabricated purchases/QR codes or live charges.
- Help and installation content, clearly labelled legal drafts, admin-only service-status screen.
- ESLint/Prettier, CI checks, API/shared tests, Dockerfile and deployment documentation.

## Required before accepting payments

1. Catalogue: real eSIM Access package/location adapters using verified current contract, complete ISO2 metadata, soft-disable and price revisions, 6-hour authenticated scheduler, 429/5xx retry/backoff and freshness monitoring. Current fixtures are samples; current country picker is a curated subset, not a complete country database.
2. Payments: Stripe server-owned immutable price snapshots, hosted checkout, raw-body verified webhooks, event idempotency, async payment support, refunds/disputes and audit trail. The current checkout route deliberately returns 503.
3. Fulfilment: validated Cloud Tasks OIDC, stable supplier transaction IDs, asynchronous query polling, persisted transition enforcement, timeout reconciliation, price-change review/refund, supplier-wallet checks and admin operations.
4. Customer delivery: owner-only activation/QR endpoint with no-store and redacted logs, installation view/download, delayed usage query, secure-link emails and receipt retrieval. Order pages currently show summaries only.
5. Operations/finance: actual processor fees, tax status, refund handling, reporting CSV, support channels, account deletion and retention, role provisioning and monitoring/alerts. Current admin screen shows service readiness only.
6. Contracts and staging: shared Zod contracts and generated OpenAPI documentation; separate environment, App Hosting workspace build, Cloud Run container smoke test, deployed Firestore rules, Auth providers/domains, Google mobile popup handling and real-account verification/reset email testing.
7. Automated end-to-end mock supplier + Stripe test flow and adverse cases. Current tests do not cover payment replay or fulfilment retries because those services are not implemented.
8. Legal/tax/security review and explicit administrator authorization before small, monitored live supplier issuance. No real supplier order may be issued by automated Stripe tests.

## Constraints preserved

- Wholesale costs stay server-side; no client Firestore access.
- Client checkout payload cannot set pricing.
- Auth identity is verified by the API, not accepted from frontend flags.
- Google Analytics is not initialized.
- Static Firebase Hosting storefront deployed. The eSIM webhook API and deny-all Firestore rules are deployed and verified in europe-west4. No charge, test customer creation or supplier purchase has been performed.
- GitHub push and automatic Hosting deployment still require repository write access; local source is committed.

## eSIM webhook receiver

A validated, URL-token-protected eSIM Access callback endpoint and persistent, deduplicated Firestore inbox are deployed on Cloud Run, with protocol health-check support. Default Firestore is in europe-west4, and inbox TTL cleanup is enabled. Live health, authorization, input validation, storage, deduplication and conflict checks passed; the synthetic test record was removed. Events are stored awaiting reconciliation. This delivers webhook receipt only; supplier-confirmed reconciliation, fulfilment and Stripe integration remain pending. See README.md for deployment details.
