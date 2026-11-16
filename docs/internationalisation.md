# Internationalisation: controlled implementation

## Current publishing status

English remains the existing production language. Spanish, German, French, Italian,
Brazilian Portuguese, Romanian, Japanese, Korean, Simplified Chinese, Arabic,
Dutch and Polish are registered but **unpublished**. The owner confirmed that no
reviewed translations are available. Core catalogue translations are drafts, not
an approved translation of the entire storefront or of a complete email.

This is the foundation for the requested multilingual rollout, not completion of
all 13 customer journeys. Do not enable another locale merely by changing a
review flag. The missing implementation and review work below must be completed.

## Shared architecture

`packages/shared/src/i18n` owns the typed locale registry, exact message contract,
version-controlled draft catalogues, lazy message loading, stable error identifiers,
and legal-document resolver. `next-intl` provides the web context and ICU rendering;
`use-intl` uses the same catalogues on the backend. No translation service is called
at runtime and ordinary translations are not stored in Firestore.

The audit (`npm run test:i18n`) checks exact keys/domains, valid ICU, interpolation
variables, unexpected markup, untranslated English placeholders, Polish/Arabic
plural forms and publishing gates. French “Destinations” is an explicit legitimate
same-word exception. Native review is still required.

The language provider resolves explicit selection, saved account locale, guest
cookie, browser languages, then English. Only published languages are selectable.
`alozuri_locale` is a functional preference cookie; it is separate from marketing
consent. The account endpoint is `PATCH /v2/profile/language`, authenticated using
the existing Firebase token. It accepts only a locale, never a target UID or role.
The header has a compact globe dropdown next to currency. English is selectable;
unpublished languages are disabled under “Not available yet”. The profile selector
remains hidden while only English is published.
Cart, currency, globe, account and menu controls share a 44 px header height.

Language code does not read/write the currency preference or call exchange-rate
or pricing functions. The existing `alozuri-currency` storage, currency detection,
rate snapshots, minor-unit calculations and checkout totals are unchanged.

Existing English URLs remain canonical. `/en/...` redirects to them with the query
string intact. Draft locale prefixes return private, non-indexable 404 responses.
API, operations and internal routes are not localised. No foreign-language
canonical, hreflang or sitemap entry is advertised before its page exists.

## Transaction snapshots and legal evidence

New purchases store `locale`; their child eSIM orders inherit it. Locale is part
of checkout idempotency comparison. An existing checkout request cannot be
converted into a differently worded contract by changing a profile or browser.
Stripe Elements receives the **server-returned order locale**, not a subsequent
website preference. `zh-Hans` maps to Elements' `zh`. This app uses PaymentIntents
and Elements; it does not create Stripe Checkout Sessions or tax invoices.

Legal acceptance retains its existing version, text, business identity, timestamp
and behaviour. Added fields are `legal.locale` and a SHA-256 `legal.contentHash`
over canonical content/version metadata. Timestamp is deliberately excluded from
the content hash. Existing policy versions remain the English master.
`legalDocuments(locale, version)` rejects missing languages and unknown versions;
it never returns an English substitute for a non-English request.

Historical records with **absent** locale mean English. Present invalid locales
are rejected; they do not default to English. No bulk migration or rewriting of
historical transactions is required. Email/PDF rendering checks order/legal locale
agreement and publication. Existing recorded currencies and amounts are retained.

## Durable confirmation outbox

The existing backend-owned `OrderConfirmations` worker still runs through the
existing event-driven task workflow. No service, cron or polling job was added.
Ready confirmations still wait for all eSIM installation records. Existing
historical pending-confirmation behaviour is preserved.

Before a new message is sent, a Firestore transaction writes its immutable rendered
snapshot to `purchases/{purchaseId}/notifications/order-confirmation` and updates
the established purchase send markers. It records the event, deterministic
notification ID, locale, template version, HTML, plain text, subject, sender,
recipient, inline attachments, payload hash, attempts, status and timestamps.
The original Resend idempotency key is preserved. Provider ID, delivery status and
safe diagnostics are recorded after sending/reconciliation.

Retries use that snapshot; they do not render new content from a changed template
or current profile. Changed activation credentials require review rather than
sending an obsolete QR code. Concurrent workers use the existing transactional
lease. Ambiguous sends older than the existing 23-hour safe retry window require
reconciliation, rather than risking a duplicate after Resend's retention window.
Already-sent purchases remain deduplicated indefinitely by their Firestore markers.
Legacy in-flight sends without snapshots retain their payload-hash safeguard.

Snapshots contain private order links and installation credentials. Existing
Firestore rules deny all direct browser access. No customer/operations serializer
returns this subcollection. `rendered` is exempted from indexing in
`infra/firestore.indexes.json`; deploy that index configuration with the release.
Oversized or inconsistent snapshots require review before any send.

There is no new manual resend endpoint. Do not clear send markers to resend an
uncertain message. A controlled, audited resend operation remains to be implemented.

## Errors and compatibility

Fastify supplies `errorDetails: {code, params, requestId, field?}` alongside the
existing English `error` string, preserving deployed clients during migration.
Clients requesting `X-Alozuri-Error-Format: 2` receive the canonical
`{error: {code, params, requestId, field?}}` envelope. Promotion and checkout-retry
conditions have explicit codes; frontend checkout no longer recognises them by
parsing English sentences. Unknown identifiers use safe generic copy.

The browser maps known identifiers to the shared translated catalogue, including
catalogue revision changes and invalid search cursors. It never displays the API's
English compatibility message, even for validation errors. Safe field, parameter
and request-ID metadata are retained. Mapping every remaining endpoint to specific
domain codes is still required before publishing other languages. Server business
logic is not translated. Stale catalogue recovery uses error identifiers rather
than matching English text.

## Review and preview

Verified administrators can open `/operations/languages` from Operations. The API
`GET /v1/operations/localization/preview?locale=ar` verifies administrator access on
every request. It previews the core catalogue, a clearly labelled draft email-copy
sample, plain text and current legal availability. English legal source documents
can be expanded; absent translated legal content is explicitly reported as missing.
The sandboxed iframe has no access to account state and sends no messages.

## Work required before a non-English launch

- Finish extracting the remaining storefront, destination, account, promotion,
  installation and validation copy. Current catalogues cover core labels only.
- Implement fully translated public routes, metadata, canonical/hreflang/sitemap
  output, route-aware navigation, SSR language and cross-route cart preservation.
- Complete the full order/ready/delayed/refund/top-up/payment/security templates;
  connect newly introduced notification types only to verified existing events.
  The existing consolidated English email is the only delivery template today.
- Add complete approved legal documents for each version/language and use them
  consistently on web pages, in acceptance snapshots and in transactional documents.
- Implement and verify Arabic RTL across full pages and email, plus shaping/fonts
  for Arabic/CJK PDF documents. RTL core preview does not establish full RTL support.
- Add audited manual resend controls. Do not translate an existing transaction
  implicitly when account preferences change.
- Finish native, technical and legal review, recording reviewer/version evidence.
- Test German checkout followed by French preference changes, concurrent orders
  in different languages, full translated emails/PDFs, refunds/top-ups and localised
  SEO. These journeys cannot pass while those languages are intentionally blocked.
- Verify Stripe-generated receipts separately if enabled. Do not describe the
  existing order-confirmation PDF as a VAT invoice or change a Stripe Customer's
  global language to control concurrent order communications.

## Verification

See `tests/unit/i18n.test.ts`, `apps/api/test/localization.test.ts`, the locale and
notification cases in `apps/api/test/commerce.firestore.mts`,
`tests/e2e/localization.spec.ts` and the administrator preview checks in
`tests/e2e/cart-auth.spec.ts`. Checkout/cart Jest tests render the real i18n provider.
Existing currency, promotion and guest checkout browser regressions were also run.
Test fixtures use no real charges, supplier purchases or customer emails.

Recorded local checks on 16 November 2026:

| Check                                                                  | Result                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run lint`                                                         | Passed, no warnings                                                 |
| `npm run typecheck`                                                    | Passed, all workspaces                                              |
| `npm run typecheck:tests`                                              | Passed                                                              |
| `npm run test:unit`                                                    | 38 shared + 193 API + 7 localisation/release-inventory tests passed |
| `npm run test:jest`                                                    | 22 tests passed                                                     |
| `npm run build`                                                        | Next.js production build and API build passed                       |
| Firestore emulator, complete commerce suite                            | 86 tests passed before the final focused additions                  |
| Firestore emulator, final locale/confirmation/contract/currency subset | 13 tests passed                                                     |
| Currency and shopping browser regression subset                        | 23 tests passed                                                     |
| Localisation routing/privacy browser tests                             | 2 tests passed                                                      |
| Follow-up plan/currency browser subset                                 | 12 tests passed                                                     |
| Auth emulator profile/customer navigation                              | Passed                                                              |
| Auth emulator Operations + all 13 previews + role revocation           | Passed                                                              |

Browser checks included 375, 390, 768 and 1440 px widths. The Arabic email-copy
sample was visually inspected at mobile width; this is not verification of complete
Arabic storefronts or Arabic PDFs. No live Stripe charge, live supplier order,
customer email send or non-English checkout was attempted.

For a later release, deploy and verify the API's structured-error support before
deploying the web changes. Apply the Firestore index exemption. No credentials,
extra scheduler, paid translation service or currency migration are required.

No deployment is performed by this implementation.

## Production publication gate

`npm run i18n:check-release` validates every locale, required domain status and
legal-document availability, then inventories static customer JSX text and
accessibility attributes that still need extraction. Exact technical names and
values are excluded. This is a conservative inventory; it does not claim to find
all dynamic strings, verify native wording or approve legal documents.

The command exits unsuccessfully while any required locale/content is incomplete.
See `docs/multilingual-release-audit.json` for the current result and counts by file.
Passing commerce regression tests does not override this publication gate. Do not
use a label change, an English fallback or a preview deployment to present this
unfinished multilingual implementation as production-ready.
