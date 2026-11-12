# Firebase storefront release — 12 November 2026

The owner explicitly requested a GitHub push and Firebase deployment. Storefront
changes committed in `4a094bb` are included in release commit
**`2c5d32632532aef18b03bde08149ce134b1e0cec`**, pushed to `main`.

Firebase App Hosting build **`build-2026-11-11-009`** is READY and manual rollout
**`rollout-2026-11-11-009`** SUCCEEDED, serving 100% of website traffic on
https://alozuri.com. The build started before midnight and completed on 12 November.
Automatic rollouts remain disabled; this was one explicit manual deployment.
Existing backend environment overrides were preserved, including live Stripe
publishable configuration. API and catalogue prices remain on the previously
verified production releases.

The website now includes equal-height plan cards with aligned price/actions,
one visible checkout email field, clear guest checkout, optional inline account
creation/login and Google sign-in, and the Stripe wallet eligibility changes.
Cypress runtime/configuration/tests are removed; Playwright is the browser runner
and GitHub CI installs Chromium and runs its suite.

## Verification

- Lint, application/test TypeScript and the complete production build passed.
- Unit tests: 35 shared and 111 API passed.
- Firebase Auth emulator: two tests passed.
- Playwright: 66 passed, one opt-in real Stripe SDK case skipped in this run.
- Live browser checks passed for GBP featured cards, Europe product → cart →
  pre-payment checkout at £8.49, one email input, Google/account controls, and
  registration/login form toggles without submitting account requests.
- Live checkout overflow checks passed at 375/390/768/1440px.
- Live US daily search returned seven plans with $1.49/$1.99 for the first two
  allowances. All card heights and price baselines aligned. Browser page errors
  and payment requests were both zero.
- Desktop checkout and plan-grid screenshots were visually inspected.

No real payment, supplier purchase, live Google OAuth exchange or wallet
payment was performed. Emulator/controlled tests do not establish live eSIM
installation or full payment-to-delivery completion.

[Machine-readable release evidence](firebase-storefront-release-2026-11-12.json)
records the exact source commit, traffic and checks. The later documentation
commit does not change the deployed website source.
