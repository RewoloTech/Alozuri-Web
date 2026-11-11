# UI and security review — 11 November 2026

This is a scoped code/configuration review with automated tests, not a penetration test or a promise that every possible attack is prevented. Changes remain local; no deployment, IAM change or production data write was performed.

## Changes

- Sign-up hover/focus preserves white text against a darker violet background, using a short colour transition and respecting existing reduced-motion preferences.
- Registration and destination-option checkboxes have a non-shrinking input beside a separate wrapping text span. Registration links use the canonical Terms and Privacy routes.
- Single-country search now always requests local-only plans. The regional/global checkbox has been removed; an older coverage=all URL is normalised to local. Wider coverage remains available in multi-country mode.
- Sign-in and email verification now share `safeAccountDestination`. It rejects external/protocol-relative URLs, executable schemes, backslashes, literal/encoded control characters, ambiguous normalised paths, malformed escapes and excessive input length. Valid local destination queries remain supported.

## Observed controls

- A read-only Firebase Rules API inspection confirmed that the **currently deployed** Firestore rules match `infra/firestore.rules`: direct client reads/writes are denied for every collection. Nothing was deployed by this review. Firebase Admin operations bypass client rules and therefore require separate backend access checks and protected service credentials.
- Emulator tests confirm anonymous and signed-in clients cannot read package lists, private pricing, purchases, orders or carts, or patch package prices. Backend tests verify customer ownership/guest-token isolation and reject unauthorised order/activation access.
- Backend Firebase ID-token verification checks revocation; privileged operations rely on server-verified identity/custom claims rather than client flags.
- Search, identifiers, checkout bodies and legal acknowledgement use strict server schemas. Unexpected fields/operator-style query parameters, malformed IDs/cursors, invalid prices and oversized request bodies are rejected. Public output uses field allowlists.
- Product names and other text are rendered through React escaping. JSON-LD separately escapes `<`; the browser injection regression uses a script-bearing plan name and confirms it never executes or leaks supplier-only fields.
- Stripe amounts come from server-verified catalogue prices. Signature verification, webhook replay handling and transactional fulfilment claims remain in place.
- HTTP security headers, private no-store responses, rate limiting and restricted CORS origins were reviewed. The existing CSP is a baseline, not a strict nonce-based script policy. Optional Tawk code is isolated on the provider's separate origin.
- `npm audit --json` reported zero known dependency advisories at the time of this review. This is a point-in-time result, not a guarantee about undiscovered vulnerabilities.

## Verification

102 shared/API unit tests and 21 Firestore integration tests passed. The full Playwright fixture suite passed 11 cases (real Stripe is intentionally separate); it includes hover readability, checkbox alignment at desktop/390/375px, safe server-rendered JSON-LD, privacy controls, search state and payment retry behaviour. Lint, application/test TypeScript checks and the production build passed. Strict single-country behaviour, including older regional-option URLs, is covered by Cypress; final command results are recorded in `docs/testing.md`.

## Remaining operational checks

This review did not certify all project IAM bindings, service-account key handling, Firebase provider/dashboard settings, Cloudflare rules, production access logs, or real-device wallet authorisation. Protect service accounts and Secret Manager access, keep dependencies patched, and rotate any still-active server credentials previously shared outside the secret-management workflow. No raw credentials are copied into this document. See `LEGAL_COMPLIANCE.md` for processor, retention and legal follow-up.
