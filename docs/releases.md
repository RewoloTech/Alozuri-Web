# One manual production release

Use **GitHub → Actions → Release production → Run workflow → main** after this workflow is merged and the deployment identity is configured. A push runs CI; it does not publish either service. The Firebase console's Rollout button still publishes only the App Hosting website. Use the GitHub release action for a coordinated website/API release.

The workflow checks out the exact selected commit and runs the reusable CI workflow first: lint, application/test TypeScript, unit tests, Jest, production builds/container smoke check, Playwright, Firestore emulator, Firebase Auth integration and real-Auth cart browser regressions. It uses no live payment, supplier or email credentials in CI. The real Stripe sandbox test remains a separate explicitly invoked check.

The release compares the selected commit with **each service's own live commit**, not merely the previous GitHub push. Shared source/dependency changes select both services; website changes select App Hosting, API changes select Cloud Run, and docs/tests alone select neither. An unknown API commit or missing historical Git object conservatively selects that service. `force_all` can explicitly rebuild both. The first release establishes a `git-sha` label on the serving API revision.

## Release sequence

1. Require manual dispatch on `main`, successful checks and the `production` GitHub environment. Production releases share one concurrency group and do not cancel an in-progress release.
2. Verify both services have stable 100% traffic and App Hosting automatic rollouts are disabled. Refuse to start while another App Hosting rollout is unfinished. Do not concurrently use the Firebase Rollout button or deploy Cloud Run manually.
3. Build changed API code with the root Dockerfile in the existing Cloud Build/Artifact Registry setup. Deploy the image **by digest** to a tagged revision with no production traffic. Verify `/health` and that payment availability has not changed. Then move API traffic to that checked revision.
4. If website code changed, call `firebase apphosting:rollouts:create alozuri --git-commit=EXACT_SHA` and wait for the build and rollout. Verify the 100% serving App Hosting build's source hash equals that SHA. Both changed services therefore come from the same selected commit.
5. Report the commit, changed targets, API revision/image and App Hosting build in the Actions summary. Remove the temporary API candidate tag.

These are **one coordinated release, not an atomic simultaneous switch**: Google manages the services separately. API contracts must remain backward compatible during rollout. A failed API candidate cannot publish the website. If website rollout fails and the previous website is confirmed live, restore the previous API revision. If the website may have changed, keep the new API and report a partial release for inspection instead of blindly restoring an old API behind a new website. Review both control planes before retrying after cancellation/timeout; cancelling Actions does not necessarily cancel an already submitted Google build/rollout.

The workflow updates the existing `alozuri-api` service and App Hosting backend only. It preserves runtime environment variables, secret bindings, resource settings and IAM. It does **not** enable Cloud Tasks, change queue mode, pause the scheduler, publish Firestore rules, migrate data or create a new application service. Queue activation follows its separately approved [migration](order-processing.md).

Builds, image storage, hosting and GitHub Actions minutes consume their normal allowances; this is not a new fixed-price hosting subscription or a zero-cost guarantee. The API runtime image installs only production API/shared dependencies, excluding Jest and website dependencies. `.gcloudignore` and `.dockerignore` exclude local environment files, generated credentials and browser artifacts from build uploads.

## One-time identity setup (not performed by this code)

The release fails before cloud authentication if these GitHub repository or `production` environment variables are missing:

| Variable                                | Value                                                    |
| --------------------------------------- | -------------------------------------------------------- |
| `GCP_DEPLOY_WORKLOAD_IDENTITY_PROVIDER` | Approved Google Workload Identity provider resource name |
| `GCP_DEPLOY_SERVICE_ACCOUNT`            | Dedicated production deployment service-account email    |

Use keyless Workload Identity Federation, not a downloaded JSON service-account key. Restrict the provider/impersonation binding to `RewoloTech/Alozuri-Web`, `refs/heads/main` and the `production` environment. Configure environment reviewers/branch restrictions to match the owner's release policy. Do not reuse or broaden the catalogue-sync service account: it has a separate purpose and schedule.

The deployment identity needs permission to submit builds/upload sources into the existing build bucket, write/read images in `alozuri-api`, read/update the existing Cloud Run service and revisions, act as its existing runtime service account, and create/read App Hosting builds/rollouts and their connected repository metadata. Scope grants to existing resources where supported. Check Cloud Build's own build identity can write the image repository. Do not grant Owner/Editor or change API runtime permissions as a shortcut. Confirm the required App Hosting/Developer Connect permissions against the [Firebase IAM documentation](https://firebase.google.com/docs/projects/iam/roles-predefined-product) and [Cloud Run deployment permissions](https://cloud.google.com/run/docs/deploying).

No deployment identity, IAM binding, production environment policy or cloud service has been created during local preparation. Those settings require owner review before enabling the workflow. App Hosting's existing automatic rollout policy remains disabled.

## CI notification investigated

[Run 43136055207](https://github.com/RewoloTech/Alozuri-Web/actions/runs/43136055207) failed in **Playwright**, not Cypress. Its two assertions were:

- A price-retry check asserted the request count before its debounced request began. It now waits for that request and the confirmed-total state.
- A native-select keyboard check assumed ArrowDown opens the popup. Linux Chromium can change the selection without opening it. The test uses Space to open it while retaining checks that the label, value, arrow and padding all open the picker.

There is no Cypress workflow or dependency in the current project. Historical run results are immutable; a green run of the fix commit is the verification. Workflows use pinned Node 24-compatible action revisions and Ubuntu 24.04 rather than a moving runner image. Browser failure traces/screenshots are retained for seven days.

Clean-install follow-up: the lockfile is generated without an existing node_modules tree. Explicit Jest/test-exclude glob overrides preserve patched versions under npm 10 clean installation, and React/React DOM overrides match the web app's existing 19.2.4 pins so the test renderer and application cannot install separate React copies. Frozen clean installs, the five-low/zero-moderate-or-higher audit result and Jest were checked again after this correction.
