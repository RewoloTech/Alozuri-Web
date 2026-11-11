# Production verification — 11 November 2026

## Decision

Live card checkout is enabled and the local payment/fulfilment tests pass. Full production sign-off remains pending an owner-completed live order, delivery and installation, actual wallet authorisations, tax/legal review, and isolation of the outdated deployed sandbox. An extra $50 improves supplier capacity but does not remove these requirements.

The owner has not yet added the extra $50 and will place the real test order personally. This verification made no live customer charge, supplier purchase or email send. No application code, deployment or payment configuration was changed.

## Checks executed

| Check                                                   | Outcome                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`                                          | PASS (initial quick review in this conversation)                                                                                                                         |
| `npm run typecheck`                                     | PASS (initial quick review)                                                                                                                                              |
| `npm test`                                              | PASS (initial quick review)                                                                                                                                              |
| `npm run typecheck:tests`                               | PASS                                                                                                                                                                     |
| `npm run build`                                         | PASS, Next.js and API                                                                                                                                                    |
| `npm run test:e2e`                                      | 25 passed; real Stripe case intentionally skipped in fixture suite                                                                                                       |
| `npm run test:cypress`                                  | 13 passed                                                                                                                                                                |
| `npm run test:firestore`                                | 26 passed using temporary Java 21; first attempt was blocked by installed Java 17                                                                                        |
| Auth emulator with `scripts/test-auth-flow.mjs`         | PASS: signup, verification, reset, old-password/reset-code rejection and simulated Google identity                                                                       |
| `npm run test:stripe`                                   | PASS: one real Stripe TEST Payment Element decline/replacement-card retry and paid receipt, with local Firestore and simulated signed webhook delivery; no supplier call |
| `STRIPE_SANDBOX_API_URL=… npm run test:stripe:deployed` | FAILED: old sandbox returned a changed-plan error before payment; test timed out. Actual Stripe webhook delivery was not reverified                                      |
| `npm audit --omit=dev --json`                           | Zero reported vulnerabilities                                                                                                                                            |
| `npx prettier --check .`                                | FAILED on pre-existing formatting in `AGENTS.md`, `apps/web/next-env.d.ts`, `docs/readiness-review-2026-11-10.md`, `scripts/test-auth-flow.mjs`                          |

## Direct production observations

- `https://alozuri.com` responds with HTTP 200. API configuration reports live catalogue, live cart checkout, eSIM Access fulfilment and USD/GBP/EUR support.
- Live Stripe credentials were used for read-only configuration checks: charges and payouts enabled; the production payment webhook enabled with the current PaymentIntent/refund/dispute events; Apple Pay and Google Pay domain status active for `alozuri.com` and `www.alozuri.com`. Domain activation is not an actual wallet payment.
- Cloud Run revision `alozuri-api-00007-ncv` is ready and receives 100% of traffic. Checkout is unpaused and fulfilment enabled. Expected Stripe, supplier, order-access and email secret references are mapped; secret values were not printed or written to the report.
- The fulfilment scheduler is enabled every minute with OIDC. Recent scheduled HTTP requests returned 200. The initial cloud read used the global CLI account and was denied; selecting the repository's configured account resolved access.
- Unsigned worker and sync calls return 401; an unsigned Stripe webhook returns 400; private cart access returns 401; a synthetic nonexistent purchase returns 404; anonymous Firestore enumeration returns 403. Real cross-customer access is covered by local integration tests, not by reading live customer records.
- The Resend sending domain `alozuri.com` is verified. Real inbox delivery remains untested.
- Live France/Switzerland/Italy searches returned 63 plans in each supported currency; every returned plan covers all three countries. The checked responses contained no supplier-code, wholesale-unit or guest-access-hash fields.
- Public product prices matched server quote totals in USD, GBP and EUR for the checked UK package.
- Browser verification on the actual domain: add to cart, reload persistence, guest contact/compatibility validation, completed server quote and enabled Continue to payment. Payment was not submitted. Cart and checkout had no horizontal overflow at 375/390/768/1440 px and no observed JavaScript exceptions. Desktop/mobile checkout screenshots were visually reviewed. This is not an exhaustive WCAG audit; keyboard/dialog regressions are included in the fixture suite.

## Supplier funding

Read-only supplier balance and catalogue checks at approximately 17:04 UTC returned:

| Measure                                |  Result |
| -------------------------------------- | ------: |
| Current prepaid balance                |  $50.00 |
| Proposed balance after another $50     | $100.00 |
| Active supplier packages               |   3,283 |
| Individually affordable now            |   3,154 |
| Individually affordable at $100        |   3,254 |
| Packages still individually above $100 |      29 |
| Highest single wholesale cost          | $381.69 |

These are a point-in-time capacity calculation, not a reservation or a guarantee for simultaneous/multi-item orders. Each cart needs enough credit for its combined wholesale cost; outstanding orders and new sales consume balance. The real checkout capacity check remains necessary.

## Outdated deployed sandbox and restoration

The deployed sandbox uses API image `api:8baf298`, revision `alozuri-api-sandbox-00003-2cm`, with `GOOGLE_CLOUD_PROJECT=alozuri`: it shares the production catalogue. Its older checkout repricer changed `priceCents` and `syncedAt` on the French product `esim-7043473abec339c888373f9b` during quote validation. This is unsafe test isolation; do not rerun the deployed sandbox harness against that service.

Both changed fields were restored from Firestore's historical snapshot at `2026-11-11T17:05:00Z`, using an update-time precondition to avoid overwriting concurrent work. A subsequent read verified the full document matches the pre-test field snapshot, and the restored product passes the current certified pricing validator. There was no charge or supplier order from the failed test.

Before using deployed sandbox tests again, give the sandbox separate Firestore data and matching API/catalogue pricing code. Until then use `npm run test:stripe`, which confines its database writes to `demo-alozuri` in the local emulator. No cloud deployment was performed as part of this review.

## Owner's final live acceptance

1. Add supplier funds if desired, then recheck the actual balance. Use an unlocked eSIM-compatible device physically in a country the selected plan covers. Choose a low-cost plan that includes that country; review the activation rule before buying. A UK 1 GB / 7 day plan was quoted at $1.99 during this review, but verify its current checkout price.
2. Place exactly one normal guest order with an inbox you control and your real payment method. Save the order reference privately. Check the actual Stripe charge against the final server total and currency; a success redirect alone is insufficient.
3. Confirm the private order progresses to a ready eSIM, the delivery email arrives and its link works. Verify one purchased unit has exactly one supplier allocation and a matching supplier balance debit. Investigate a delayed order before starting another purchase.
4. Install the eSIM, select it for mobile data and follow the plan/device roaming instructions. Turn off Wi-Fi and confirm mobile data works in the covered country. Successful installation alone does not prove network service outside coverage.
5. Separately complete eligible Apple Pay and Google Pay purchases if both are advertised. Mock wallet callbacks and active domain registrations do not establish real authorisation.

Keep private order links, tokens and QR/activation credentials out of chat and public screenshots. Tax remains coded as zero separate tax; the owner must establish applicable treatment and complete the outstanding legal/operational review. No jurisdictional tax configuration was invented or changed.
