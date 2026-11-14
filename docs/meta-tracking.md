# Alozuri Meta tracking

Pixel / dataset: **1814512106538733**. No deployment or live Meta delivery is performed by the tests.

The root Next.js layout mounts one consent-aware tracking component. Next Script loads the supplied `fbevents.js` library once per document, after advertising permission. Do **not** paste another snippet into `<head>`, tag managers or the hosting template. There is no unconditional noscript beacon.

## Consent and events

The `2026-11-14.1` cookie choice adds a separate **Optional advertising — Meta** checkbox, default off. Old chat-only choices expire and are requested again. Accept all includes both categories; Enable chat enables only chat. Rejecting/withdrawing advertising prevents subsequent tracking calls; queued advertising hits are discarded when permission is withdrawn before the library loads. The previously downloaded library cannot be unloaded from JavaScript memory, but receives Meta's revoke command. Checkout works without tracking.

- **PageView:** initial eligible page and client navigation, including browser back/forward. Tracking is restricted to public storefront, information, product, cart and checkout routes. Operations, account and authentication routes are excluded. Unknown queries and URL fragments block tracking, avoiding private-link and reset-token leakage.
- **ViewContent:** a real available plan in the displayed currency. Value is the actual displayed selling price, with its public product ID. Once per plan visit; currency refreshes do not invent another view.
- **InitiateCheckout:** Stripe SDK loaded and the backend checkout session created successfully, after validation. Uses the backend quote's final total, including quantity and discounts. Retrying the same order does not produce another start.
- **Purchase:** only an authorised backend order with `paidAt`, `status: paid` (or paid orders needing fulfilment attention), live payment mode and a payment timestamp within the last 24 hours. Uses its actual charged total/currency. Success redirects, pending/failed payments and Stripe test payments do not count. Stripe return credentials are removed from the success URL after the private access fragment has been retained in session storage.

Amounts use existing integer minor units divided by 100 for the supported GBP, USD and EUR currencies. Explicit Purchase and checkout event IDs are SHA-256 hashes. Meta Pixel also receives page URLs; the confirmation URL retains its opaque order lookup ID (which does not authorise access), while access fragments and Stripe return credentials are removed before loading tracking. Browser storage plus an in-memory guard suppresses repeats/reloads in that browser. Browser storage clearing or using another browser removes that guard; event IDs remain identical. No changes were made to webhook processing, fulfilment or pricing.

## Optional server Purchase

`POST /api/marketing/purchase` runs in the **existing Next.js App Hosting server**, not a new service. It checks same-origin requests and the fresh advertising cookie, forwards only existing order-access or Firebase credentials to the existing API, and independently reads confirmed payment data. Browser-submitted amounts/statuses are never used. A Meta `_fbp` cookie is required for matching. Only the Meta browser identifier and user agent are sent as matching data: no email, IP, card details, installation credentials or supplier identifiers.

The endpoint is disabled without a private token **and** a supported configured Graph API version. It sends `Purchase` with the same `event_id` as the browser's `eventID`, so Meta can deduplicate browser/server delivery and repeated requests within its deduplication window. The 24-hour purchase eligibility window also prevents old order visits from resending conversions outside that window. Backend retries/webhook replays do not emit independent conversion events.

This is browser-triggered server verification, not a webhook marketing outbox: no cron, polling job or new Cloud Tasks queue is added. Purchases cannot be measured when customers refuse advertising, never return to the confirmation page, or block tracking. Network failures can lose measurement; they never interrupt payment or delivery. Do not interpret Meta totals as the accounting source of truth.

## Secret Manager setup (not yet activated)

Generate the Conversions API access token in the **Alozuri** dataset's Meta Events Manager settings. Save it to a temporary file outside the repository with restrictive permissions. Do not paste it into chat, Git, public env variables or shell command arguments.

```sh
gcloud secrets create alozuri-meta-capi-token --project alozuri --replication-policy automatic
gcloud secrets versions add alozuri-meta-capi-token --project alozuri --data-file /private/path/meta-token.txt
firebase apphosting:secrets:grantaccess alozuri-meta-capi-token --backend YOUR_BACKEND_ID --project alozuri
```

If the secret already exists, only add a new version. Delete the temporary file after successful import. Add the following entries to `apps/web/apphosting.yaml` **only after creating and granting the secret**:

```yaml
- variable: META_CONVERSIONS_API_TOKEN
  secret: alozuri-meta-capi-token
  availability:
    - RUNTIME
- variable: META_GRAPH_API_VERSION
  value: 'REPLACE_WITH_SUPPORTED_VERSION'
  availability:
    - RUNTIME
```

Choose an active Graph version (format `vNN.0`) shown in Meta's current developer settings/documentation; the integration deliberately does not guess a version. `META_TEST_EVENT_CODE` can optionally be set as a runtime-only value during Test Events verification. Never set a `NEXT_PUBLIC_` access token. Pixel tracking works without CAPI configuration.

## Automated checks

Run `npm run test:meta` for the focused consent, event, CAPI-boundary and browser tests. Run `npx playwright test tests/e2e/privacy.spec.ts` for the full consent dialog and policy layouts. Network tests mock Meta and payments.

## Verify in Meta Events Manager

1. Open Events Manager → dataset **1814512106538733** → Test Events. Confirm the dataset belongs to Alozuri and the intended domain. In dataset settings, turn **automatic events without code** and **automatic advanced matching** off; avoid additional tag-manager Pixel installations and URL-based Purchase rules. Code disables automatic configuration and never supplies email matching.
2. Open the site through the Test Events browser workflow (or use Meta Pixel Helper). Before permission, confirm DevTools Network has no `connect.facebook.net`/`facebook.com/tr` requests. Reject optional and confirm the same. Existing old chat-only consent must show the new choice.
3. Enable advertising only. Confirm one PageView, then navigate between storefront pages and confirm one per navigation. View a plan and check ViewContent's product ID, displayed value and uppercase currency. Open Cookie settings and withdraw advertising; confirm no further events.
4. Begin a checkout and verify one InitiateCheckout with the final backend quote amount. Retry payment/refresh the same checkout and check no additional initiation for that order. A decline or success URL alone must not produce Purchase.
5. For the next genuine successful live payment, confirm Purchase appears after backend payment confirmation with the exact charged total/currency and a stable `alozuri_…` event ID. Refresh the order and check there is no additional browser Purchase. **Stripe test payments are intentionally excluded**, even in Meta Test Events. Local automated tests use controlled fake paid responses and a mocked Meta library; they send no real events or payments.
6. If CAPI is configured, set the server Test Events code temporarily. Confirm Browser and Server Purchase share the identical name/ID and are deduplicated. Check Diagnostics, then remove the test code. Verify that a pending/unauthorised order and refused consent cannot produce a Server Purchase. Do not replay live payment webhooks solely to test advertising.

Delivery in the real Meta account, its domain configuration and a genuine live Purchase remain manual checks after an approved rollout. Meta documentation was rate-limited during implementation; browser conventions were cross-checked against Meta's official template source: https://github.com/meta/GoogleTagManager-WebTemplate-For-FacebookPixel. Server payload fields were also cross-checked against [Meta’s official Business SDK source](https://github.com/meta/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/event-request.js). Server API reference: https://developers.facebook.com/docs/marketing-api/conversions-api/.

## Local verification on 14 November 2026

- Workspace TypeScript checks, test TypeScript checks, ESLint and production web/API build passed.
- Shared unit suite: 38 passed. API unit suite: 181 passed. Focused Meta/consent unit and boundary checks: 9 passed.
- Shopping/privacy browser suite: 43 passed initially; the only failure was a hard-coded inventory row count, updated for the Meta disclosure. The five affected Meta/privacy scenarios then passed, including that corrected test. Consent layouts were checked at 375, 390, 768 and 1440px; desktop/mobile screenshots were inspected.
- The broader Jest run has two existing failures in `tests/jest/user-profiles.test.tsx`: its fake verified Firebase users have no `getIdTokenResult`. That test and `auth-provider.tsx` are unchanged. No auth implementation or unrelated test was altered for this integration.
- No deployment, live Meta event, real Stripe payment, secret creation or CAPI activation was performed. Real Events Manager delivery remains unverified.
