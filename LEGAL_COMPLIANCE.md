# Alozuri legal, privacy and search implementation

Review date: 11 November 2026. Current policy version: `2026-11-11.2`; version `2026-11-11.1` is frozen in the archive.

**Status: implemented locally, subject to legal and operational review. No deployment, production pricing migration, live charge or supplier purchase was performed for this task. This document is not a legal opinion or certification of compliance.**

## Identity and public documents

The operator supplied by the business is Rewolo Technologies Ltd (16297656), registered in England and Wales, 124–128 City Road, London, EC1V 2NX, United Kingdom, trading as Alozuri; contact support@alozuri.com. No VAT number, ICO registration number, telephone number, ADR membership or regulatory accreditation has been invented.

The seven canonical routes are `/terms`, `/privacy`, `/cookies`, `/refund-policy`, `/esim-compatibility`, `/acceptable-use` and `/contact`. The terms have 36 sections. Acceptable Use also addresses fair usage and network coverage. All documents have company identity, effective date, version, internal links and accessible headings. Existing `/legal/terms`, `/legal/privacy` and `/legal/refunds` redirect permanently to their replacements; unknown legal slugs return 404. Footer links remain available across the site.

`packages/shared/src/legal.ts` centralises identity and acceptance statements; `policies.ts` contains the actual documents. Each new checkout snapshots the full terms, refund policy and the concise order-placement notice on the server, with server time and version. New checkouts do not record express early-supply requests or cancellation-loss acknowledgements. `/legal/versions/{version}/{slug}` provides public archived documents, excluded from search. Version-one text is frozen in `packages/shared/src/policies-v1.ts`. The authenticated/private order view offers a downloadable plaintext contract. Legacy orders are not backfilled with fictional acceptance evidence.

When changing legal terms, preserve the old version's complete text in `POLICY_VERSIONS`, add a new version/effective date and review checkout wording. Do not mutate an archived version. Existing purchases retain their own immutable snapshot independently of the public archive.

## Actual processing audit

| Area                | Observed implementation                                                                                           | Privacy implications                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts            | Firebase Authentication: password and Google sign-in; persistent client auth storage                              | Necessary sign-in storage; server verifies protected API requests. Guest checkout remains available.                                                                                                        |
| Hosting/database    | Next.js/Firebase App Hosting; Firestore read-only configuration inspection reports `europe-west4`                 | Netherlands location does not establish that every processor/backup/authentication service is EU-only.                                                                                                      |
| Payments            | Stripe Payment Element and eligible Express Checkout wallets, lazily loaded on requested checkout                 | Card details handled by Stripe; backend retains payment references, amount/currency and status, not raw card data.                                                                                          |
| Supplier            | eSIM Access: catalogue, account capacity, provisioning and usage                                                  | Current supplier order sends package identifiers/count and transaction ID, not customer email/card details. Activation credentials remain private.                                                          |
| Transactional email | Resend, configured delivery sender esim@alozuri.com                                                               | Confirmation includes durable contract text; installation email contains a private access link. Provider acceptance is not proof of inbox delivery.                                                         |
| Incoming email      | DNS MX inspection resolves `mx.zoho.eu`, `mx2.zoho.eu`, `mx3.zoho.eu`                                             | The privacy policy includes Zoho EU incoming mail; no Zoho API SDK integration is assumed. Individual mailbox operation was not tested.                                                                     |
| Customer chat       | Optional Tawk.to chat, opened explicitly in an isolated third-party frame                                         | Tawk code is confined to its separate-origin sandboxed frame. No automatic profile/email/order-token/QR transfer; no referrer or parent-page access.                                                        |
| Analytics/ads       | Firebase measurement ID is configurable, but no Analytics initialization, Google tags or advertising pixels found | No analytics/advertising cookies or Google Consent Mode implementation falsely claimed. Any future tags require a new consent audit before loading.                                                         |
| Assets              | Former Google Fonts CSS and Unsplash image requests now self-hosted                                               | Ordinary browsing no longer contacts those asset domains. Font licences and sources are included in `apps/web/public`.                                                                                      |
| Logs                | Read-only Cloud Logging inspection: `_Default` 30 days, `_Required` 400 days                                      | Policy names these observed values; third-party retention needs contract/dashboard verification. Application error logs must continue to exclude tokens, QR strings, card data and full provider responses. |
| Cloudflare          | No repo-managed Cloudflare configuration found; observed DNS uses registrar name servers                          | Actual CDN/bot preference/account settings cannot be certified from the repository. No invented Cloudflare cookie inventory.                                                                                |

Public catalogue, JSON-LD and sitemap responses use explicit public projections; neither supplier cost nor internal wholesale identifiers belong there. The sitemap API emits only public package IDs and sync dates. Existing Firestore rules deny direct client reads/writes; server APIs authorise owner or private guest-token access. Email links use a fragment token, consumed/removed by the private order UI; API access uses the existing access header. Do not paste private links into search tools, chat or support tickets.

## Cookie/storage controls

The necessary `alozuri_consent` cookie records version, timestamp and an explicit support preference for 180 days. It is SameSite=Lax, Secure on HTTPS, scoped to this host and readable by the first-party preference UI. Invalid, outdated, future-dated and expired choices fail closed. Necessary basket, authentication, currency and order-session storage remains usable after optional rejection.

The initial banner offers Accept all, Reject optional and Customise choices without preselected optional consent. The native modal supports keyboard dismissal and focus restoration. Footer Cookie settings is always available; preferences are rechecked on focus and periodically for expiry. No optional provider request occurs merely because a customer accepts support; an additional explicit action opens the provider frame. Withdrawal removes the frame immediately and restores the permission prompt. Data previously submitted to Tawk requires that provider's controls.

Chat uses a sandboxed cross-origin frame: embedding the provider script directly into an account/checkout origin would instead give it access to page content and browser storage. The corner launcher is labelled Chat; the panel is compact on desktop and full screen on mobile. Help remains available in the footer. The public Cookie Policy inventories actual first-party storage names and Stripe's documented `__stripe_mid` (one year) and `__stripe_sid` (30 minutes), noting browser/configuration differences. Exact Tawk-frame cookie lifetimes were not established and are not invented. No marketing category is presented when no marketing technology exists.

## Contract, cancellation and checkout

An eSIM purchase may include connectivity services and a digital profile. The code and policies do not decide that every QR code is legally digital content. A UK solicitor must assess the actual contractual supply, territorial obligations and any telecommunications regulation. The conditional acknowledgement preserves the distinction:

- Digital-content cancellation may end only where the applicable prior express consent, acknowledgement and confirmation requirements are fulfilled and supply begins.
- Early service performance can involve proportionate charges on cancellation; complete loss of the service cancellation right requires the applicable full-performance conditions.
- Faulty/misdescribed products and non-excludable statutory rights are never waived by a checkbox, QR email or installation.

Before starting payment, the customer must tick the initially unchecked device-compatibility box. The three additional declaration checkboxes have been removed at the business's request. A concise notice links Terms & Conditions, Refund Policy, Privacy Policy and eSIM Compatibility Requirements, and remains visible beside the payment flow, including wallets. No optional cookie permission is inferred from order placement.

New requests use version `2026-11-11.2`, method `order_placement`, and acknowledgement that the notice was presented. The server records `immediateSupplyRequested: false`, `cancellationAcknowledged: false` and empty request/acknowledgement text; it must not pretend that a removed checkbox was ticked. Accordingly, the business must not rely on an express-consent cancellation exception for these new orders. Mandatory cancellation/remedy rights remain preserved; solicitor review of the supply classification is still required. This is a deliberate business change from the first draft, not an automatic waiver. Already-open version-one checkouts remain accepted only with their actual three affirmative flags and use the frozen version-one text; missing/negative declarations are not fabricated or accepted.

The existing server quote remains authoritative. Allowance, duration, activation, coverage, fair-use information, quantities, currency and final total are shown before payment. Confirmation contains the paid amount/currency, product specifications, operator/contact details, cancellation notice, order-placement notice and full terms/refund text. The real payment button retains explicit payment wording.

For new legal-version live purchases, verified payment queues a durable contract email. Its provider message ID and accepted-send timestamp are stored. A fulfilment claim is blocked until that confirmation succeeds; temporary email failure leaves the paid order recoverable and retries instead of provisioning early. The scheduled worker now calls notifications before and after allocation. Separate order/kind idempotency keys prevent a confirmation from suppressing its installation email. Legacy fulfilment is retained; test-mode payments never order real supplier stock or send real delivery emails. Provider acceptance cannot guarantee inbox delivery; support must investigate bounces and incorrect addresses.

## Security audit and controls

Retained controls include strict Zod input validation, API rate limiting, verified Firebase identity, ownership checks, signed Stripe webhook verification, webhook replay protection, atomic per-unit fulfilment claims, reconciliation of unknown supplier outcomes, server-only credentials and authoritative money calculations. Integration tests exercise the affected boundaries; this is not a penetration-test claim.

Added browser headers provide nosniff, frame denial, baseline CSP (`base-uri`, `object-src`, `frame-ancestors`), restricted camera/microphone/geolocation and production HSTS. This is **not** a nonce-based strict script CSP; a stricter deployment policy needs coordinated Stripe/Firebase testing. Private routes have noindex/noarchive, no-referrer and private/no-store headers. These headers are configured for Next.js App Hosting; static export does not implement dynamic headers/server metadata and is not the reviewed deployment target.

Privacy rights currently use a real contact route/email workflow; no automatic account erasure or retention purge was added. Support must verify identity proportionately, inventory Firebase Auth/Firestore/Stripe/Resend/Zoho/Tawk records, respond within applicable deadlines, export securely, and erase/anonymise unnecessary data while preserving lawful accounting/legal-hold records. Do not implement blind deletion of paid orders. An operational owner, processor-specific retention schedule and tested rights-request runbook are still required. Mailbox delivery/monitoring and processor account access must be verified by the business.

## Search and public information

Public routes use Next.js metadata, unique titles/descriptions, canonical URLs and Open Graph/Twitter assets. Legal pages are deliberately indexable in live production; test/demo builds remain excluded. Root Organization/WebSite JSON-LD contains supplied company identity only. Verified real product pages render public data server-side and output Product/Offer and BreadcrumbList JSON-LD with the server USD price; no invented reviews, stock guarantees or returns-schema promises. JSON-LD escapes `<`; public server props exclude internal supplier data. Country pages server-render verified local offers and retain the existing interactive planner.

`robots.txt` permits public crawlers on the live production domain, including Google/Bing/AI discovery; private/auth/checkout/cart and legal archives are excluded. XML sitemap includes public documents, verified country pages and active public package IDs. Filter-query pages receive noindex/follow and canonical base paths, avoiding duplicate filter listings. Public pages do not invent hreflang: the storefront currently supplies one English locale. Confirmed missing product API responses and malformed identifiers produce 404; transient catalogue failures retain a recoverable unavailable state rather than claiming nonexistent inventory.

Search ownership configuration is optional `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` (server environment placeholders). The actual tokens must come from their respective search consoles. No ownership or ranking claim is made. Deploy the API sitemap endpoint before the frontend, or the older backend will produce no product entries until the cached sitemap refreshes. Public catalogue fetch caching is five minutes; sitemap also uses those revalidation dependencies. Payment always revalidates independently of search-display caches.

Cloudflare account checks before rollout: allow Googlebot/Bingbot/public product discovery; reconcile Bot Preference Sync/managed robots directives with the application robots file; ensure robots/sitemap have no challenge; keep authentication and API protections. Public crawling does not authorise account, order or activation access. These account settings were not changed or verified here.

## Business/solicitor review before publication

1. Classify the actual eSIM supply and confirm Consumer Contracts Regulations, Consumer Rights Act and applicable telecom/Ofcom/ADR/international obligations. Check the actual supply contract and the absence of an express early-supply/cancellation-loss request in the simplified checkout. Do not assert QR delivery alone extinguishes rights.
2. Obtain supplier-specific installation windows, reinstallation/device-transfer/hotspot restrictions, activation/expiry rules, unlimited/FUP thresholds, network responsibility, cancellation and refund support. Publish only verified plan data; generic supplier text must not contradict mandatory rights.
3. Review VAT/place-of-supply treatment and registration obligations. Existing quotes report `taxCents: 0`; this task does not establish a tax exemption or implement a new tax engine. Accountant review is required for the territories sold into.
4. Confirm processor DPAs, controller/processor roles, restricted-transfer safeguards, subprocessor locations, retention and deletion abilities. Netherlands hosting does not settle international-transfer compliance. Confirm whether an ICO fee/registration is required.
5. Assign a rights-request/complaints owner, monitor support@alozuri.com, set real internal response/retention procedures, and verify accounting retention criteria. No unsupported response-time/ADR accreditation promise is published.
6. Verify Resend domain/sender and live confirmation/bounce operation, actual supplier fulfilment and delivery email. No real customer charge or eSIM purchase was made by this implementation task.
7. Confirm actual checkout domains are registered in Stripe; authorise Apple Pay/Google Pay on eligible real devices/browsers. Mock wallet visibility and card sandbox tests are not actual wallet authorisation.
8. Verify Search Console/Bing ownership, external crawler access/CDN settings and measured Core Web Vitals after a reviewed release. No Lighthouse/field-performance certification is claimed.

## Verification

See `docs/testing.md` for the commands and observed results for this release. Browser tests cover all seven documents, legacy redirects, version/canonical data, private indexing headers, safe public JSON-LD, server-rendered local offers, cookie rejection/acceptance/withdrawal/expiry, keyboard focus and 375/390/768/1440px overflow. Commerce tests cover strict legal acknowledgement, snapshots, confirmation-email failure/retry gating, ownership, duplicate payment/fulfilment handling and historical currency consistency. Remaining live verification is listed above rather than represented as completed.

## Primary references reviewed

- [ICO: storage and access technologies guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/) (updated April 2026).
- [Consumer Contracts Regulations 2013, regulation 37](https://www.legislation.gov.uk/uksi/2013/3134/regulation/37/made/data.htm); also review regulations 16 and 36 for confirmation and services.
- [GOV.UK: online and distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses).
- [Consumer Rights Act 2015](https://www.legislation.gov.uk/ukpga/2015/15/enacted).
- [GOV.UK: company identity disclosures](https://www.gov.uk/running-a-limited-company/signs-stationery-and-promotional-material).
- [GOV.UK: company accounting records](https://www.gov.uk/running-a-limited-company/company-and-accounting-records).
- [ICO: international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/).
- [Firebase: authentication persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).
- [Stripe: cookies](https://stripe.com/legal/cookies-policy).
- [Tawk: hosted chat link format](https://help.tawk.to/article/where-can-i-find-the-property-and-widget-id).

## Store transport follow-up

The browser no longer sends a JSON Content-Type on bodyless GET requests, avoiding unnecessary CORS preflights. A network-level failure can fall back to the same-origin `/api/store/...` transport; ordinary API errors and intentional search aborts are not retried. Backend validation, owner/guest-token checks and server pricing remain authoritative. The fallback has a fixed configured upstream, an operation/method allowlist, same-origin checks, a 64 KiB body limit, a timeout, redirect refusal and no caching. It forwards only user authorization/guest-access headers, not website cookies, provider/service credentials or client-supplied proxy-address headers. Checkout request IDs and cart merge/version fields remain unchanged across a fallback. Server-proxied requests share server egress for upstream rate limiting; direct browser requests remain the normal path. This requires Next.js App Hosting/server runtime; legacy static export does not provide the fallback.

Read-only browser checks reached the live catalogue/configuration and a valid cart quote successfully during this investigation. A persistent live API outage was not reproduced. Automated tests deliberately block browser-to-API traffic and verify plan addition, cart pricing and checkout pricing through the fallback; this does not establish the cause of every customer-side network interruption. Deploy the updated API before the frontend: the new notice format needs the updated backend. The API also accepts the strict previous format during this transition. No deployment was performed by this task.
