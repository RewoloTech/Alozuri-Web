# Legal and customer-information review — 11 November 2026

This is a local editorial and presentation review, not a declaration of legal compliance or a production deployment. The existing unpublished `2026-11-11.3` draft is being consolidated; published versions `2026-11-11.1` and `2026-11-11.2` remain frozen. Existing customer orders and their legal snapshots were not rewritten.

## Before and after

Counts refer to sections and body words, including new steps and inventory cells but excluding headings and link labels. A help guide may become longer where practical instructions replace vague advice.

| Page           | Before → after                      | Improvement                                                                                                                                                                                                                                                                  |
| -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terms          | 36 → 18 sections; 1,711 → 981 words | Combined ordering/payment, installation, activation, allowances, coverage, customer responsibilities and liability. Retained eligibility, one-off pricing, delivery remedies, statutory cancellation, proportionate suspension, governing law and existing-order protection. |
| Privacy        | 15 → 9 sections; 941 → 722 words    | Grouped data categories, purposes/lawful bases, recipients, support, transfers, retention and rights. Kept relevant provider identities without an application architecture inventory.                                                                                       |
| Cookies        | 9 → 5 sections; 482 → 468 words     | Added a captioned, keyboard-scrollable inventory with actual/possible storage, providers, purpose and measured or documented duration. Distinguished requested payment/security storage from optional chat.                                                                  |
| Refunds        | 15 → 9 sections; 827 → 642 words    | Separated before-supply requests, change-of-mind rights, installed/activated plans, delivery failures, faults, duplicates and refund processing. Included usable cancellation wording; no automatic QR/installation waiver or blanket no-refund rule.                        |
| Compatibility  | 7 → 8 sections; 338 → 476 words     | Added numbered iPhone and Android steps, carrier checks, arrival/roaming settings and troubleshooting, with manufacturer links. No unsupported universal device list or transfer guarantee.                                                                                  |
| Acceptable use | 5 → 4 sections; 241 → 159 words     | Kept lawful use, fixed/daily/unlimited distinctions, conditional hotspot support, coverage limits and proportionate restrictions with consumer remedies.                                                                                                                     |
| Contact        | 5 → 5 sections; 240 → 290 words     | Added practical enquiry details, an email/post complaints process and review route, accessible communication help and independent guidance. No invented phone number, support hours, ADR membership or regulatory exemption.                                                 |

Footer links are now grouped under **Legal** and **Help & Support**, alongside Explore. Existing policy, account, registration, destination and help URLs remain available. Cookie settings stays accessible in the footer. All seven legacy `/legal/{slug}` redirects are tested.

## Consistency and checkout audit

- The compatibility checkbox remains initially unchecked. The concise order-placement notice and its policy links remain unchanged.
- Checkout does not collect a new early-supply request or cancellation-loss acknowledgement. Current order snapshots retain `immediateSupplyRequested: false` and `cancellationAcknowledged: false`. The rewritten copy does not treat payment, QR delivery, installation or activation as a waiver.
- The site supplies paid orders promptly through its existing process. The copy does not claim customers have requested a legally effective early-supply exception or that a proportionate cancellation deduction is automatically available.
- Contract confirmation remains required before fulfilment proceeds. The emulator regression verifies immutable text, private owner access and the confirmation gate. Only its assertion about the cancellation-form heading was updated to check the actual cancellation statement instead.
- Faults, failed supply and misleading descriptions retain applicable remedies. Refunds use the original method unless otherwise lawfully agreed; a pending refund is not described as completed. No automatic refund logic was changed.
- Plan validity follows the selected product; there is no promise of universal delayed activation, top-ups, reinstallation, hotspot availability or unrestricted full-speed unlimited data.
- Historical policy object hashes remain unchanged. The existing pending version-two/current notice compatibility and version-one affirmative evidence handling were preserved; no additional evidence flags or waivers were introduced in this task.

## Supplier verification

An authorised, read-only eSIM Access catalogue request returned 3,283 supported records. No supplier order, payment or database write was made by the audit.

| Observed product class                    | Records |
| ----------------------------------------- | ------: |
| Fixed total allowance                     |   1,809 |
| Daily allowance followed by reduced speed |   1,466 |
| Daily cutoff                              |       0 |
| Explicitly unlimited                      |       8 |

Representative fixed, daily-reduced and unlimited product descriptions matched the current public product API for name, allowance, validity, data type, daily policy, activation, fair-use information, networks and country coverage. The cutoff wording is conditional and does not advertise a currently available cutoff product. Activation values were 1 (64 records), 2 (3,206) and 3 (13). The existing adapter distinguishes installation, first network connection and purchase-triggered validity; this review did not alter that mapping.

The official supplier documentation describes installation/first-connection activation and fixed/daily-reduced/daily-cutoff/daily-unlimited types. The currently returned purchase-triggered value 3 needs explicit supplier-contract/documentation confirmation before relying on its interpretation; this is recorded as a supplier question rather than changing operational behaviour in an editorial task. Supplier-wide installation deadlines, reinstall/transfer rights and wholesale cancellation conditions were not supplied as verified contractual terms, so no universal restrictions were invented.

Sources: [supplier API documentation](https://docs.esimaccess.com/), [supplier day-pass overview](https://esimaccess.com/docs/unlimited-day-pass-plans-esimaccess/). Manufacturer instructions were checked against [Apple](https://support.apple.com/en-gb/118227), [Google Pixel](https://support.google.com/pixelphone/answer/16115470) and [Samsung](https://www.samsung.com/uk/support/mobile-devices/how-to-use-an-esim-with-your-galaxy-phone/).

## Actual storage and network evidence

The production browser audit used a fresh anonymous context and recorded only hostnames, cookie names/attributes and storage identifiers, never values, private links, passwords or payment credentials.

- Before a choice: no cookies; `alozuri-cart` local storage; `firebaseLocalStorageDb` and `firebase-heartbeat-database` browser databases. No Tawk or separate audience/advertising request was observed.
- After rejection: `alozuri_consent` was saved; optional chat remained unloaded.
- After acceptance but before opening chat: no Tawk request or frame.
- Opening allowed chat created its frame and contacted Tawk plus `static.cloudflareinsights.com`. That provider-side analytics/security processing is now distinguished from Alozuri's own tools, rather than making a blanket “no analytics anywhere” claim.
- Withdrawal removed the chat frame. A Tawk cleanup/in-flight request was observed while closing; this is not represented as retroactive deletion of provider-held information. Automated tests also verify rejection/reload, withdrawal and no unsolicited provider loading.
- A real Stripe **test-mode** Payment Element session observed `__cf_bm` on `.hcaptcha.com`, approximately 1,800 seconds remaining. The inventory names it as payment-security challenge storage. No claim is made that it appears for every visitor.
- `__stripe_mid` and `__stripe_sid` are included as Stripe-documented possibilities, not cookies observed in that particular test browser. Their documented durations are one year and 30 minutes. The cookie inventory expressly varies by feature, browser and provider.
- Exact Tawk storage lifetimes were not established. None was invented. Firebase diagnostic storage exists before sign-in; the installed library bounds dated heartbeat records, but the database itself has no fixed automatic expiry. The public copy does not invent a 30-day database expiry.

The Stripe test seeds a session cookie preference for the test runner; its session expiry is not evidence against the production preference control's 180-day maximum. Production preference expiry is set by the application control.

Sources: [Stripe cookie policy](https://stripe.com/legal/cookies-policy), [Stripe cookie settings](https://stripe.com/cookie-settings), [Tawk privacy](https://www.tawk.to/privacy-policy/), [Tawk service providers](https://www.tawk.to/data-protection/sub-processors/), [Cloudflare cookie information](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/). Local implementation evidence includes Firebase's installed heartbeat/storage code and the existing privacy provider. See [redacted QA evidence](legal-policy-qa-evidence.json).

## Ofcom investigation and owner-confirmed facts

The owner confirmed that Alozuri is a UK reseller of prepaid, data-only international eSIMs from eSIM Access; it does not own infrastructure, issue phone numbers or provide traditional voice/SMS. The owner also confirmed **no CISAS/Communications Ombudsman membership and no dedicated complaints telephone number**. The instructed complaints channels remain `support@alozuri.com` and the registered postal address.

Ofcom's current C4 scope concerns providers of public electronic communications services to relevant consumer/small-business customers; it is not limited to businesses owning a network or providing voice. Whether Alozuri's contractual and territorial model falls within it needs qualified confirmation. The site does not claim an exemption or membership.

If C4 applies, relevant requirements include an approved ADR arrangement, the required accessible complaint channels and a complaints code. Current guidance uses **six weeks** or earlier deadlock for eligible unresolved complaints, following the 8 April 2026 change. These conditional requirements have not been invented as Alozuri promises, replaced with an eight-week rule or implemented as new business procedures without an applicability decision. The contact page gives a practical complaint/review route and links neutral independent guidance.

Sources: [current Ofcom General Conditions](https://www.ofcom.org.uk/phones-and-broadband/accessibility/general-conditions-of-entitlement), [current consolidated conditions, C4 and Annex](https://www.ofcom.org.uk/siteassets/resources/documents/phones-telecoms-and-internet/information-for-industry/general-authorisation-regime/general-conditions-of-entitlement---unofficial-consolidate-version.pdf?v=415458), [current ADR guidance](https://www.ofcom.org.uk/phones-and-broadband/service-quality/adr-schemes).

## Outstanding review items

1. **Ofcom/C4:** obtain a qualified assessment of the actual supplier/customer contracts, UK service availability and sales model. If in scope, confirm the required membership, channels and complaints code before claiming compliance. Email/post copy alone is not certified as satisfying C4.
2. **eSIM classification and early supply:** confirm how each supply is legally classified and how prompt provisioning fits cancellation obligations when no express early-supply/cancellation-loss evidence is collected. Do not deduct for use or deny cancellation solely because an eSIM was delivered or installed. Existing statutory handling was not changed.
3. **Supplier terms:** confirm activation type 3, installation windows, reinstalls, transfers and any product-specific hotspot/fair-use restrictions. The API feed is not a complete reseller agreement.
4. **Privacy contracts/transfers/retention:** verify processor agreements, international-transfer mechanisms and actual operational deletion/retention procedures. Policy wording does not prove those arrangements exist.
5. **Browser diagnostics and provider analytics:** assess whether pre-sign-in Firebase diagnostic storage meets the relevant storage/access exemption and whether the existing optional-support notice/choice adequately covers chat-provider analytics. Notice copy was clarified; consent records, versions and logic were not silently changed. Any necessary consent or processing change is a separate scoped decision.
6. **Tawk storage:** complete representative device/provider cookie testing or obtain an authoritative inventory if exact names and lifetimes are required beyond the current qualified disclosure.

## Files and verification

Editorial/presentation changes: `packages/shared/src/policies.ts`, `apps/web/src/components/legal-document.tsx`, `footer.tsx`, `privacy-provider.tsx`, and `apps/web/src/app/globals.css`. Regression/evidence changes: `packages/shared/test/privacy.test.ts`, `apps/api/test/legal.test.ts`, `commerce.firestore.mts`, `tests/e2e/privacy.spec.ts` and `stripe-sdk.spec.ts`. This report, its redacted evidence and the compliance log record the review. Earlier local country-flag and release changes were preserved.

The separate country-duplicate follow-up adds canonical display deduplication in the shared country helper, country API, destination directory, picker and server catalogue reader. The live list contained 205 entries and only one alias duplicate group: `CW`/`AN` for Curaçao. It yields 204 displayed destinations while retaining supplier coverage and purchase identifiers. Distinct countries with similar names are not merged. This follow-up is also local.

Recorded verification:

- `npm test`: **123 passed** (29 shared, 94 API), including archive hashes, country deduplication and current/previous notice snapshots.
- `npm run test:firestore`: **26 passed** after updating the contract-email regression to recognise the revised cancellation statement. No confirmation/fulfilment behaviour changed.
- Full `npm run test:e2e`: **25 passed**, with the separate real-Stripe case intentionally skipped. Includes policy routes/redirects, headings, links, metadata, grouped footer navigation, cookie controls and country deduplication.
- `npm run test:cypress`: **13 passed**.
- Separate `npm run test:stripe`: **one real Stripe TEST Payment Element decline/retry case passed**, with locally simulated signed webhook transport and no supplier issuance. Cookie evidence was captured without values.
- Final focused policy-layout check passed after visual review corrected missing CSS list numbering. It verifies table keyboard scrolling, focus restoration and 375/390/768/1440 px overflow behaviour. Desktop footer and mobile installation/table screenshots were reviewed.
- Application/test TypeScript, lint, changed-file formatting, production build and Git diff checks passed. Historic plain-text output was also compared against the original formatter and is identical for all archived documents.

No production deployment, live customer payment, supplier purchase or database migration is part of this review.
