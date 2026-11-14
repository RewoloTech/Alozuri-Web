# Alozuri SEO, AI discovery and marketing readiness

Audit date: 13 November 2026 (Europe/London). Changes are implemented locally; **nothing has been deployed**. Operations remains administrator-only. No authentication permissions, pricing algorithms, checkout steps, supplier integration, fulfilment, financial calculations, databases, scheduled jobs or recurring subscriptions were changed.

## 1. What already worked

Live HTTP inspection found:

- Homepage, `/destinations/us`, `/destinations/gb`, `robots.txt` and `sitemap.xml` return HTTP 200. The public HTML contains index/follow metadata; no production-wide `X-Robots-Tag: noindex` was observed.
- The sitemap contained **3,399 unique URLs**: 3,185 plan URLs, 204 destination URLs and 10 other URLs. No duplicate URL entries were found in that sample.
- Public pages already use Next.js metadata, canonical URLs, Open Graph, Twitter cards, Organization/WebSite JSON-LD and some breadcrumbs. A real current product returns 200; a nonexistent plan returns 404. The 1200×630 brand-sharing image URL returns a PNG successfully.
- Country/product server loaders already use the existing public catalogue API, React request memoization and a five-minute Next fetch revalidation window. The sitemap has hourly revalidation. No direct Firestore access is added to public pages.
- Private customer/checkout pages have noindex metadata and private response headers. Operations had noindex metadata and protected server APIs, even though it was missing from the shared robots/header lists.
- Fonts are self-hosted with `font-display: swap`. Optional support chat is consent-gated. No Meta Pixel, Google Analytics initializer or Meta purchase-event implementation was found in the inspected source or initial live HTML.
- Google/Bing verification-token support already exists in root metadata and `.env.example`. Neither HTML verification tag was present live; **DNS verification may already exist**, and was not checked.

## 2. Problems found and improvements made

| Finding                                                                                                                        | Change                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/operations` missing from shared crawl exclusions and private HTTP-header rules                                               | Added it to robots and private headers, without changing administrator permissions. Internal API routes also receive noindex/private headers.                                                                                                                                          |
| Google/Bing/OpenAI search access depended on generic robots rules                                                              | Added explicit search-agent rules with the same private-path exclusions. Kept GPTBot training disallowed, consistent with the existing live Cloudflare policy.                                                                                                                         |
| Destination directory initially rendered an empty list, then fetched links in the browser                                      | Seeded the existing directory with cached server-fetched countries. Search and client refresh remain intact.                                                                                                                                                                           |
| Server had a real product price, but initial visible price was a dash while schema already advertised a price                  | Render the actual catalogue currency/price before currency initialization. Once a visitor chooses a currency, the existing API supplies the converted price; Product/Offer JSON-LD follows the displayed product state. Purchase validation and conversion calculations are unchanged. |
| Repeated destination introductions and no Europe landing page                                                                  | Added tailored advice/FAQs for US, GB, JP, TH, TR and AE; reused country-code routes. Added `/destinations/europe`, explicitly using France/Germany/Italy as an example itinerary rather than claiming all-Europe coverage.                                                            |
| Supplier networks/activation not easily visible in destination HTML                                                            | Added expandable supplier-backed details alongside selected plan cards. Unknown networks are explicitly described as not supplied.                                                                                                                                                     |
| No lightweight traveller guides hub                                                                                            | Added five focused static guides with support, policy and destination links. Linked the hub from the footer and help page.                                                                                                                                                             |
| Sitemap did not include new editorial pages                                                                                    | Added Europe, the guides hub and all five guides. Checkout/accounts/Operations remain excluded.                                                                                                                                                                                        |
| Search/social crawlers can receive streamed metadata after the head                                                            | Extended Next's existing HTML-limited-bot list to Googlebot, OAI-SearchBot and ChatGPT-User, keeping existing crawler entries. This gives these agents blocking metadata without disabling streaming for ordinary visitors.                                                            |
| Homepage title omitted the brand                                                                                               | Added Alozuri to the public homepage metadata title.                                                                                                                                                                                                                                   |
| Lighthouse found low-contrast labels/step numbers and featured-button accessible names that did not include their visible text | Darkened the affected text shades within the existing palette and changed accessible button names to start with the visible “View plan” wording. No visible action labels or purchasing logic changed.                                                                                 |
| Help page still said usage readings were unavailable                                                                           | Updated that sentence to match the existing supplier-backed account readings, with an explicit delay caveat.                                                                                                                                                                           |

Country routes stay `/destinations/us`, `/destinations/gb`, `/destinations/jp`, `/destinations/th`, `/destinations/tr`, `/destinations/ae`. No migration to long slugs or duplicate country pages was introduced. Canonicals remain lowercase and omit campaign/filter parameters. An uppercase country alias can be served from ISR with HTTP 200 and a lowercase canonical, or redirected when dynamically rendered; it is not advertised in the sitemap or internal links.

## 3. Pages and content

Updated: homepage metadata; destination directory; six priority country pages; existing product-page price/schema rendering; help page; footer navigation. Other country pages retain their existing routes and catalogue-driven content.

Created:

- `/destinations/europe`
- `/guides`
- `/guides/choose-usa-esim`
- `/guides/holiday-data-budget`
- `/guides/install-esim-before-travel`
- `/guides/avoid-roaming-charges`
- `/guides/esim-compatibility-activation`

The guides use practical checks and clearly labelled arithmetic examples, not promised data consumption, invented speeds or guaranteed savings. Device compatibility remains model/region/carrier dependent. Installation advice defers to each purchased plan's activation rule and the existing refund policy. No ratings, reviews, testimonials, availability labels or unsupported local phone numbers are invented.

Priority editorial destination pages remain useful and indexable through catalogue changes or a temporarily empty plan list. Missing products use the existing confirmed-404 path. Transient upstream failures do not fabricate products or prices. Displayed catalogue prices can be cached for five minutes; checkout remains the authoritative current-price validation.

## 4. Keyword and traveller-intent plan

These are **relevant candidates**, not verified search-volume or ranking claims.

| Origin / trip                    | Candidate intent                                                            | Landing page                                            |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| UK → USA                         | USA eSIM; USA eSIM 10GB; eSIM for USA travel                                | `/destinations/us` plus allowance filter for comparison |
| USA → UK                         | UK eSIM for tourists; UK eSIM for Americans                                 | `/destinations/gb`                                      |
| USA → several European countries | Europe multi-country eSIM; Europe eSIM 10GB                                 | `/destinations/europe`                                  |
| UK → Japan                       | Japan travel eSIM                                                           | `/destinations/jp`                                      |
| UK → Thailand                    | Thailand tourist eSIM                                                       | `/destinations/th`                                      |
| UK → Turkey / UAE                | Turkey travel eSIM; UAE travel eSIM                                         | `/destinations/tr`, `/destinations/ae`                  |
| Pre-purchase research            | eSIM vs international roaming; how to install an eSIM; how much data abroad | Relevant guide and compatibility/help page              |

Validation plan:

1. Verify the site in Search Console and Bing, submit the sitemap and inspect the priority URLs. Record a baseline before evaluating changes over subsequent weeks.
2. Use Search Console query/page/country/device reports to separate UK-origin USA searches from US-origin UK/Europe searches. Review impressions, clicks, CTR and the actual queries; don't infer demand from a keyword list.
3. Use Google Trends by origin market to compare relative interest and seasonality. Trends is not an absolute search-volume tool.
4. Use Keyword Planner's available location-specific estimates and advertising competition/CPC as commercial inputs. Advertising competition is not a direct organic-ranking difficulty score.
5. Review actual search results and commercial fit before expanding content. Evaluate qualified purchases, refunds and contribution—not only visits. Do not publish hundreds of near-duplicate destination articles.

## 5. Structured data and AI discovery

Organization/WebSite use the existing UK-company data and support contact, with a real brand-logo URL. Breadcrumbs are retained/added on the relevant public pages. Product/Offer data uses the actual plan name, allowance, validity, coverage, supplied networks, activation, visible price and currency. There is no fabricated stock status, rating, GTIN or delivery promise.

A new Product/Offer snippet generated from a real current public supplier-catalogue product was submitted to **Schema.org Validator: 0 errors, 0 warnings**. Production-build checks also parse JSON-LD and compare price/currency with rendered HTML; browser tests cover subsequent GBP/EUR/USD updates.

Google’s Rich Results Test was also attempted with that representative code snippet. It responded **“Something went wrong / Log in and try again”**, so no completed Google validation result is claimed. Re-run in an authorized browser, then validate the deployed page URLs. No account credentials were requested or used.

Google Merchant eligibility is **not established for Alozuri**. Google's [wireless listing guidance](https://support.google.com/merchants/answer/7390163) covers prepaid SIM cards and distinguishes SIM-only service contracts. That does not automatically confirm how digitally delivered eSIM data packages will be classified. Confirm eligibility and destination-market requirements in Merchant Center before introducing feeds, shipping claims or merchant-listing attributes. Schema.org validity is not Merchant Center approval or a rich-result guarantee.

[Official OpenAI documentation](https://developers.openai.com/api/docs/bots) distinguishes OAI-SearchBot discovery from GPTBot training. The new rules permit the search crawler on public pages and preserve the training opt-out. No `llms.txt` file or special AI-recommendation markup was added. [Google's AI-search guidance](https://developers.google.com/search/docs/appearance/ai-features) says normal SEO, readable content and matching structured data remain applicable; special AI files are not required.

The live robots response includes **Cloudflare-managed content signals and training-bot exclusions**, which application code cannot fully control. Local HTTP probes using Googlebot, Bingbot and OAI-SearchBot user-agent strings received 200 without a challenge. This **does not prove access from real crawler IPs**. A separate remote fetch tool could not access the site; its cause was not established. Check Cloudflare security events, verified-bot rules and managed robots after deployment, using the providers' published verification methods/IP ranges. Do not disable bot protection globally. Review `ai-input` separately from `ai-train` and preserve the chosen training policy. [Cloudflare's managed-robots documentation](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) explains that these are distinct signals.

## 6. Facebook/Instagram readiness and privacy

Sharing metadata and the existing brand OG image work independently of ad tracking. Destination pages have their own titles, descriptions and canonical links, so ads can land directly on the relevant country or Europe page.

Examples:

- UK audience → `https://alozuri.com/destinations/us?utm_source=facebook&utm_medium=paid_social&utm_campaign=uk_to_usa`
- US audience → `https://alozuri.com/destinations/gb?utm_source=instagram&utm_medium=paid_social&utm_campaign=us_to_uk`
- US multi-country audience → `/destinations/europe` with the same explicit campaign convention.

UTM parameters do not change the canonical URL. Campaign attribution is not persisted to an order. The later Meta integration adds consent-gated PageView, ViewContent, InitiateCheckout and server-confirmed Purchase, plus optional server-side Purchase verification in the existing Next.js server. Existing chat consent does not authorise advertising. See [Meta implementation and verification](meta-tracking.md) for exact eligibility, privacy limits, Secret Manager setup and the manual Events Manager checks required before purchase-optimised campaigns. No live Meta delivery or deployment is implied by this audit.

## 7. Performance and accessibility evidence

A **single mobile Lighthouse 13.6.0 lab run** against the existing live homepage at `2026-11-13T04:34:12.062Z` reported:

| Metric                 | Live pre-change sample |
| ---------------------- | ---------------------: |
| Performance score      |                    100 |
| Accessibility score    |                     96 |
| SEO audit score        |                    100 |
| FCP / LCP              |          1.0 s / 1.0 s |
| Total blocking time    |                  50 ms |
| CLS                    |                  0.024 |
| Document response time |                  60 ms |

These values are a simulated-mobile lab sample, affected by cache, network and location. The SEO score does not measure rankings or content strategy. TBT is **not INP**. Field INP and 75th-percentile Core Web Vitals were not established; use CrUX/Search Console where sufficient data exists. The PageSpeed public-page fetch was unavailable from the web-retrieval tool.

After targeted color/accessible-name fixes, Lighthouse against the **disposable local production build with a synthetic catalogue** reported **100 accessibility and 100 SEO**. This is not a second live-site performance measurement. Existing self-hosted fonts, image assets, caching and client functionality were retained; no speculative rendering rewrite or new runtime dependency was needed. The Lighthouse CLI was used as a temporary audit tool, not added to application dependencies.

## 8. Implementation files

- Crawl/metadata: `apps/web/src/lib/seo.ts`, `app/robots.ts`, `app/sitemap.ts`, `next.config.ts`, root `app/layout.tsx`, homepage metadata.
- Catalogue presentation: `lib/catalogue-server.ts`, `components/destination-directory.tsx`, `country-offers.tsx`, `plan-details.tsx`, `planner.tsx`, product/destination pages.
- Content: `lib/destination-content.ts`, `components/destination-advice.tsx`, new Europe page, `lib/guides.ts`, guide hub/detail pages, help/footer links.
- Schema: `lib/product-seo.ts` with Product/Offer generation tied to rendered product state; existing organization/breadcrumb helpers reused.
- Accessibility: targeted existing text colors in `app/globals.css`, accessible names in `components/featured-bundles.tsx`.
- Verification: `tests/unit/seo.test.ts`, `tests/fixtures/seo-api.ts`, `tests/e2e/seo.spec.ts`, `tests/seo-production.mts`; featured-button test name updated. One older privacy test expected superseded checkout wording; its assertion was updated to match the unchanged current UI.
- Reproducible command: root `package.json` adds `test:seo` without changing dependencies.
- Evidence: `docs/seo-audit-2026-11-13.json` and this report. Full temporary audit outputs and screenshots are under `/tmp`, not committed as large artifacts.

## 9. Verification and release checklist

Completed verification:

| Command / check                                                                                                                                 | Result                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:seo`                                                                                                                              | Passed: six unit checks, disposable production build, production HTML/metadata/schema/robots/sitemap/header/404 checks, and four browser scenarios. Fixture prices are never built into the working app or deployed.                |
| `npx playwright test tests/e2e/seo.spec.ts tests/e2e/privacy.spec.ts tests/e2e/currency.spec.ts tests/e2e/shopping.spec.ts` plus focused reruns | All 60 distinct scenarios passed after fixture-isolation/navigation assertions and the older checkout-copy assertion were corrected. The initial broad run had 56 passes and four failures; focused reruns resolved those failures. |
| `npx playwright test tests/e2e/featured.spec.ts`                                                                                                | Three passed, including the updated accessible button name and unchanged currency/cart flow.                                                                                                                                        |
| `npm run typecheck`, `npm run typecheck:tests`, `npm run lint`                                                                                  | Passed.                                                                                                                                                                                                                             |
| Prettier on changed files and `git diff --check`                                                                                                | Passed.                                                                                                                                                                                                                             |
| `SEO_LIGHTHOUSE=true node --import tsx tests/seo-production.mts`                                                                                | Passed; creates a disposable production instance and optionally runs the temporary Lighthouse audit.                                                                                                                                |
| Manual visual review                                                                                                                            | Guide screenshots inspected at 390px and desktop; browser layout checks exercised 375/390/768/1440px. Existing shopping tests also exercised cart/mobile controls and wallet fallback.                                              |
| Schema.org / Google Rich Results                                                                                                                | Schema.org representative product snippet: zero errors/warnings. Google submission attempted but required sign-in; no result claimed.                                                                                               |

`npm run test:seo` is the new reproducible package command; it requires only the existing development dependencies. Its production build uses a synthetic local catalogue in a temporary directory and is removed afterwards. Lighthouse is optional, not a runtime dependency.

No real payment, supplier order, customer email, external advertising event or production configuration change was performed.

Before release / manual external checks:

- [ ] Approve and deploy the frontend changes; no backend deployment, new index, secret, database or scheduled job is required for this SEO work.
- [ ] Confirm live public pages remain index/follow; private pages remain noindex/admin protected. Fetch the live sitemap and robots through Cloudflare after the rollout.
- [ ] Verify Search Console/Bing via DNS or the existing environment-token support. If using HTML tokens, make them available at build time and rebuild. Submit `/sitemap.xml` and inspect priority URLs. No indexing or ownership verification is claimed by this audit.
- [ ] Check Cloudflare managed robots, verified crawler traffic and WAF events; don't infer real crawler access from spoofed user-agent checks alone.
- [ ] Re-run Google Rich Results Test and Schema.org Validator on deployed URLs, including a representative GBP/EUR visit; distinguish markup validation from actual search-feature eligibility.
- [ ] Confirm Merchant Center classification before enabling shopping feeds or merchant-listing claims for digital eSIM products.
- [ ] Review the Meta account, marketing consent, attribution and event integration before running purchase-optimized ads. Use manual Events Manager checks for deduplication.
- [ ] Review Search Console/CrUX after enough traffic exists; record a genuine field-performance baseline.

There is no evidence here that Google/Bing have indexed these new pages, that Alozuri ranks for a candidate keyword, or that an AI search product recommends it. Those outcomes require external verification and ongoing measurement.
