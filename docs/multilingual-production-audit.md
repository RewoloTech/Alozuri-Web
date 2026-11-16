# Multilingual production audit — 16 November 2026

**Result: not ready for a 13-language production release. Nothing deployed.**

The existing live website returned HTTP 200 and the API health endpoint returned
`status: ok`, catalogue mode and live payment mode. These are checks of the existing
deployment, not verification that the uncommitted multilingual changes are live.

## Blocking work

`npm run i18n:check-release` correctly exits with a nonzero status. The current
inventory contains 537 static customer-text candidates outside the translation
system. It excludes exact technical values and internal Operations pages and is
conservative: dynamic strings and complete email bodies require separate review.
These are locations, not necessarily 537 distinct translation keys.

All 12 non-English languages remain incomplete. They have core draft catalogues,
but lack complete website/checkout content, complete approved transactional
templates, approved legal bundles and finished document rendering. Localised
routes/SEO, full Arabic layouts and Arabic/CJK PDFs also remain unfinished.

There are no reviewed non-English legal documents available. The required human
review cannot be represented as complete by changing a flag or a label. New
languages must not be enabled for real checkout until their complete transaction
content exists and passes the release gate. English fallback cannot stand in for
an accepted foreign-language contract.

Counts by file and per-locale blockers are recorded in
[`multilingual-release-audit.json`](multilingual-release-audit.json). Run the release
check again after the implementation and content are completed. A passing code
regression suite alone does not establish multilingual readiness.

## Corrections made during the full check

- Customer API error handling now exclusively uses translated catalogue messages.
  Raw English API messages cannot become customer-facing fallbacks. Safe field,
  request-ID and parameter metadata are retained.
- Catalogue changes and invalid search cursors now have stable server error codes.
  Search recovery no longer parses English sentences to decide when to discard
  stale pages and offer a new search.
- Controlled browser fixtures use the actual structured error contract. Their
  assertions confirm generic or registered copy instead of private diagnostics.
- Delivery-status lookup failures no longer attempt to write `undefined` to the
  durable notification record. Retry recovery preserves the original notification
  and does not send another message. Successful sends clear stale diagnostics.
- Added a release checker and a tested static JSX/accessibility-text inventory.
- New Stripe PaymentIntents record `alozuriLocale` from the immutable purchase
  snapshot for traceability. The existing Payment Element receives that same
  stored locale. Historical orders and payment calculations are unchanged.

Pricing, currency selection/conversion, payment amounts and supplier ordering
calculations were not modified.

## Actual verification

| Command/check                                                             | Result                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run lint`                                                            | Passed                                                               |
| `npm run typecheck`                                                       | Passed, all workspaces                                               |
| `npm run typecheck:tests`                                                 | Passed                                                               |
| `npm run test:unit`                                                       | 38 shared, 193 API and 7 localisation/release-inventory tests passed |
| `npm run test:jest`                                                       | 22 tests passed                                                      |
| `npm run build`                                                           | Next.js and API production builds passed                             |
| `npm run test:firestore` with isolated emulator                           | 124 tests passed                                                     |
| Focused Firestore notification tests after the delivery-status correction | 2 tests passed                                                       |
| `npm run test:auth` with isolated emulator                                | 3 integration tests passed                                           |
| `npm run test:cart:browser` with isolated Auth emulator                   | 7 browser tests passed                                               |
| `npm run test:e2e` after corrections                                      | 99 passed, 8 skipped by configured conditions                        |
| `npm run i18n:check-release`                                              | Failed: required multilingual content/review is incomplete           |
| Production container smoke test                                           | NOT RUN: Docker CLI unavailable locally                              |
| Live Stripe charge, supplier purchase or customer email send              | NOT RUN                                                              |
| Complete non-English checkout, email, contract and PDF journeys           | NOT RUN: required content is missing and publication is blocked      |

`npm run test:stripe` also passed with matching real Stripe test keys and local
Firestore: a card decline, retry on the same intent and successful sandbox payment.
The eight ordinary-suite skips were seven Auth-emulator cases and one real Stripe
SDK case; all eight passed in their dedicated runs. This accounts for all 107
configured browser cases across the three runs. The final locale-metadata
Firestore regression also passed for USD, GBP and EUR.

The browser suite covered mobile/desktop, cart persistence/merge, currency totals,
guest and authenticated checkout initiation, compatibility validation, promotional
codes, wallet eligibility/fallback, private orders, contract downloads, consent and
tracking, usage display, navigation and SEO for the existing published experience.
It does not prove the unfinished foreign-language experience works.

No preview release, production rollout, database migration, IAM change or scheduler
change was made during this audit.
