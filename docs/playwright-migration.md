# Playwright browser tests

Playwright is the only browser test runner. The former Cypress dependency, configuration, scripts, support code and tests are removed, together with its `start-server-and-test` launcher dependency. Build environments no longer need the old binary-install flag. Historical reports retain the names and counts of checks that actually ran at the time.

Use `npm run test:e2e` for the headless suite or `npm run test:e2e:ui` for the interactive runner. Install Chromium once with `npx playwright install chromium`. `npm run typecheck:tests` now checks Playwright tests, fixtures and the Auth integration test using `tests/tsconfig.json`.

The 13 former Cypress cases are covered by Playwright in `tests/e2e/shopping.spec.ts`:

| Behaviour                                                      | Playwright coverage                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Explicit single/trip selection and full coverage               | Existing selection/navigation regression                                       |
| Persistent cart, quantities, totals, removal and mobile bounds | Existing cart regression                                                       |
| Apple Pay and Google Pay decline/retry                         | Existing two wallet contract cases                                             |
| Unsupported-wallet card fallback                               | Existing card fallback case                                                    |
| 50 GB and unlimited/fair-use filters, reload restoration       | Migrated allowance filter case                                                 |
| Delayed response cannot overwrite a newer filter               | Migrated controlled-response ordering case                                     |
| Strict local plans and legacy wider-coverage URLs              | Migrated local search case plus existing URL/Back regression                   |
| Pagination, sort, totals and facets                            | Migrated three-page case, including unique plan counts                         |
| Catalogue revision conflicts                                   | Migrated conflict/refresh case                                                 |
| Country aliases and keyboard focus                             | Extended existing keyboard case with UK Enter selection and Escape restoration |
| GBP/EUR search, quantities and checkout                        | Migrated repricing/amount/currency-lock case                                   |
| Equal numeric totals in different currencies                   | Migrated separate checkout-attempt case                                        |

These provider-controlled cases validate the storefront's behaviour. They do not authorise real wallet transactions or issue eSIMs. The existing opt-in real Stripe sandbox test also runs through Playwright and remains available as `npm run test:stripe`. Node unit/API tests and Firebase emulator tests retain their existing runners.

GitHub CI installs Chromium and OS dependencies, runs `npm run test:e2e`, and uploads `test-results` on failure. This configuration change does not run remote CI or deploy the application.

## Validation on 11 November 2026

- `npm run test:e2e`: 63 passed, one opt-in real Stripe SDK test skipped. The migrated 20-case shopping suite also passed separately.
- `npm test`: 134 shared/API unit tests passed.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:tests` and `npm run build`: passed.
- Prettier checks, `git diff --check` and `npm ci --dry-run --ignore-scripts`: passed.
- Dependency removal pruned 151 packages; the remaining locked package versions did not change. No active runner/configuration references remain in scripts, workflows, tests, build configuration or dependency manifests.

No product UI was changed by this migration. Existing browser checks retained their mobile bounds/interaction coverage. Remote CI and a new real Stripe sandbox run were not executed for this migration. No deployment was performed.
