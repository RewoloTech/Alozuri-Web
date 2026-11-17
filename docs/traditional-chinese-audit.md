# Traditional Chinese implementation audit

Implemented locally on 17 November 2026, extending the existing 20-locale work.
No application deployment or production data change was performed.

## Changes

- Added `zh-Hant` — 繁體中文 alongside `zh-Hans` — 简体中文 in the existing
  registry, native globe selector, lazy browser loader and synchronous email/PDF
  loader. There are now 21 enabled locales.
- Added all 933 customer message values and seven complete versioned policies.
  Traditional Chinese started from the existing Simplified Chinese translations,
  with one-time character conversion followed by terminology and sentence edits.
  These include 帳戶, 方案, 電子郵件地址, 啟用, 電信業者鎖定, refund rights,
  privacy consent, payment guidance and Taiwan/Hong Kong installation menu names.
  It does not depend on character conversion or a translation service at runtime.
- `zh-TW`, `zh-HK` and `zh-MO` browsers select `zh-Hant`; `zh-CN`, `zh-SG`
  and generic `zh` select `zh-Hans`. An explicit script tag wins over a conflicting
  region. The existing explicit URL/manual selection, account preference, cookie,
  browser and English fallback priority is preserved, independently of currency.
- Added native geographic labels and `zh_TW` Open Graph metadata. Existing routing,
  canonical, 21-locale `hreflang`, `x-default`, structured data and sitemap shards
  derive from the shared registry; Simplified Chinese URLs are preserved.
- Stripe Elements maps `zh-Hant` to supported `zh-TW` and retains `zh-Hans` → `zh`.
  A small shared helper maps Firebase provider/email language to `zh-TW` or
  `zh-CN`, reused in existing login, checkout account, verification and account
  resend actions. It does not change authentication or payment authorization.
- Self-hosted Noto Sans TC regular/bold fonts load only for authorized PDF downloads.
  The browser prefers device fonts for Traditional Chinese; normal page visits do
  not fetch the full PDF font pair. Both font files cover all 892 Chinese
  characters in the new catalogue and policies. Pinned source commits, SHA-256
  hashes and the existing OFL licence accompany the assets.

Principal files are `packages/shared/src/i18n/zh-Hant.ts`,
`i18n/policies/2026-11-16.1/zh-Hant.ts`, the existing locale/catalogue registries,
`document-fonts.ts`, `localized-metadata.ts`, four authentication components,
font assets, targeted CSS and localization/SEO/payment regression tests.

Stripe regression testing also exposed an existing confirmation refresh race.
The API reads the purchase and its allocations separately; a verified webhook can
commit between those reads. A captured sandbox response contained
`status: pending_payment`, no `paidAt`, and an allocation with `status: paid`.
The confirmation page previously stopped refreshing test orders once any allocation
was present. It now continues the existing bounded page refresh while the parent
payment is pending or processing. A deterministic browser regression checks that
the pending message and disabled contract remain until a subsequent server response
confirms payment. No payment status is inferred from an allocation, and server
payment/fulfilment logic is unchanged.

Existing Simplified Chinese message and policy files are unchanged. All 140
previous policy digests are preserved; seven Traditional Chinese digests bring the
current manifest to 147 documents. Original transaction currencies, amounts,
saved order language and historical notifications are unchanged. Internal
Operations remains English. No npm dependency, database, service or scheduled
job was added.

## Verification

- `npm test`: 38 shared, 218 API and 18 internationalisation tests passed.
  API coverage includes actual emails, QR data, immutable legal snapshots and
  rendered PDFs for all 21 saved order languages.
- `npm run test:i18n`: 18 passed after final assertions, including both Chinese
  script/region mappings, preference precedence, provider language codes,
  independent catalogues, currency-preserving URLs and regional PDF fonts.
- `npm run test:jest`: 27 passed. `node --import tsx --test tests/unit/seo.test.ts`:
  nine passed, including 21-locale alternatives and bounded sitemap shards.
- `npm run test:firestore` with Java 21: 125 passed using local emulators,
  including checkout locale validation, legal evidence, confirmations, duplicate
  webhooks, fulfilment claims, currency and access-control regressions.
- `node --import tsx tests/seo-production.mts`: disposable production build/server
  passed all 21 locales, canonical/hreflang, schema, sitemap, robots and private
  route checks.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:tests` and
  `npm run build`: passed. Focused Prettier and `git diff --check` passed.

Focused Playwright runs used the existing disposable server and configured runner:

- The main run passed 11 checks covering all 21 home routes, country/guide/partner
  pages, account forms, complete legal pages, actual email templates, filled
  checkout state, guest payment initiation, GBP/EUR quantity repricing and browser
  PDF downloads in every saved order language. Both Chinese locales passed
  375/390/768/1440px layout, native selector, browser detection and reload checks.
- One additional regional-return test initially failed because its fixture copied
  language cookies but omitted the existing, separate currency localStorage.
  The fixture now restores a complete browser storage state. Currency code was
  not changed. The corrected test passed for Hong Kong, Macau and Singapore,
  including manual script choices, a new browser session, GBP persistence and
  an explicitly requested opposite-language URL.
- An Auth-emulator browser run passed all four selected checks: the corrected
  regional-return test, verified checkout/account preferences in all 21 locales,
  both Chinese manual preferences through real login/logout against an opposing
  saved account language, and the existing manual-English regression case.
- The deterministic confirmation refresh regression passed: an allocation can
  appear while payment is pending; the contract remains disabled until the page
  obtains a subsequent server-confirmed paid response.

The initial Stripe sandbox run exposed the refresh race above in Portuguese and
Korean. After the fix, `npm run test:stripe` passed **all 21 cases**, including
both Chinese locales, the previously failing locales, and English declined-card
recovery using the same PaymentIntent. Matching Stripe test keys and local
Firestore were used; no supplier was connected to the harness.

`npm run i18n:check-release` reports complete content for all 21 locales and zero
customer literals requiring extraction, but **exits nonzero** because independent
professional legal review remains outstanding. This is an outstanding review,
not an approved release check. No professional translation or native-speaker
review is claimed for the new catalogue.

## Manual checks and limits

Traditional Chinese contract pages were rasterized and inspected for readable
glyphs, wrapping and original monetary values. Font repertoire, source hashes and
licence paths were checked. Both Chinese mobile and desktop hero layouts, plus
the actual Traditional Chinese mobile confirmation email, were inspected.

No live supplier purchase, live payment, physical-device wallet test or email to
a real customer was performed. There is no existing customer top-up purchase
route to localize or test. Existing purchase, account, usage and installation
functionality is reused. Native-speaker and professional legal review remains
outstanding.

Deploy the matching backend before the frontend so server locale validation
accepts `zh-Hant`; no deployment is included in this task.
