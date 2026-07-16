# Triggering a Vercel production deploy from GitHub Actions after Convex

**Date:** 2026-07-16  
**Issue:** [#25](https://github.com/HayGrouve/onova-za-smetkata/issues/25)  
**Map:** [#23](https://github.com/HayGrouve/onova-za-smetkata/issues/23)  
**Sources:** Vercel official docs / KB / REST API only.

## Question

What is the recommended way to trigger a **Vercel production** deployment from GitHub Actions only after a prior job succeeds — including how to disable Vercel’s automatic Git production deploys safely, and whether to use the Vercel CLI, a Deploy Hook, or the REST API for this repo’s setup?

## Verdict (short)

**Disable automatic Git production deploys with `git.deploymentEnabled: { "main": false }` in `vercel.json` (leave unspecified branches / PR previews alone). Trigger production from Actions with the Vercel CLI (`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`) after the Convex job succeeds.** Do not use Ignored Build Step “Don’t build anything”, and do not set the deprecated `github.enabled: false`. Prefer CLI over Deploy Hooks or the REST API for this map’s “know when Vercel failed” preference.

---

## 1. Stop the race: disable automatic Git production deploys

Today, a push to `main` starts a Vercel production build immediately via the Git integration (`docs/DEPLOY.md`), which races Convex. The map wants Actions to own production order while **keeping Vercel PR previews**.

### Recommended: `git.deploymentEnabled` for `main` only

Vercel’s Git configuration documents `git.deploymentEnabled` as the way to control which branches create deployments on commit. Per-branch map:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

Unspecified branches default to `true`, so PR / preview branch Git deploys stay enabled. Setting the whole property to `false` turns off **all** automatic Git deployments — too blunt for this map (previews in scope to keep).

Sources:

- [Git Configuration — `git.deploymentEnabled`](https://vercel.com/docs/projects/project-configuration/git-configuration)
- [Granular branch matching for Git configuration](https://vercel.com/changelog/granular-branch-matching-for-git-configuration-in-vercel-json) (glob patterns; same property)

### Avoid: Ignored Build Step as the primary “off switch”

Ignored Build Step runs when a deployment enters `BUILDING`. Exit `0` cancels the build; exit `1` continues. Presets include “Don’t build anything” (never issue a new build). That is the wrong tool for “GitHub Actions owns prod”:

- It cancels **builds**, including ones you still want (Deploy Hook–triggered builds are canceled by “Don’t build anything”).
- Canceled builds still count toward deployment quotas / concurrent build slots.

Vercel staff guidance in a community thread: to disable **Git** deployment specifically while still allowing other triggers, use `git.deploymentEnabled` — not “Don’t build anything”.

Sources:

- [Project settings — Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings)
- [How do I use the "Ignored Build Step" field on Vercel?](https://vercel.com/guides/how-do-i-use-the-ignored-build-step-field-on-vercel)
- [Vercel Community: Ignored Build Step vs Deploy Hooks](https://community.vercel.com/t/vercel-deployment-canceled-when-using-ignored-build-step-with-deploy-hooks/34210) (staff: use `git.deploymentEnabled`, not “Don’t build anything”)

### Avoid: deprecated `github.enabled: false`

`github.enabled` is deprecated in favor of `git.deploymentEnabled`. Deploy Hooks docs still warn: hooks **will not be triggered** if `github.enabled = false` is present in `vercel.json`. Do not use that legacy flag.

Sources:

- [Git Configuration — Legacy `github.enabled`](https://vercel.com/docs/projects/project-configuration/git-configuration)
- [Creating & Triggering Deploy Hooks](https://vercel.com/docs/deploy-hooks)

---

## 2. Options for triggering production from Actions

### A. Vercel CLI (recommended)

Official path for “use GitHub Actions as CI/CD with Vercel”:

1. Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (from Access Token + `.vercel/project.json` after `vercel link`).
2. Install CLI in the job.
3. Production sequence:

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

`--prebuilt` uploads `.vercel/output` and skips the build on Vercel. Auth in CI should use the `VERCEL_TOKEN` **environment variable** (preferred over `--token` in process listings). `--prod` targets the production domain assignment.

Also documented under Vercel for GitHub → “Using GitHub Actions” (same pull / build / deploy `--prebuilt --prod` flow). Example repos/workflows: [vercel/examples `ci-cd/github-actions`](https://github.com/vercel/examples/tree/main/ci-cd/github-actions).

**Fit for this repo**

- Vite production env (`VITE_CONVEX_URL`, `VITE_APP_ORIGIN`, …) is pulled via `vercel pull --environment=production`, so build-time client config matches the Vercel dashboard.
- The Actions job waits and exits non-zero on deploy failure — matches map preference: Convex ahead, **surface Vercel failure**, no Convex rollback.
- Wire as a job with `needs: [convex-prod]` (or equivalent) so it runs only after Convex succeeds; CI remains an earlier gate.

**Caveats (from CLI docs)**

- With `--prebuilt`, some **system** environment variables are missing at build time on Vercel (frameworks that rely on them at build time). Prefer dashboard / pulled project env for app vars; if a future need requires Vercel system env at build time, drop `--prebuilt` and use a remote build (`vercel deploy --prod`) instead.
- Do **not** also keep Git auto-deploy on `main`, or you get double production deploys.

Sources:

- [How can I use GitHub Actions with Vercel?](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
- [Deploying GitHub Projects with Vercel — Using GitHub Actions](https://vercel.com/docs/git/vercel-for-github)
- [`vercel deploy`](https://vercel.com/docs/cli/deploy) (`--prod`, `--prebuilt`)
- [Vercel CLI Overview — CI tokens](https://vercel.com/docs/cli) (`VERCEL_TOKEN` env var)

### B. Deploy Hook (viable lighter alternative)

A Deploy Hook is a unique URL (Settings → Git → Deploy Hooks) tied to a project + branch. `GET` or `POST` with no auth header triggers a deployment of that branch’s latest commit. Store the URL as a GitHub secret; Actions step is effectively `curl -X POST "$VERCEL_DEPLOY_HOOK"`.

**Pros for this repo:** one secret; build runs on Vercel with dashboard env; minimal workflow surface.

**Cons vs map prefs:**

- Response is a job in `PENDING` — the curl step succeeds before the production build finishes. Knowing “Vercel failed” needs extra polling (REST API / dashboard), which undoes the simplicity.
- Treat the URL like a password (anyone with it can deploy).
- Docs only explicitly block hooks under deprecated `github.enabled: false`. Staff guidance treats `git.deploymentEnabled` as the Git auto-deploy kill-switch that still allows non-Git triggers; prefer `main: false` (not global `false`) so PR Git previews remain.

Sources:

- [Creating & Triggering Deploy Hooks](https://vercel.com/docs/deploy-hooks)
- [`vercel deploy-hooks` CLI](https://vercel.com/docs/cli/deploy-hooks)
- [Community thread above](https://community.vercel.com/t/vercel-deployment-canceled-when-using-ignored-build-step-with-deploy-hooks/34210)

### C. REST API `POST /v13/deployments` (not recommended here)

Creates a deployment for the authenticated user/team. Non-git path: upload files (`POST /v2/files`) then create with `files`; or pass `gitSource` (GitHub ref/repo) instead of `files`. Same bearer token model as the CLI.

This is the low-level mechanism the CLI wraps. For a single TanStack Start app already on Vercel Git, hand-rolling uploads / `gitSource` adds complexity with no benefit over the documented CLI Actions flow.

Sources:

- [Create a new deployment](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
- [Upload Deployment Files](https://vercel.com/docs/rest-api/deployments/upload-deployment-files)
- [Deploying to Vercel — Vercel REST API](https://vercel.com/docs/deployments)

---

## 3. Recommendation for this repo

| Concern | Choice |
| --- | --- |
| Kill Git race on `main` | `vercel.json` → `git.deploymentEnabled.main: false` |
| Keep PR previews | Leave other branches enabled (default); do not set global `false`; do not use `github.enabled: false` |
| Trigger prod after Convex | GitHub Actions job `needs` Convex success → **Vercel CLI** pull / build `--prod` / deploy `--prebuilt --prod` |
| Secrets | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (GitHub Actions secrets) |
| On Vercel failure after Convex | Job fails; backend stays ahead; fix/redeploy frontend (map preference) |
| Out of scope | Automating Convex preview backends; changing PR preview wiring |

**One-sentence recommendation:** Disable automatic production Git deploys with `git.deploymentEnabled: { "main": false }`, keep Vercel PR previews, and after CI + Convex succeed run the official Vercel CLI GitHub Actions production sequence (`pull` / `build --prod` / `deploy --prebuilt --prod`).

### Brief trade-offs

| Approach | Trade-off |
| --- | --- |
| **CLI (pick)** | Three secrets + more YAML; best failure visibility and official GHA docs |
| Deploy Hook | One secret / one curl; poor “did prod finish?” signal without polling |
| REST API | Maximum control; unnecessary when CLI already covers the workflow |

---

## 4. Implementation sketch (not implemented — research only)

When map #23 is executed (separate work):

1. Add `vercel.json` `git.deploymentEnabled.main: false` (or merge into existing config if present).
2. Add GitHub secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
3. In the production release workflow: job order `ci` → `convex-prod` → `vercel-prod`, with `vercel-prod` running the CLI sequence above on `ubuntu-latest` after checkout + CLI install.
4. Update `docs/DEPLOY.md` so “push to main” is no longer the production frontend trigger.

Do not implement that pipeline in this research ticket.
