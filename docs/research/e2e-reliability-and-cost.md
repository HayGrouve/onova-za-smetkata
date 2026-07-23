# E2E suite: observed reliability and operating cost

Research for [issue #46](https://github.com/HayGrouve/onova-za-smetkata/issues/46), captured on 2026-07-20 at repository revision [`0df72b9`](https://github.com/HayGrouve/onova-za-smetkata/commit/0df72b985b26be788068d7372197c6fda404f90d).

## Answer

The browser suite is not currently an observed CI safety net. Across all 54 `CI` workflow-run records available from 2026-07-08 through 2026-07-20, the browser tests executed **zero times**. Eight runs instantiated the current `e2e` job; all eight jobs were reported green while their `E2E tests` step was skipped because `E2E_VITE_CONVEX_URL` was empty. The other 46 records did not instantiate an E2E job: 41 had no jobs and five had only `preflight`.[^actions-snapshot] [^skip-job] [^workflow-repair]

Consequently, Actions history provides no CI pass rate, failure rate, or flake rate for the suite. This is an **absence of reliability evidence**, not evidence that the tests never pass or never find defects. The available local evidence is mixed and sparse: PR #15 records one focused spec passing locally, while a current-checkout probe passed one test in 16.7 seconds and then failed the next at its 180-second timeout.[^pr15] [^local-probe]

The observed financial Actions charge is zero: the repository is public and the timing API reports `billable.UBUNTU.total_ms: 0` for each of the eight runs that instantiated `e2e`. The skipped E2E jobs still occupied runners for 2–6 seconds each (26 seconds in total), largely preparing actions before printing the skip message.[^timing] This says nothing about the runner time of an enabled suite because no enabled CI execution exists.

## What actually ran

The Actions snapshot was collected with:

```sh
gh api 'repos/HayGrouve/onova-za-smetkata/actions/workflows/ci.yml/runs?per_page=100'
gh api 'repos/HayGrouve/onova-za-smetkata/actions/runs/<run-id>/jobs?per_page=100'
```

The first command returned 54 records: 48 `push` and 6 `pull_request`; 49 had workflow conclusion `failure` and 5 `success`. Those workflow conclusions must not be treated as E2E results. Counting instantiated jobs showed:

- 41 workflow records with zero jobs;
- 5 records with only `preflight`;
- 8 records with the four-job workflow, including `e2e`.

For all eight E2E jobs, the job conclusion was `success` and the `E2E tests` step conclusion was `skipped`. Their job durations were 3, 5, 3, 2, 6, 2, 3, and 2 seconds. The latest representative log explicitly prints `E2E_VITE_CONVEX_URL not set; skipping e2e.` and shows checkout, pnpm setup, Node setup, dependency installation, Chromium installation, and the browser-test step all skipped.[^skip-job]

This shape is intentional in the current workflow: the secret is copied to `VITE_CONVEX_URL`, the skip step runs when it is empty, and every setup/test step runs only when it is non-empty.[^ci-config] The step-level gating was introduced after the earlier job-level `if: secrets.*` expression invalidated the whole workflow and produced zero-job records.[^workflow-repair]

## Pass, failure, and flakiness evidence

There is no CI evidence from which to estimate reliability:

- no browser test has a pass or failure result in Actions;
- the configured one retry under `CI` has never been exercised by an Actions E2E execution;
- a green E2E check currently means “skip branch succeeded,” not “browser tests passed.”[^playwright-config] [^skip-job]

Two local records exist:

1. PR #15’s checked test plan says `pnpm run test:e2e e2e/host-paid-summary.spec.ts` passed against the required dev setup. This is a first-party record of one focused successful execution, but it contains no duration, raw log, retry count, or repeated-run sample.[^pr15]
2. On 2026-07-20 at 20:21:18Z, `pnpm run test:e2e -- --list` unexpectedly executed the suite because of argument forwarding. Playwright reported 13 tests using one worker. `claim item search stays usable after share drawer expand and collapse` passed in 16.7 seconds; `host banner hidden until guest opens Revolut` then failed at 3.0 minutes, matching that file’s explicit `test.setTimeout(180_000)`. The run was stopped after roughly four minutes rather than allowing the remaining serial tests to consume an unbounded research window. No failure artifact survived, so this establishes a non-green, slow current-environment execution but not its cause and not a flake rate.[^local-probe] [^combined-timeout]

A later non-executing inventory command, `pnpm exec playwright test --list`, reproducibly listed 13 tests in 7 files. One passing test plus one failing test in a single partial run is not enough to classify the failure as deterministic or flaky.

## Duration and setup burden

No full-suite CI duration exists. The only current full-suite attempt was stopped after roughly four minutes with 11 tests still not completed, so extrapolating a complete duration would be speculation.

An enabled cold CI job would perform its own checkout, pnpm setup, Node 22 setup, frozen dependency install, Chromium install, and then start the Vite dev server before testing.[^ci-config] [^package-scripts] The Playwright configuration adds the following constraints:

- Chromium only, emulating a Pixel 5;
- one worker and no full parallelism;
- 120-second default test and web-server startup timeouts;
- one retry in CI;
- a list reporter, with no workflow step that uploads traces, screenshots, or reports.[^playwright-config] [^ci-config]

The payment-flow file raises its five tests to a 180-second timeout, as observed in the local failure.[^combined-timeout] A timeout in CI can therefore consume up to three minutes and then be retried once before setup and other tests are considered.

The suite also depends on an external, non-production Convex deployment configured with `DEV_MODE=true`, a matching frontend `VITE_CONVEX_URL`, the dev Password provider, Chromium, and a local Vite server. The repository’s E2E guide documents separate backend/frontend setup and lists missing dev auth, a wrong deployment URL, and a missing browser executable as common failures.[^e2e-readme] CI additionally requires the repository secret that is presently absent. This is a real configuration and stateful-backend burden, not merely browser startup.

## Evidence that it caught regressions

There is **no recorded Actions evidence** that E2E caught a regression because Actions never executed the tests.

Repository history shows E2E scenarios being added alongside features, and PR #15 records a focused green verification. The recent `db5bcc3` commit added a search/drawer browser scenario and application changes; nine minutes later `0df72b9` fixed search focus after drawer collapse. That sequence is consistent with a test informing development, but no failing log, PR discussion, or check run connects the test to the fix, and the fix commit’s E2E job skipped the browser step.[^test-fix-sequence] It is therefore circumstantial evidence only, not a documented caught regression.

The defensible conclusion is:

- **evidence of detection:** none in retained CI/log records;
- **evidence of feature verification:** one self-recorded focused local pass;
- **absence of evidence caveat:** unrecorded local red/green use may have happened, but the repository and GitHub records cannot establish it.

## Implication for map #45

The suite should be treated as a local/manual, stateful integration harness whose CI reliability and enabled cost remain unmeasured—not as a dependable PR gate. The observed skip path is cheap and unbilled, but it supplies no regression protection. Retaining it as a gate would first require a maintained dev backend/secret, honest skipped-vs-passed reporting, diagnostic artifacts, and repeated enabled runs to establish runtime and flakiness.

This research does not create a new independent decision ticket: whether to fund that enablement work or reshape/remove the suite is already the decision owned by [map #45](https://github.com/HayGrouve/onova-za-smetkata/issues/45).

## Primary sources

[^actions-snapshot]: GitHub Actions REST data from [`GET /actions/workflows/ci.yml/runs`](https://api.github.com/repos/HayGrouve/onova-za-smetkata/actions/workflows/ci.yml/runs?per_page=100) and each run’s `GET /actions/runs/{id}/jobs`, queried with `gh` on 2026-07-20. The human run index is [Actions → CI](https://github.com/HayGrouve/onova-za-smetkata/actions/workflows/ci.yml).

[^skip-job]: Latest representative skipped job: [run 29774912231, job 88461857844](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29774912231/job/88461857844). The seven other jobs were [87740336416](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29532364938/job/87740336416), [87734712038](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29532138426/job/87734712038), [87734036952](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29531929474/job/87734036952), [87733674682](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29531817979/job/87733674682), [87732445776](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29531446786/job/87732445776), [87730789907](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29530931929/job/87730789907), and [87730347671](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29530793373/job/87730347671).

[^workflow-repair]: Commit [`cc3b759`](https://github.com/HayGrouve/onova-za-smetkata/commit/cc3b759638d6ca0b80c6fab0414fb36d95e8cf70) records why the prior workflow produced zero jobs and replaces job-level secret gating with step conditions. Commit [`9619e6b`](https://github.com/HayGrouve/onova-za-smetkata/commit/9619e6b6222fdfc2020422aeb60b5c6c99d02eea) is the temporary preflight-only bisect.

[^ci-config]: [Current `.github/workflows/ci.yml`](https://github.com/HayGrouve/onova-za-smetkata/blob/0df72b985b26be788068d7372197c6fda404f90d/.github/workflows/ci.yml#L44-L80).

[^timing]: GitHub timing API for the eight full-workflow runs returned total run durations of 17, 48, 63, 118, 67, 60, 24, and 27 seconds and zero billable Ubuntu milliseconds for each; for example, [run 29774912231 timing](https://api.github.com/repos/HayGrouve/onova-za-smetkata/actions/runs/29774912231/timing). Repository visibility was independently read as `PUBLIC` with `gh repo view`.

[^playwright-config]: [Current `playwright.config.ts`](https://github.com/HayGrouve/onova-za-smetkata/blob/0df72b985b26be788068d7372197c6fda404f90d/playwright.config.ts).

[^pr15]: [PR #15 test plan](https://github.com/HayGrouve/onova-za-smetkata/pull/15), which records the focused E2E command as passing.

[^local-probe]: Local Playwright output observed in this checkout on 2026-07-20. The follow-up inventory command listed the same 13 tests in 7 files without execution. This evidence has no durable GitHub URL and is intentionally reported with its limitation.

[^combined-timeout]: [`e2e/combined-guest-payment.spec.ts`](https://github.com/HayGrouve/onova-za-smetkata/blob/0df72b985b26be788068d7372197c6fda404f90d/e2e/combined-guest-payment.spec.ts#L1-L14).

[^package-scripts]: [`package.json` E2E scripts](https://github.com/HayGrouve/onova-za-smetkata/blob/0df72b985b26be788068d7372197c6fda404f90d/package.json#L8-L19).

[^e2e-readme]: [Repository E2E setup and common failures](https://github.com/HayGrouve/onova-za-smetkata/blob/0df72b985b26be788068d7372197c6fda404f90d/e2e/README.md).

[^test-fix-sequence]: [`db5bcc3`](https://github.com/HayGrouve/onova-za-smetkata/commit/db5bcc3729c67cb69e782642058894a4e3ee38a3) added the browser scenario; [`0df72b9`](https://github.com/HayGrouve/onova-za-smetkata/commit/0df72b985b26be788068d7372197c6fda404f90d) followed with the focus fix. The latter’s [E2E job](https://github.com/HayGrouve/onova-za-smetkata/actions/runs/29774912231/job/88461857844) skipped browser execution.
