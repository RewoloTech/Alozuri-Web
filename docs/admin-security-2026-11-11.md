# Admin security review — 11 November 2026

## Findings and changes

The reported `Principal` errors came from test identities missing the required
`admin` boolean. The fixtures now explicitly use `admin: false`; the production
type remains strict. The test TypeScript configuration now includes API unit and
Firestore tests, which previously escaped this check. Other newly exposed fixture
errors were corrected using a complete typed Stripe session fixture rather than
weakening production types.

Previously, an otherwise valid Firebase ID token could retain its admin claim
after the role was removed from the user account. The new authentication helper
checks revoked tokens and, for tokens claiming verified administrator access,
reads the current Firebase user. Admin access requires a strict boolean claim in
both places, verified email, a matching UID, and an enabled account. Failed lookups
deny access. The HTTP admin guard also requires `admin === true`.

Optional server-only `ADMIN_OWNER_UID` further restricts an existing admin role
to one UID. It does not grant privileges. Set the exact intended owner's Firebase
Auth UID for a single-owner deployment; remove the variable for claim-based
multiple-admin access. An empty value denies all administrators. No actual owner
was selected and no production claims or environment variables were changed.

## Live read-only observations

- Firebase Auth contained **zero** users with `customClaims.admin === true`,
  zero active verified app administrators, and zero non-boolean admin claims at
  review time. Firebase/Google Cloud project access is separate from app roles.
- The deployed Cloud Run API had no `ADMIN_OWNER_UID` configured.
- Deployed Firestore rules were retrieved through the Rules API and match
  `infra/firestore.rules`: all direct client reads and writes are denied,
  including clients claiming administrator status. Backend service identities
  bypass client rules and must continue enforcing ownership.
- The API runtime uses a custom service account. Its project-level IAM bindings
  examined here were `roles/datastore.user` and `roles/firebaseauth.viewer`;
  neither Owner nor Editor appeared in those bindings. This does not establish
  the absence of inherited, group, organization, resource-level, or other human
  permissions.

## Access boundaries reviewed

- `/v1/admin/status` uses server-verified Firebase identity and verified email;
  URL parameters, request bodies and `x-admin` headers do not grant access.
- No application role-grant endpoint exists. Do not implement automatic admin
  assignment on first signup or trust a profile document/browser flag.
- Internal supplier synchronization and fulfilment require their separate OIDC
  service identities; a Firebase app-admin token cannot invoke them.
- The storefront proxy allowlist excludes privileged admin/internal routes.
- An app administrator does not gain access to another customer's usage through
  the customer API. Order ownership/guest credential checks remain required.
- Request logging redacts authorization, cookies, and guest credentials.
- The current admin UI is a status overview, not a complete order management,
  support or recovery console. Its supplier-connected indicator is configuration
  derived, not a live supplier health probe (see storefront review).

## Verification

- `npm run typecheck` and `npm run typecheck:tests`: passed.
- `npm run lint`: passed.
- `npm test`: 35 shared and 104 API tests passed.
- `npm run test:auth`: two Firebase Auth emulator tests passed, including real
  SDK custom-claim removal while retaining the old ID token, disabled accounts,
  and owner restrictions. Emulator identities never touched production Auth.
- `npm run test:firestore`: 34 tests passed, including denial of direct reads
  and role writes for anonymous, customer and admin-claim clients.
- `npm run build`: Next.js production build and API TypeScript build passed.
- `npm run test:e2e`: 63 passed, one optional real Stripe test skipped.
- `npx playwright test tests/e2e/admin-security.spec.ts`: two additional tests
  passed: anonymous admin navigation redirects to login without requesting
  privileged data, and the storefront proxy rejects admin reads/role writes.

No live payment, supplier purchase, production mutation, or deployment was
performed. There was no new visual UI change, so manual layout review was not
required for this change. This is a targeted code and access-control review,
not a penetration test or a complete Google Cloud organization IAM audit.

## Release requirements

The authentication hardening is local until reviewed and deployed. If exactly
one app administrator is intended, the owner must be explicitly identified,
their email verified, and the role and server UID restriction configured through
a trusted administrative process. Merely deploying this change does not create
an administrator. Use MFA for the owner and protect privileged Firebase/Cloud
accounts; MFA enforcement was not established in this review.
