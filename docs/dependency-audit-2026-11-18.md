# Dependency audit — 18 November 2026

The reported npm install completed successfully. Its audit summary is not proof
that the subsequent Docker build or deployment failed. No manifests, lockfile,
installed dependency versions or production configuration were changed here.

## Verified results

- `npm audit --json`: 48 high, zero moderate/critical findings.
- `npm audit --omit=dev --json`: two high findings in the full production
  dependency graph (`@parcel/watcher` and `picomatch`).
- `npm audit --omit=dev --workspace=@alozuri/api --workspace=@alozuri/shared
--include-workspace-root=false --json`: zero reported vulnerabilities for the
  API/shared production dependency scope installed by the API Dockerfile.
- `npm ls picomatch --all`: versions 4.0.7 and 2.3.2 are present through Jest,
  lint/glob utilities, and next-intl's @parcel/watcher dependency.
- `npm view picomatch version versions --json`: latest published release 4.0.7.

All 48 reported vulnerable dependency entries trace to a single root advisory:
[GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
It describes regular-expression denial of service with attacker-supplied repeated
extglob patterns. The advisory marks picomatch <=4.0.7 affected and lists no
patched version at inspection time. The total therefore represents affected
package/dependency chains, not 48 independent root vulnerabilities.

## Exposure and remediation limits

Most affected chains are development tooling. The next-intl dependency also
places @parcel/watcher/picomatch in the full production package graph. Its
reviewed source usage is the translation extractor's source-file watcher with
ignore patterns generated from directory constants. This source review is not a
complete proof that every transitive runtime path is unreachable from customers.
Do not equate a clean API dependency audit with a full system security assessment.
This did not audit container OS packages or the Node runtime.

Some suggested npm fixes downgrade Jest to 30.2.0, jest-environment-jsdom to
29.7.0, or eslint-config-next to 14.2.35. Those are not a verified patch for this
advisory; the older picomatch versions are also in its affected range. No forced
fix or framework/tooling downgrade was applied. There is currently no verified
published picomatch upgrade that resolves the finding. Reassess when a patched
release or supported upstream mitigation is available.

The whatwg-encoding, node-domexception and ESLint deprecation notices are separate
maintenance notices. The npm 12 update advertisement does not itself repair the
project dependency advisory. No tests/build were rerun because application code
and dependency versions were not changed. The advisory remains unresolved.
