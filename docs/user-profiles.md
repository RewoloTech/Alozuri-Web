# User profiles and ownership

`users/{firebaseUid}` is the application's private user/profile collection. Firebase Authentication remains authoritative for identity, email, verification, enabled/disabled state and sign-in providers. Passwords, ID tokens, payment credentials, admin roles and eSIM activation secrets are never stored in profile documents. Profiles do not grant permissions; administrator access continues to use verified Firebase custom claims and the existing owner checks.

Profile records contain `uid`, email, email verification state, display name, first/last name, provider IDs, original Auth creation time, last sign-in time and profile update time. Missing names remain empty; no guest details are invented. Structured names entered by the customer preserve compound first names. Other personal fields such as address, birth date and phone number are not collected here.

## Creation and updates

The authenticated browser calls `POST /v2/profile` after signup/sign-in and verification changes. The server reads the current Firebase Auth record, validates the data and creates/updates that user's document. Ordinary token refresh does not repeatedly write profiles, and unchanged metadata does not cause a Firestore write. A failed sync is visible with a retry on the profile page. Signing out or switching accounts immediately hides the old profile, and late requests cannot restore another account's state.

`GET /v2/profile` reads only the caller's profile. `PATCH /v2/profile` accepts validated first and last names only. The UI mirrors name changes to Firebase Auth with the customer's own Firebase SDK credentials; the backend does not need Auth administrator/write permissions. Email, verified state, UID, timestamps and providers are server-controlled. There are no user-selected UID paths or arbitrary user-list endpoints. Unknown input fields are rejected, including `admin`, `role`, `uid` and email overrides. Existing default-deny Firestore rules block direct browser reads/writes, including to users documents. Same-origin proxy support is limited to these exact profile endpoints.

Authenticated checkout ensures a current, verified profile exists before creating a payment. It does not wait for historical guest-purchase migration. Guest checkout remains account-free. Existing users receive their profile on their next authenticated app visit after both API and website are released; this implementation has not performed a production backfill.

## Links between records

| Record                      | Ownership link                                                                    |
| --------------------------- | --------------------------------------------------------------------------------- |
| Firebase Authentication     | Stable UID; source of identity                                                    |
| `users/{uid}`               | Same UID as its document ID                                                       |
| `carts/{uid}`               | Same authenticated UID                                                            |
| `purchases/{purchaseId}`    | `uid` points to the user; null for an unclaimed guest purchase                    |
| `orders/{unitId}`           | `parentOrderId` identifies its purchase; `uid` matches its owner                  |
| `orderActivations/{unitId}` | Same unit ID and owner UID; private supplier/installation references              |
| `esimUsage/{unitId}`        | Same unit ID, with a validated reference fingerprint and sanitized cached reading |

Verified email matching applies only to purchases whose UID is null. It never opens a purchase already owned by another UID, including for an administrator with a matching email. During verified profile sync, the server can permanently claim matching guest purchases: purchase UID, all child eSIM UIDs and existing protected activation UIDs update in one transaction. Legal/payment snapshots, original delivery email, supplier references and usage readings are not rewritten. Private guest order links remain valid. Once claimed, changing the account email does not lose UID-owned purchases, and a different account using the old email cannot take them.

Guest claims use current Auth verification and matching token email, not a client verification flag. They are bounded to 25 purchases per sync and retry remaining work on subsequent syncs. Conflicting ownership or too many children fails closed for support review. The existing authenticated cart merge is separate and retains its idempotency/version checks.

Fulfilment saves activation ownership from the current transactional order record, so a guest claim during an in-flight supplier request cannot restore the old guest UID.

Usage and activation endpoints check purchase/unit/activation ownership. Usage authorization is checked again after a slow supplier response; flagged/refunded payments cannot expose cached readings. Installation payloads must pass the supplier activation schema instead of unchecked string casts. Profile document UID corruption is rejected rather than silently relabelled.

## Read-only production audit — 12 November 2026

The audit used projected fields and a 200-record cap per source, with no truncation. It retrieved no passwords, payment credentials or activation codes and made no writes or supplier purchases.

- Firebase Auth users: 1; Firestore profiles: 0. One existing Auth user therefore needs profile creation after release.
- Purchases: 13; eSIM order records: 4; activation records: 2; usage caches: 2; ready live eSIMs: 2.
- No missing parent purchases, mismatched purchase/unit/activation UIDs, usage caches without a unit or owned purchases referencing a missing Auth account were found.
- All 13 purchases had consistent stored line-item totals/currencies and valid recorded dates/basic identity fields. This was not a live Stripe reconciliation.
- Both cached snapshots passed the usage schema and supplier-reference fingerprint checks. Both were older than the 15-minute freshness window. This validates saved data integrity, not current supplier counters; no live supplier refresh was performed.
- The API runtime already has `roles/datastore.user` and `roles/firebaseauth.viewer`. No runtime permission change or additional cloud service is required for this feature.

This is a bounded point-in-time audit, not a statement that every production security property has been verified. Profile creation, browser navigation and ownership changes still require the API and website release. Queue activation and deployment identity configuration remain separate and are not changed here.

## Validation

Firestore regressions exercise private profile persistence, Auth-derived metadata, rejected privilege/identity fields, disabled accounts, compound names, current verification, atomic guest claims, account-email changes, cross-account denial, malformed activation payloads, stale ownership during usage lookup, corrupted profile UIDs and profile linkage before payment. Jest tests cover account-switch races and visible retry without repeated token-refresh writes. Real Firebase Auth emulator browser tests cover signup, verification, profile editing, usage/orders navigation, mobile bounds and logout clearing private readings. Existing commerce/usage/transport suites remain required.

Observed validation: 166 shared/API unit tests, 14 Jest tests and 58 Firestore emulator tests passed. The standard Playwright run passed 77 cases and skipped six emulator/optional cases. All five real-Auth emulator browser cases passed separately, followed by a targeted 390px profile-edit rerun. Navigation was checked at 320/390/768/1440px with 44px targets and no horizontal overflow; mobile profile and desktop/mobile navigation screenshots were visually reviewed. Lint, application/test TypeScript, formatting, diff checks and production builds passed. Browser commerce responses were controlled fixtures; no real payment, supplier purchase or fresh usage poll was performed.
