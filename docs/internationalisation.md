# Alozuri internationalisation

All 21 languages are implemented and enabled in the local build: English, Spanish,
German, French, Italian, Brazilian Portuguese, Romanian, Japanese, Korean,
Simplified Chinese, Arabic, Dutch, Polish, Turkish, Russian, Vietnamese,
Indonesian, Hindi, Thai, Ukrainian and Traditional Chinese. This change has **not been deployed**.
Professional native-language and legal approval has not been obtained. The legal
review requirement is recorded separately from whether content exists and is enabled.
See [the Traditional Chinese audit](traditional-chinese-audit.md) for current
verification, [the additional-languages audit](additional-languages-audit.md) for
the 20-language baseline and [the earlier release audit](multilingual-production-audit.md)
for the original 13-language baseline.

## Content and routing

`packages/shared/src/i18n` owns the exact typed message contract, ICU catalogues,
lazy website loading, neutral error identifiers, product display helpers and
versioned legal documents. `next-intl` supplies the web context; backend email and
PDF renderers use the same messages through `use-intl`. There is no runtime
translation service, translation database, additional scheduled job or new service.

The full customer interface includes home, destination search, filters, plan
specifications, cart, checkout, promotions, authentication, account settings,
orders, installation, usage, help, guides, partnerships, consent, legal documents,
loading, errors and empty states. Known supplier descriptions and geographic plan
names are translated for display; original identifiers and unknown supplier
conditions remain intact. Translation never infers coverage or activation rules.

English retains its existing unprefixed URLs. `/en/...` redirects permanently to
English, preserving the query string. Other locales reuse the existing routes at
`/{locale}/...`. Switching languages preserves pathname, query, hash, cart, filled
checkout details and currency. API, Operations and internal routes are not localized;
prefixed versions return 404. Private customer pages remain noindex/no-store.

Public pages have native titles/descriptions, canonical links, all 21 hreflang
alternates, `x-default`, localized Open Graph metadata and sitemap entries. Product
structured data uses translated descriptions and labels with the exact original
SKU, amount and currency. Product and legacy checkout routes render request-specific
language; catalogue fetches retain their existing explicit data cache.
`/sitemap.xml` remains the public entry point and now indexes locale/page shards
at `/sitemaps/sitemap/{locale}-{page}.xml`, with at most 5,000 paths per shard.
This keeps all language alternatives and the existing catalogue within the
[sitemap protocol's URL and byte limits](https://www.sitemaps.org/protocol.html).

## Preference and currency independence

Selection priority is explicit choice/localized URL, saved account preference,
guest cookie, browser languages, then English. Functional cookies
`alozuri_locale` and `alozuri_locale_explicit` last 180 days. An authenticated
`PATCH /v2/profile/language` saves only the current user's validated locale.
Preference writes are serialized so an earlier request cannot replace a later
choice. No UID or role can be submitted through this endpoint.

Manual intent is captured before asynchronous dictionary loading, so account
responses cannot cancel a choice in progress. Login and logout retain the explicit
cookie; browser detection runs only when there is no usable preference. Automatic
locale navigation remains automatic, allowing a subsequently loaded account
preference to take priority. A newly requested localized URL (including `/en`
aliases and browser back/forward) is an explicit choice; navigation helpers retain
its requested language rather than replacing it with the current one. Picker
changes save the signed-in account preference; shared URLs update the browser
preference only. In-flight application navigation retains its intended destination
when an account preference arrives, so a language update cannot reopen login or
checkout’s previous step. No language decision uses IP location.

Language does not read or write currency state, alter exchange rates, reprice an
order, round money or change promotion calculations. The existing currency store,
detection and formatting utilities remain authoritative. Persisted order amounts
and currencies are used in all transaction documents.

## Arabic

The document receives `lang="ar" dir="rtl"`. Structural header controls, primary
columns, card grids and action groups explicitly retain their English order.
Arabic headings, labels, paragraphs and messages receive native RTL direction.
Technical references, emails, currency amounts, QR images and activation values
use isolated LTR runs. Native dates and translated plural forms use the selected
locale. Header controls retain the same 44-pixel height. Chat follows normal
flow on checkout, cart, private orders and account forms so it cannot obstruct actions.

## Legal content and transaction evidence

All seven current policies have complete versioned content in every language under
`i18n/policies/2026-11-16.1`. The current English policy version adds the actual
language-preference storage to privacy and cookie disclosures. The preceding
English master remains archived as `policies-v4.ts`; previous versions and existing
order evidence are not rewritten. Existing agreements, compatibility confirmation,
consumer rights and cancellation behaviour remain unchanged.

Tests pin the English source digest, every language's policy structure, original
links and all 147 legal text hashes. The 140 pre-existing hashes are preserved.
Changes to published wording require a new
version. `POLICY_TRANSLATION_REVIEW` explicitly records that professional legal
review has not been completed for the 20 translations. The release audit therefore
continues to exit nonzero for that review requirement, despite complete content.
An unavailable historical translation never silently substitutes English.

New purchases already record `locale` and a hashed legal snapshot. Rendering uses
that saved locale, never the current browser/account preference. Missing locale on
historical records means English; an invalid present locale or an order/legal
language mismatch is rejected. Stripe Elements receives the order locale, with
`zh-Hans` mapped to `zh` and `zh-Hant` to `zh-TW`. Hindi and Ukrainian use English inside Stripe's embedded
fields because the installed provider SDK does not support those two locales;
the Alozuri interface and return URL retain the order language. New Stripe payment
descriptions are localized while frozen historical attribution and idempotency
bodies remain intact. No payment amount or supplier ordering algorithm changes.

## Email and PDF

The complete confirmation template, subject, plan details, QR installation guidance,
manual activation labels, contractual information and policy text use the order
language. QR bytes, private links and activation identifiers are preserved. Ready
confirmations still wait for every eSIM's installation details. These are existing
order confirmations/contracts, not invented tax invoices. Existing payment/refund
status messages are translated; this work does not add a separate refund-mail flow.

The confirmation outbox keeps the established deterministic notification identity,
transactional lease, frozen rendered payload, payload hash, Resend idempotency key,
provider reconciliation and 23-hour ambiguous-send safeguard. Retries reuse the
frozen message; changing the template or profile does not change a queued message.
The template version is deliberately not bumped to trigger historical resends.

An authorized PDF download uses the same renderer in the browser and API. Complete
Inter, Arabic, regional CJK, Hindi and Thai fonts are self-hosted, with source hashes and OFL
licenses. Unicode bidi run layout handles Arabic shaping and mixed technical values.
Fonts load only on demand; normal storefront pages do not download the PDF fonts.
The larger CJK font pair is approximately 6–12 MB on first PDF use and is cached.
PDF generation retains the existing 5 MB output bound and creates no permanent file,
upload or new database record. Font failures can be retried.

## Errors, consent and internal inspection

Backend errors stay neutral with stable codes. The browser displays translated,
allowlisted messages and safe generic fallbacks, never raw provider diagnostics.
Existing advertising/support consent gates remain unchanged; language preference
is functional storage and does not grant marketing consent.

Verified administrators can inspect `/operations/languages`. Its protected
`/v1/operations/localization/preview` endpoint renders the actual email template with
synthetic order/QR data and all seven legal texts, without writing orders or sending
messages. Its sample label describes synthetic data, not an unfinished language.
Professional legal review is explicitly flagged here too.

## Checks

- `npm run test:i18n`: exact domains/keys, ICU variables, native plural categories,
  untranslated placeholders, directional-control masking, routes and display rules.
- `npm run i18n:check-release`: conservative customer JSX inventory and content gates;
  also reports professional legal review separately. Do not suppress findings.
- API document tests: every saved locale, original USD/GBP/EUR amounts, full policy
  structure/hashes, QR bytes, native subjects, frozen retries and actual PDFs.
- Browser localization/document tests: all locales, legal pages, native SEO, mobile
  email layouts, RTL structure, state preservation and browser PDF downloads.
- Firestore/Auth emulators: currency, checkout ownership, legal snapshots, webhook
  replay, fulfilment safety, confirmation retries and authenticated cart behaviour.
- `npm run test:stripe`: matching **test** keys and local Firestore only. Native
  sandbox cases simulate distinct clients through the existing proxy trust pattern;
  production rate limits are unchanged. No supplier is connected to this harness.
- `node --import tsx tests/seo-production.mts`: disposable production build/server,
  native crawlable HTML, canonical/hreflang, schema, sitemap and private-page headers.

A production release requires explicit deployment authorization and professional
review of translated legal documents. No automatic deployment is part of this work.

## Seven-language extension (17 November 2026)

The additional locales are `tr` (Türkçe), `ru` (Русский), `vi` (Tiếng Việt),
`id` (Bahasa Indonesia), `hi` (हिन्दी), `th` (ไทย), and `uk` (Українська).
They reuse the existing routes, functional preference cookies, account preference
API, catalogue keys, versioned policies and immutable order language. All seven
are left-to-right. Traditional Chinese was subsequently added as a separate locale
alongside Simplified Chinese; both remain independently selectable.

Stripe's installed Payment Element supports `tr`, `ru`, `vi`, `id` and `th`.
It does not support `hi` or `uk`: only its embedded payment fields fall back to
English; Alozuri's checkout, order language and currency remain unchanged.

The native globe select retains its existing 44px header control. Browser-native
scrolling and keyboard selection handle the 20 options without a wider header.
Hindi/Thai webfonts and extended Latin/Cyrillic webfont subsets are self-hosted
and requested by Unicode range. PDF fonts for Hindi and Thai are loaded only on
an authorised download, with their source commits, hashes and OFL licences.

Translations are machine-assisted with targeted engineering terminology and
structural checks. Independent native-speaker and professional legal review has
not been obtained. Passing key, ICU, identifier, rendering and payment tests is
not a claim of that review. There is no translation API, model, extra service or
new dependency in the deployed applications.

Deploy the matching backend before the frontend: older checkout/profile schemas
will reject the new locale values. This implementation does not deploy either
application or resend historical notifications.

## Traditional Chinese extension

`zh-Hant` (繁體中文) and `zh-Hans` (简体中文) are separate locale resources and
explicit URLs. Traditional Chinese appears immediately after Simplified Chinese
in every shared language selector. `zh-TW`, `zh-HK` and `zh-MO` browser preferences select Traditional
Chinese; `zh-CN`, `zh-SG` and generic `zh` select Simplified Chinese. Explicit
script tags take priority over a conflicting region. Existing manual, URL and
saved-account preferences continue to take priority over browser detection.

The Traditional Chinese catalogue starts from the existing Simplified Chinese
content, with character conversion followed by terminology and sentence edits
for customer, telecom, payment, privacy, refund and installation copy. It is not
an independent professional translation review. It uses terms such as 帳戶,
方案, 電子郵件地址 and 啟用, with iPhone menu alternatives for Taiwan and Hong Kong.
All seven policies and the existing transactional email/PDF flow are included.
Firebase authentication messages use `zh-TW`. PDFs use on-demand self-hosted
Noto Sans TC fonts; browser text prefers the device's Traditional Chinese fonts.
No new runtime dependency, service, database or schedule is introduced.
