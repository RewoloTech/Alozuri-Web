# Initial currency selection

Files: the country mapping is in `packages/shared/src/currency.ts` (exported through its package manifest), detection in `apps/web/src/app/api/currency/route.ts`, preference lifecycle in `currency-provider.tsx`, and first-price guards in the header, featured bundles, country offers, planner cards, product details, cart and checkout components. Runtime configuration is in `apps/web/apphosting.yaml` and `.env.example`. Regression coverage is in `packages/shared/test/currency.test.ts`, `tests/e2e/currency.spec.ts`, `playwright.config.ts` and `apps/api/test/commerce.firestore.mts`.

Alozuri keeps the existing header selector and `alozuri-currency` localStorage preference. A saved supported preference wins over geography. Changing the selector saves that preference. Automatic suggestions and failure fallbacks do not write it, so they cannot become permanent manual overrides. Destination selection never determines currency.

## Detection and privacy

The client root provider requests `/api/currency` once per mount, only when there is no valid saved preference. The root layout preserves it across normal client navigation. Reloads/new visits without a saved preference may detect again. Config and detection run concurrently, with a 2.5-second limit; failures fall back to USD without blocking shopping. Saved preferences still work when browser storage is available; blocked storage remains a usable in-memory selection for that page session.

The Next.js endpoint uses `CF-IPCountry` only with the server-only `CURRENCY_GEO_PROVIDER=cloudflare` setting and Cloudflare ray metadata. Cloudflare is already present in the live domain's response path. Enable [Cloudflare IP Geolocation](https://developers.cloudflare.com/network/ip-geolocation/) so the country header reaches App Hosting. `apps/web/apphosting.yaml` declares the runtime opt-in; `.env.example` documents the setting. No external geolocation request, paid service, GPS permission or tracking script is added. Neither the country nor IP address is persisted or returned: the response contains only an allowed currency.

Cloudflare overwrites its country header on proxied requests. Ray/header presence is not cryptographic origin authentication: a direct-origin caller may spoof a display suggestion. This is safe only because the country is advisory, equivalent to choosing a currency manually. It must never become evidence for identity, access control, taxes, sanctions, eligibility or authoritative prices. Existing server pricing and payment validation do not consume these headers.

The endpoint is dynamic and returns `Cache-Control: private, no-store, max-age=0`; the browser also uses `cache: no-store`. Public HTML/catalogue responses stay shared and unpersonalised. Currency-dependent visible prices use placeholders until client preference resolution, then existing server-priced currency responses. There is no USD-price flash or cross-visitor currency cache. Public structured Product/Offer metadata continues describing the base USD catalogue, independent of visitor preferences.

## Country policy

The explicit mapping lives in `packages/shared/src/currency.ts`.

- GBP: GB, JE, GG, IM.
- EUR: European sovereign countries, including non-EU countries such as Switzerland, Norway, Iceland, Moldova, Ukraine and the western Balkans. European territories AX, FO, GI and SJ also suggest EUR.
- Transcontinental/borderline retail policy: AM, AZ, CY, GE, KZ, RU and TR suggest EUR. This is a storefront preference, not a claim that these countries use the euro.
- Kosovo's commonly used XK code suggests EUR; XK is an explicit exception to officially assigned ISO 3166-1 alpha-2 codes.
- Overseas territories outside geographical Europe default to USD, including GL, GF, GP, MQ, RE, YT, AW, CW and FK. Other/unrecognised/missing codes and Cloudflare unknown/Tor values default to USD.

Every visitor can still manually choose any currency advertised by the API. An API advertising only USD restricts selection to USD as before; the production API supports USD, GBP and EUR. Config-fetch failures retain the currencies implemented by this storefront (USD only for demo), while purchasing still requires a successful server quote.

## Commerce

No supplier costs, markup, exchange rates, rounding or Stripe amount logic changed. The provider feeds the existing featured-bundle, country-plan, product, cart and checkout currency inputs. Cart items survive currency changes and are re-quoted. Checkout waits for initial resolution before mounting and locks the selector during an active payment as before. Stored orders, receipts and transactional emails continue using their immutable charged currency, regardless of later preferences.

## Verification and rollout

Unit tests cover country groups, transcontinental/territory policy, manual precedence, malformed headers, provider opt-in and response cache isolation. Browser tests cover first visits, returning preferences, desktop/mobile selector use, failed/delayed detection, no initial USD flash, destination independence, cart preservation and the selected checkout currency. Existing Firestore integration cases verify GBP/EUR quotes against Stripe intent amounts/currencies, signed-webhook reconciliation and immutable receipt amounts.

Verification on 11 November 2026: lint, application/test TypeScript and the production build passed. `npm test` passed 127 shared/API cases; `npm run test:firestore` passed 27 cases, including the added GBP/EUR contract-email snapshot check. The complete Playwright fixture suite passed 40 cases, with its separate Stripe case intentionally skipped. `STRIPE_TEST_CURRENCY=GBP npm run test:stripe` separately passed a real Stripe TEST Payment Element decline, retry and paid receipt in GBP, using local Firestore and locally simulated signed-webhook transport. No live charge, supplier order or real email was sent. GBP product summaries were visually reviewed at mobile/desktop widths, and overflow checks passed at 375/390/768/1440px. Initial browser test fixture issues (invalid regional metadata, development Strict Mode request counting and shared SSR fixture caching) were corrected before the passing full run.

Deploy the Next.js frontend to apply this feature; no API/pricing migration or live purchase is required. After deployment, verify `/api/currency` through `alozuri.com` from known regions, its no-store headers, manual override and a matching server quote. Verify failure/default behaviour on direct App Hosting domains. Cloudflare-to-App-Hosting country-header forwarding has not been verified on the deployed new endpoint until that rollout occurs. Static export cannot provide IP detection; use the existing server-backed App Hosting deployment.

The final `npm run test:cypress` run also passed all 13 cases. Changed-file formatting and `git diff --check` passed. No deployment was performed.
