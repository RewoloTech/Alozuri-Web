# Manual rollout recovery — 11 November 2026

Completed following the owner's request to fix the rollout failure.

## Cause

Audit records showed that the Firebase console created build `build-2026-11-11-007` at 20:07 London time, then attempted to create `rollout-2026-11-11-001`. That rollout already existed from 00:05. Later console attempts hit the same name collision; one created build `build-2026-11-11-008` without successfully creating its rollout. This was a rollout identifier collision, not a GitHub-triggered automatic deployment. Automatic rollouts were disabled.

## Recovery

The existing frontend build `build-2026-11-11-008`, for commit `56d245824e94e87f6de666e738d372880f41963e`, was reused after it became READY. A unique manual rollout named `rollout-2026-11-11-008` was validated and created through the App Hosting API. It succeeded at approximately 20:27 London time and receives 100% of frontend traffic. No additional frontend build was created for the recovery, and old rollout history was retained.

Before releasing the frontend, the live API was found to reject checkout notice version `2026-11-11.3`, although the frontend sends it. The matching API was built from the same commit using the existing build identity and deployed first:

- Cloud Build: `662adde9-90eb-4834-ad05-58fcd82877d0`, SUCCESS.
- Cloud Run revision: `alozuri-api-00008-97c`, ready with 100% API traffic.
- Immutable image: `europe-west4-docker.pkg.dev/alozuri/alozuri-api/api@sha256:d6149fe702bf14a2e29f9ec3c2127e62af906386f6926f3fc60be86dc651153c`.
- Only the container image was changed. Container environment/secret references and the runtime account were compared before/after and preserved; the previous service configuration was backed up privately outside Git.

## Verification

- Both current `.3` and previous `.2` checkout formats now reach the expected empty-cart validation response. These checks cannot create a payment or supplier order.
- API health/config return HTTP 200 with live checkout configured. Unsigned Stripe webhooks return 400 and unsigned fulfilment calls return 401.
- App Hosting reports `rollout-2026-11-11-008` SUCCEEDED and build `008` at 100% traffic. Automatic rollouts remain disabled.
- Live browser: a UK product could be added to a guest cart, manually changed to GBP, and taken to a correctly quoted checkout with Continue to payment enabled. At 390px there was no horizontal overflow or observed JavaScript exception. Payment was not submitted.
- `/api/currency` returns HTTP 200 with private/no-store cache headers. The verification request returned USD. Actual country-header forwarding was not established by that observation; manual GBP selection was verified. See [currency configuration](currency-geolocation.md).

No application code was modified for this recovery, and no pricing migration, live charge or supplier purchase was made by the verification. The deployed commit's application tests and production build had already passed during implementation; this recovery additionally performed the cloud build, deployment, live boundary checks and live browser smoke check above.

## Future manual releases

Refresh the App Hosting backend dashboard after this recovery to discard a stale create-rollout dialog. If the console again reuses an existing identifier, use the official Firebase CLI, which selects a fresh identifier, rather than repeatedly creating builds through the failing dialog:

```sh
firebase apphosting:rollouts:create alozuri \
  --project alozuri \
  --account rewoloapp@gmail.com \
  --git-commit FULL_REVIEWED_COMMIT_HASH
```

Keep the confirmation prompt. Check for in-progress work and compatible API/frontend versions before starting. Do not delete historical successful rollouts to free an identifier. This recovery bypassed the console's collision; it does not claim to patch Firebase's console implementation.
