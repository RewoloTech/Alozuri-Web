# Additional languages implementation audit

Verified locally on 17 November 2026 against the existing 13-language baseline
at commit `93ac560`. Neither application was deployed during this task.

## Coverage and implementation

The existing locale registry now enables 20 languages. The seven additions are
Turkish (`tr`), Russian (`ru`), Vietnamese (`vi`), Indonesian (`id`), Hindi (`hi`),
Thai (`th`) and Ukrainian (`uk`). All are left-to-right. `zh-Hans` remains the
only Chinese locale. Operations routes remain internal and in English.

Each new catalogue implements the existing 933-message contract: 6,531 additional
message values, including customer navigation, search, plans, cart, checkout,
promotions, authentication, account, usage, installation, guides, support,
consent, SEO, email and document labels. Existing lazy web loading and static
server renderers are reused. All 20 catalogues have exact keys and ICU arguments;
Russian and Ukrainian also require their native plural categories. Indonesian
uses six field-specific allowances for words shared with English, including
“Status”, “Total”, “Asia” and “Global”; these are native words, not missing copy.

Each new language includes all seven policies: 49 additional documents and 140
current policy documents in total. Existing English and the original 12
translations retain all 91 original policy digests. Company identifiers, links,
consumer rights, privacy choices, activation conditions and technical values
remain intact. Original order currency and amounts are used for emails and PDFs.
Frozen historical messages, legal evidence and order language are not rewritten.

Translations are machine-assisted, with targeted edits to payment, installation,
refund, privacy, telecom and prominent interface wording. Structural checks and
engineering review do not constitute independent native-speaker or professional
legal review. Neither review has been obtained. The existing release audit
continues to report that fact separately from content completeness and enabled
languages; no review gate has been bypassed or marked as approved.

The globe dropdown derives its 20 native labels from the existing registry. It
retains browser-native scrolling, keyboard selection and the 44px header control.
The existing explicit URL/manual choice, account preference, cookie, browser and
English fallback order is unchanged. Regional browser variants select the new
locales. Currency preferences, detection, conversion and pricing are unchanged.

Extended Latin/Cyrillic webfont subsets support Turkish, Vietnamese, Russian and
Ukrainian. Self-hosted Noto Sans Devanagari and Noto Sans Thai support Hindi and
Thai in both the browser and PDF renderer. Web subsets use Unicode ranges;
PDF font pairs load on demand. Source commits, hashes and OFL licences accompany
the files. Long headings wrap safely, and Hindi/Thai headings have appropriate
line spacing. No runtime translation API, new npm dependency, database, service
or scheduled job was added.

Native metadata, canonical URLs, `hreflang`, `x-default` and structured content
reuse the existing routing. A read-only catalogue check found 3,202 plans:
20 language versions would produce 64,040 product URLs alone, exceeding the
[50,000-URL sitemap limit](https://www.sitemaps.org/protocol.html).
`/sitemap.xml` therefore now indexes native Next.js sitemap shards at
`/sitemaps/sitemap/{locale}-{page}.xml`, with at most 5,000 paths per shard and
20 language alternatives plus `x-default` per entry. Existing public page URLs
and the sitemap entry point are preserved. Production tests check URL and byte
bounds, valid shards and missing-shard 404s.

Primary changes are in `packages/shared/src/i18n`, shared document fonts,
`apps/web/src/lib/localized-metadata.ts`, the sitemap helpers/routes, script font
assets, targeted CSS, and the existing localization/SEO/checkout test suites.
There are no payment amount, exchange rate, promotion, supplier ordering,
fulfilment, authentication permission or financial calculation changes.

## Automated verification

The following commands were executed successfully:

| Command                                                                                                   | Result                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                            | Passed                                                                                                    |
| `npm run typecheck`                                                                                       | Passed for all workspaces                                                                                 |
| `npm run typecheck:tests`                                                                                 | Passed                                                                                                    |
| `npm test`                                                                                                | 38 shared, 217 API and 17 internationalisation tests passed                                               |
| `npm run test:jest`                                                                                       | 27 passed                                                                                                 |
| `node --import tsx --test tests/unit/seo.test.ts`                                                         | 9 passed                                                                                                  |
| `npm run test:firestore` with Java 21                                                                     | 125 passed using local emulators                                                                          |
| `npm run test:stripe` with Java 21                                                                        | 20 passed using matching Stripe sandbox keys and local Firestore                                          |
| `I18N_ARTIFACT_DIR=/tmp/alozuri-20-documents npx tsx --test apps/api/test/multilingual-documents.test.ts` | 22 passed, including actual PDF rendering for all 20 order languages                                      |
| `node --import tsx tests/seo-production.mts`                                                              | Disposable production build/server passed all 20 locales, sitemap, robots, schema and private-page checks |
| `npm run build`                                                                                           | Web production build and API TypeScript/asset build passed                                                |
| Focused `prettier --check` and `git diff --check`                                                         | Passed                                                                                                    |

`npm run i18n:check-release` was executed and **exits nonzero**:
`contentComplete: true`, all 20 locale content checks ready, zero customer JSX
literals requiring extraction, and no untranslated placeholders. Its remaining
blocker is `professional_legal_review_required`. This is an outstanding review
requirement, not a passing release result.

Focused Playwright runs used the existing configured runner and disposable app:

- `localization.spec.ts`: all 20 home routes, native copy, country/guide/partner
  pages, metadata, forms, language URLs, private-route protection, browser detection,
  manual choice, currency independence and preference persistence. Every new
  locale was checked at 375, 390, 768 and 1440px with no horizontal overflow.
- `shopping.spec.ts`: all 20 languages preserve filled checkout details,
  compatibility confirmation, cart, currency and promotion input; every locale
  initiates guest payment with native validation. GBP/EUR quantity repricing
  matches the verified payment amount. Saved-language browser PDF downloads work
  for all 20 locales while the current site language is English.
- `cart-auth.spec.ts` with the Firebase Auth emulator: both targeted cases passed,
  covering a verified customer in all 20 account languages and manual English
  persisting through real login/logout and checkout navigation.
- `localized-documents.spec.ts`: complete legal pages, SEO alternatives and actual
  email templates in every language, on mobile and desktop.
- `stripe-sdk.spec.ts` through `npm run test:stripe`: 20 successful sandbox cases,
  including declined-card recovery with the existing PaymentIntent and completed
  payments for all 19 non-English saved order languages. The harness cannot order
  supplier eSIMs and did not make live charges or write production orders.

An initial Indonesian mobile heading overflow failed one browser assertion.
Its wording/wrapping was corrected, and the affected width checks passed on rerun.
Final homepage wording was checked again after editorial corrections. No unresolved
test failure is being treated as a pass.

## Manual review and remaining limits

Screenshots were inspected for all seven new desktop hero layouts and mobile
script/long-heading layouts. Hindi and Thai PDF pages were rendered to images
and inspected for readable script shaping and unclipped contractual information.
Font coverage, source metadata, original monetary symbols and document size bounds
were checked. Browser tests exercise the native selector and keyboard interaction;
no independent screen-reader audit or physical Android/iOS wallet test was run.

The installed Stripe Payment Element supports Turkish, Russian, Vietnamese,
Indonesian and Thai. It does **not** offer Hindi or Ukrainian: its embedded fields
use English for those two languages. Alozuri's checkout UI, saved order language,
return URL, email and documents remain in the customer's language and original
currency. This provider limitation is explicit rather than an unsupported locale
being passed to Stripe.

No existing customer top-up purchase route was found in this repository, so a
top-up purchase was **not run** and no new top-up flow was introduced. Existing
purchase, account, eSIM usage and installation routes retain their architecture.
Live supplier purchases, live payments and delivery to real customer inboxes were
not run for this language task.

Deploy the matching API **before** the frontend because the older backend locale
schema cannot accept the seven new values. Existing deployment commands remain
unchanged. Independent native-language and professional legal review remains
outstanding; no deployment, historical notification resend or account migration
has been performed.
