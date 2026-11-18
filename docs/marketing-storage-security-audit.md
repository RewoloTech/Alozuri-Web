# Marketing storage security audit

Reviewed 18 November 2026, approximately 05:28 UTC. Scope: marketing image upload,
image delivery, associated API authorization, and live Cloud Run/bucket settings.
This is a scoped security review, not a complete application penetration test.
No production settings, permissions, rules, files or database records were changed.

## Findings

### Medium — unpublished image URLs are publicly readable

`apps/api/src/lib/marketing.ts:428` checks only that an asset UUID exists in
`marketingAssets`. It does not require a published banner to reference the asset,
an active publication window, or an authenticated administrator. Consequently,
anyone who obtains a draft image URL can retrieve its contents. UUIDs prevent
practical enumeration but do not implement publication authorization.

A controlled Firestore-emulator reproduction uploaded an image through a synthetic
admin account, created no banner, and retrieved the image anonymously: HTTP 200.
The standalone asset handler sets one-year immutable caching; the storefront
proxy also sets this cache policy. The real API's global onSend hook overrides
its own response cache header to no-store, but the proxy still permits long-lived
copies. Unpublishing a campaign therefore cannot revoke an already shared image.
No production image exposure was observed: the live bucket was empty.

Recommendation: separate authenticated draft previews from public delivery;
require a published reference for public image requests. Define a retention and
cache policy consistent with the intended ability to withdraw campaign assets.

### Configuration blocker — marketing runtime values are absent

Live service: `alozuri-api`, project `alozuri`, region `europe-west4`.
Observed ready/traffic revision: `alozuri-api-manual-20261118052033269` (100%).
The service template had no `MARKETING_ENABLED`, `MARKETING_ASSET_BUCKET` or
`BUY_AGAIN_ENABLED` variables at inspection time. The public marketing endpoint
returned 200 with zero banners. In the reviewed code, unset Marketing is disabled
and image storage operations require an explicitly configured bucket.

Recommendation after release verification: set `MARKETING_ENABLED=true` and
`MARKETING_ASSET_BUCKET=alozuri.firebasestorage.app` on the backend. Keep Buy Again
disabled until its separate release blockers are resolved. Local .env.example
files do not configure the deployed Cloud Run service.

### Configuration blocker — no explicit storage grant found for API identity

Runtime identity: `alozuri-api@alozuri.iam.gserviceaccount.com`.
The bucket IAM policy contains legacy project owner/editor/viewer bindings and
no explicit runtime-account grant. Its project-level direct grants are
`roles/datastore.user` and `roles/firebaseauth.viewer`, with no storage role.

Recommendation: establish the necessary object-create/read permissions for this
runtime account on this bucket (or a narrower approved marketing resource),
using least privilege. Do not grant project-wide Storage Admin for this feature.
Effective permissions through groups or ancestor policies were not fully
resolved: the Policy Troubleshooter API returned 403. This finding establishes
that the inspected policies lack an explicit grant, not a conclusive effective
IAM denial across all possible inherited bindings. No production upload or
service-account impersonation was attempted.

### Low — image validation checks signatures, not complete image structure

`apps/api/src/lib/marketing.ts:411` checks file signatures, declared MIME and a
500 KB byte limit. It does not decode or re-encode the file. A controlled upload
containing a PNG signature followed by benign non-image text was accepted with
HTTP 200. This can store invalid images and does not bound decoded dimensions.

This is limited by administrator-only upload access, raster-only MIME types,
fixed server Content-Type and nosniff. It is not evidence of anonymous arbitrary
file upload or script execution.

Recommendation: validate dimensions and complete image decoding with explicit
resource limits, optionally re-encoding accepted raster content. Retain the byte
limit and administrator checks.

### Low / hardening — bucket allows object ACLs

Observed bucket settings: uniform bucket-level access false; public access
prevention inherited; seven-day soft deletion. Bucket and default object ACLs
contained no allUsers/allAuthenticatedUsers grants. Bucket IAM had no such
public members either. Listing all current objects returned zero objects, so
there were no object ACLs to inspect.

Recommendation: evaluate uniform bucket-level access and explicitly enforced
public access prevention, checking compatibility with other Firebase Storage
uses first. The inherited setting alone does not establish whether an ancestor
policy already enforces public access prevention. These settings are hardening
opportunities, not proof of an existing public data leak.

## Controls verified

- Live unauthenticated GET /v1/operations/marketing: 401.
- Live unauthenticated POST /v1/operations/marketing/images with empty JSON: 401;
  authorization runs before storage writes. No live image was uploaded.
- Live anonymous Google Cloud Storage bucket listing: 401.
- Live public /v1/marketing: 200, zero banners, no-store, nosniff.
- Bucket IAM, bucket ACL and default object ACL have no inspected public grant.
- No user-managed keys were returned for the API runtime service account.
- Reviewed admin authentication verifies token revocation and current account
  status, verified email, and current admin custom claims. Marketing mutations
  use that existing admin authorization.
- Storage object paths are server-generated UUIDs inside marketing/; clients
  cannot choose arbitrary bucket paths. Public serving accepts known UUIDs and
  approved raster content types, with nosniff.
- Public storefront proxy does not forward Operations writes or arbitrary hosts.
- Public text is rendered as text; URL policy rejects script schemes,
  protocol-relative URLs, credentials and raw control characters/backslashes.

## Tests and limitations

The temporary audit reproduction ran only against project demo-alozuri at
127.0.0.1:8188, with synthetic admin authorization and an in-memory binary asset
adapter. Its assertions passed: malformed PNG accepted 200, unpublished image
anonymous read 200, anonymous upload rejected 403. This validates the code
findings, not the deployed image path's functionality.

`node --import tsx --test apps/api/test/promotion-policy.test.ts`: six passed,
including unsafe URL rejection and banner configuration validation.

The Firebase Rules API returned 403 when reading the live storage rules release.
The deny-all rules supplied in the conversation are appropriate for this backend
architecture, but their deployed version was NOT independently verified.
Neither successful authorized production upload nor end-to-end live bucket access
was tested. Organization/group IAM inheritance, Firebase download tokens,
other application security surfaces, and external image hosts were not audited.

The immediate priority is to address draft asset publication boundaries and
complete the live rules/effective-IAM verification before calling the system
fully audited. Keep the deny-all client rules; do not open the bucket to make
uploads work. Resolve backend IAM and configuration instead.

## Remediation — 18 November 2026

Marketing assets now require an active published banner reference (including
campaign, promotion and schedule eligibility) for anonymous delivery. Verified
administrators can preview drafts with an authenticated blob request. API,
storefront proxy and bucket object metadata use no-store caching so unpublishing
blocks future requests. Previously downloaded copies cannot be revoked.

Uploads now decode and re-encode PNG/JPEG/WebP using the existing Sharp version,
with explicit runtime dependency, pixel/dimension and output-byte bounds; truncated
image signatures are rejected. Metadata is stripped during re-encoding.

The existing empty Firebase bucket was configured with uniform bucket-level
access and enforced public access prevention. The API runtime has object-user
permissions conditioned on the marketing/ prefix. Client Firebase Storage rules
deny direct reads and writes; authenticated Operations APIs mediate uploads.

Local verification: seven focused Firestore integration tests, 35 Jest tests,
application type checks, lint and production build passed. Live deployment and
verification results are recorded separately after the release checks.

Live checks passed against the actual bucket and deployed API: anonymous upload
rejected, malformed PNG rejected, administrator upload/decoded preview successful,
draft anonymous read denied, direct Cloud Storage and Firebase client downloads
denied, published image served through API and storefront with no-store, and
unpublish immediately returned 404 through both paths. Temporary test accounts
and assets were removed. No customer campaign or purchase was used.

A live browser check found that the PDF download helper rejected image MIME types.
The helper now has an explicit image mode (PNG/JPEG/WebP only); default contract
PDF validation is retained. Preview tests assert the authenticated image mode and
blob URL cleanup. Updated Jest total: 36 passed. PNG, JPEG and WebP round trips
and publish/unpublish access are covered by the seven Firestore integration tests.

Additional MIME-boundary regression tests exercise the real download helper:
default PDF-only downloads, explicit PNG/JPEG/WebP previews, and rejection of
HTML, SVG, PDF and arbitrary binary content in image mode. All 44 Jest tests pass.
