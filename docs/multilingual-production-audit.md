# Multilingual release audit — 16 November 2026

All 13 languages are implemented and enabled in this local build. **Nothing has
been deployed.** The automated content audit is complete; professional legal and
native-language approval has not been obtained. Browser regression verification is complete for the implemented flows. This report does not declare an unreviewed legal release
production-ready.

## Implementation

- The shared, strictly typed catalogue now covers the customer storefront,
  destinations, regional plans, search/filter/sort controls, cart, checkout,
  promotions, authentication, account/profile, order history, installation, usage,
  help, guides, partnerships, consent and loading/error/empty states.
- All seven current legal policies have full content in every language: 91
  versioned documents, with source/structure/link checks and exact text hashes.
  Version `2026-11-16.1` adds the actual language-preference disclosures; the prior
  English master is archived without rewriting historical order evidence.
- Complete confirmation subjects, email bodies, installation instructions, legal
  text and PDF contracts use the saved order language and original amounts.
  QR data and technical identifiers are unchanged. Stripe payment descriptions
  are localized; frozen historical request bodies and notification retries remain
  protected. This app provides confirmations/contracts, not new tax invoices.
- All locales have working URLs, native metadata and product schema, canonical
  links, 13 hreflang alternates, `x-default` and sitemap entries. Existing English
  URLs remain unchanged. The production-only product-page static/dynamic error
  found during this audit is corrected while retaining the catalogue data cache.
- Arabic receives native document/text direction with the original structural
  order. Technical values are isolated LTR. Header controls remain 44 pixels high.
  Actual browser layouts and PDF pages were visually inspected. Chat uses normal flow on checkout, cart, private orders and account forms so it cannot obscure actions.
- The protected Operations language screen now renders the actual email template
  with synthetic order/QR data, all seven legal texts and an explicit review flag.
  Administrator authorization remains required on every operation.

The original 537-location conservative JSX inventory now reports **zero unresolved
customer-facing literals**. No inventory exclusion was added to hide customer
content. The audit additionally distinguishes complete content from professional
legal approval; its nonzero exit currently reflects that review requirement.
Dynamic content is checked separately through rendering and workflow tests.

## Verification

| Check                                                            | Observed result                                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                   | Passed                                                                                                                                      |
| `npm run typecheck`                                              | Passed in all workspaces                                                                                                                    |
| `npm run typecheck:tests`                                        | Passed                                                                                                                                      |
| Prettier on changed/new implementation files                     | Passed on changed/new implementation files                                                                                                  |
| `npm run test:unit`                                              | 38 shared, 210 API and 15 i18n tests passed; focused catalogue/document checks rerun after the final copy addition                          |
| `npm run test:jest`                                              | 22 passed                                                                                                                                   |
| `npm run test:firestore` with isolated emulator                  | 125 passed                                                                                                                                  |
| `npm run test:auth` equivalent isolated Auth integration command | 3 passed                                                                                                                                    |
| Auth-emulator browser cases                                      | All 8 passed across focused runs, including every account language and revoked Operations access                                            |
| Ordinary browser regression suite                                | 107 unique cases passed across the full suite and focused reruns; all 9 full-run failures passed in the 30-case follow-up                   |
| `npm run test:stripe`                                            | 13 real Stripe sandbox cases passed, one per language; English also exercises decline/retry on the same intent                              |
| Compiled API document/asset smoke test                           | All 13 languages rendered through production JavaScript with bundled fonts and correct PDF language metadata                                |
| Native document matrix                                           | 15 passed: source/91 text hashes, all languages, original currencies, complete legal text, QR bytes, deduplicated snapshots and actual PDFs |
| Product structured-data unit checks                              | 8 passed, including native labels with unchanged SKU/amount/currency                                                                        |
| `npm run build`                                                  | Next.js and API production builds passed                                                                                                    |
| Disposable production SEO build/server                           | All 13 language paths passed native HTML/metadata/schema/sitemap checks; private pages, aliases and removed URLs also passed                |
| Release inventory                                                | Complete content in all 13 languages; 0 static customer literals; review requirement remains                                                |

The additional account-form check visited login, registration and password-reset pages in every language at 375, 390, 768 and 1440 pixels, including password controls and legal links.

The ordinary full run passed 97 cases and exposed 9 remaining text/structure regressions. The follow-up reran all affected files plus the native-language/document flows: **30 passed, zero failures**. The 8 Auth-emulator and 13 Stripe cases are conditional skips in the ordinary run and passed in their dedicated runs. This accounts for all 128 configured browser cases without treating skipped tests as passes.

The real Stripe harness uses matching test keys, local Firestore, the existing
server checkout code and verified/signed test payment state. It has no supplier
connection. Distinct synthetic client IPs avoid treating 13 test customers as one
rate-limited client; production limits and proxy trust behaviour were not changed.

Browser checks cover mobile, tablet and desktop; language/currency/query/hash
persistence; guest and authenticated carts; quantities and account merges;
compatibility and legal validation; promotions and final payment totals; conditional
wallet rendering/fallback; server-confirmed payment tracking; private orders;
usage; current/legacy browser PDF downloads and retryable font failures. The native
matrix also verifies that an English website preference cannot change a PDF's saved
order language.

Full native contract pages and email screenshots were inspected, including Arabic,
Japanese, Korean, Simplified Chinese, Polish and Romanian. A font coverage check
confirmed glyph availability for all catalogue/legal text in every language. The
missing Latin extensions and Arabic punctuation detected during review were fixed
using complete self-hosted fonts. Visual checks are engineering QA, not professional
translation approval.

## Release requirements and verification limits

1. **Professional legal review remains required for Spanish, German, French,
   Italian, Brazilian Portuguese, Romanian, Japanese, Korean, Simplified Chinese,
   Arabic, Dutch and Polish.** `POLICY_TRANSLATION_REVIEW` records this honestly.
   Native editorial sign-off is also not claimed. These flags do not disable the
   completed languages in the local application.
2. Explicit deployment authorization is still required. Release the matching API
   before the website so native checkout never reaches an older English-only API.
   Existing supported English checkout versions remain accepted. No database
   migration, new service, scheduler or automatic deployment was introduced.
3. Live supplier ordering, real customer email delivery and physical-device wallet
   authorization were **NOT RUN** in this change. Fulfilment, QR readiness,
   webhook replay, ownership, refunds and notification retries passed controlled
   regression tests. Email and PDF contents were rendered locally; no real eSIM
   or customer email was generated for QA.
4. Full CJK PDF fonts load only when downloading a contract and add approximately
   6–12 MB on first use, then cache locally. Normal storefront page loads do not
   fetch these fonts. Output PDFs remain bounded by the existing 5 MB limit.

Primary implementation locations: `packages/shared/src/i18n`, customer pages and
components under `apps/web/src`, native metadata helpers, and the existing API
legal/email/contract renderers. Currency state, conversion/pricing/promotion
calculations, payment confirmation rules, supplier adapters, fulfilment scheduling,
authentication permissions and Firestore business records retain their existing
sources of truth.
