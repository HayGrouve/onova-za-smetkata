# Convex production deploy from GitHub Actions

**Date:** 2026-07-16  
**Issue:** [#24](https://github.com/HayGrouve/onova-za-smetkata/issues/24)  
**Map:** [#23](https://github.com/HayGrouve/onova-za-smetkata/issues/23)  
**Sources:** Convex official docs + installed CLI (`convex@1.42.1`) help/source. Secondary blogs ignored.

## Question

What is the current, supported way to deploy this project's Convex **production** deployment from GitHub Actions — including which secret/key to use (`CONVEX_DEPLOY_KEY` vs others), required CLI flags (e.g. `--yes`, build-environment checks), and pitfalls that would break or mis-target prod?

## Verdict (short)

Use a **production deploy key** stored as the GitHub Actions secret **`CONVEX_DEPLOY_KEY`**, then run **`npx convex deploy`** (or `pnpm exec convex deploy`) after install. Enable the key’s **`deployment:deploy`** permission. For this repo’s planned split (CI → Convex prod → Vercel prod separately), do **not** wrap the frontend build in `--cmd` on the Convex step — that pattern is for hosters that build frontend and backend in one step. **`--yes` is optional** with a prod deploy key (confirmation is for the local `CONVEX_DEPLOYMENT` → prod path). Do **not** use a preview deploy key, project token, or admin key for this job.

---

## 1. Supported CI path

### Secret / key

| Item | Supported choice |
| --- | --- |
| Env var name | `CONVEX_DEPLOY_KEY` |
| Key type | **Production** deploy key for the prod deployment (historically `coordinated-warbler-782`) |
| Format (docs) | `prod:<deployment-name>\|…` |
| Permission | At least `deployment:deploy` |

How to mint (dashboard):

1. Open the **production** deployment’s settings → **Deploy keys**.
2. Generate a production deploy key.
3. Enable **`deployment:deploy`** (push code, schema, auth config).
4. Store the value in GitHub Actions as repository secret `CONVEX_DEPLOY_KEY`.

CLI alternative (from a logged-in machine, not from CI with a key already in scope):

```bash
npx convex deployment token create github-actions-prod --deployment prod
```

Sources:

- [Deploy Keys](https://docs.convex.dev/cli/deploy-key-types) — CI uses `CONVEX_DEPLOY_KEY`; production key shape; `deployment:deploy` for `npx convex deploy`
- [Deployment settings — Creating Deploy Keys](https://docs.convex.dev/dashboard/deployments/deployment-settings) — same permission wording
- [Role Actions — `deployment:deploy`](https://docs.convex.dev/team-management/role-actions) — “Push code to a deployment”
- [Project Configuration — Production deployment](https://docs.convex.dev/production/project-configuration) — CI uses `CONVEX_DEPLOY_KEY`
- [Using Convex with Vercel](https://docs.convex.dev/production/hosting/vercel) / [Netlify](https://docs.convex.dev/production/hosting/netlify) — same secret name and production-key workflow (host-specific UI; principle applies to any CI)
- [Working with Multiple Deployments](https://docs.convex.dev/production/multiple-deployments) — GitHub Actions explicitly listed; prod vs preview distinguished by which key is in `CONVEX_DEPLOY_KEY`

### Command

Minimal production-backend deploy (matches map preference: Convex before Vercel, separate steps):

```bash
pnpm install --frozen-lockfile
npx convex deploy
# with env: CONVEX_DEPLOY_KEY=${{ secrets.CONVEX_DEPLOY_KEY }}
```

What `npx convex deploy` does (docs + CLI help): typecheck → regenerate `convex/_generated` → bundle → push functions/indexes/schema to the target deployment. Optional `--cmd` runs a frontend build first with the deployment URL injected — useful when one build step publishes both, **not** required when Vercel builds the frontend later.

Sources:

- [CLI — Deploy Convex functions to production](https://docs.convex.dev/cli#deploying-your-app)
- [`npx convex deploy` reference](https://docs.convex.dev/cli/reference/deploy)
- Installed CLI: `npx convex deploy --help` (`convex@1.42.1`)

### How the target is chosen

Documented selection for CI:

1. If `CONVEX_DEPLOY_KEY` is set → deploy to the deployment **associated with that key** (production key → that prod deployment; preview key → preview flow).
2. Else if `CONVEX_DEPLOYMENT` is set (local `.env.local`) → deploy to the project’s **default production** deployment (and ask for confirmation interactively).

CLI help text lists `CONVEX_DEPLOYMENT` before `CONVEX_DEPLOY_KEY` narratively; the overview docs and deploy-key path in the CLI treat **`CONVEX_DEPLOY_KEY` as the CI selector** and, for a deployment-scoped key, ignore `--prod` / preview-name style selectors. For GitHub Actions: set **only** the production `CONVEX_DEPLOY_KEY` (do not also inject a conflicting preview key).

Sources:

- [CLI overview — target determination](https://docs.convex.dev/cli#deploying-your-app) (lists deploy key first for CI)
- [`npx convex deploy` reference](https://docs.convex.dev/cli/reference/deploy)
- Installed CLI source `deploymentSelection.ts`: deployment deploy key → `existingDeployment` with `source: "deployKey"`; preview key takes precedence over other env vars

---

## 2. Flags that matter for GHA

| Flag / check | Needed for prod GHA? | Notes |
| --- | --- | --- |
| `-y` / `--yes` | **No** (harmless if present) | Hidden help. Skips the interactive “push to prod?” prompt used when developing against `CONVEX_DEPLOYMENT` and deploying to that project’s prod. With a **prod deploy key**, configured name already matches the target, so the prompt is not required. Warning text: deploys to PRODUCTION. |
| `--check-build-environment` | Defaults **enable**; leave it | Hidden. Refuses prod deploy-key deploys when a **non-production host build env** is detected (Vercel preview, Netlify non-production, Cloudflare non-`main`). **`isNonProdBuildEnvironment()` returns false on plain GitHub Actions** (no Vercel/Netlify/CF markers), so default GHA runs are fine. |
| `--cmd` / `--cmd-url-env-var-name` | **No** for map’s split pipeline | Needed when frontend build and Convex push share one step (Vercel/Netlify guides). This project already builds on Vercel with `VITE_CONVEX_URL`; Convex GHA step should push backend only. |
| `--preview-*` | **No** | Preview-only; ignored or error on production keys depending on flag. |
| `--dry-run` | Optional | Safe preview of config without pushing. |
| `--typecheck` / `--codegen` | Defaults OK | Defaults: typecheck `try`, codegen `enable`. |

Sources:

- Installed CLI `command.ts` (`-y, --yes` hidden option text)
- Installed CLI `deploy.ts` (`--check-build-environment`, confirmation via `askToConfirmPush`)
- Installed CLI `envvars.ts` (`isNonProdBuildEnvironment` — Vercel/Netlify/Cloudflare only)
- Hosting guides linked above for `--cmd`

---

## 3. Pitfalls that break or mis-target prod

1. **Preview deploy key in the Production secret**  
   Key shape `preview:team:project|…` makes `npx convex deploy` create/reuse a **preview** deployment (branch name from `GITHUB_HEAD_REF` / CI), not prod. Source: [Deploy Keys](https://docs.convex.dev/cli/deploy-key-types), [Multiple Deployments](https://docs.convex.dev/production/multiple-deployments), CLI help.

2. **Wrong permission on the key**  
   Without `deployment:deploy`, CI cannot push. Source: [Deployment settings](https://docs.convex.dev/dashboard/deployments/deployment-settings), [Role Actions](https://docs.convex.dev/team-management/role-actions).

3. **Relying on login / `CONVEX_DEPLOYMENT` in CI instead of a deploy key**  
   CI cannot use interactive `npx convex login`. Local path asks for confirmation (hangs/fails non-interactively unless `--yes`). Docs steer CI to `CONVEX_DEPLOY_KEY`. Source: [Deploy Keys](https://docs.convex.dev/cli/deploy-key-types), [Project Configuration](https://docs.convex.dev/production/project-configuration).

4. **Confusing `CONVEX_DEPLOYMENT` with the deploy target**  
   With `CONVEX_DEPLOYMENT` set to a **dev** deployment, `npx convex deploy` still targets that project’s **production** deployment (after confirm). This repo’s `docs/DEPLOY.md` step “Ensure `CONVEX_DEPLOYMENT` targets production” is easy to misread; for GHA, prefer a prod **deploy key** and do not commit `.env.local` (already gitignored). Sources: [CLI](https://docs.convex.dev/cli#deploying-your-app), [Project Configuration](https://docs.convex.dev/production/project-configuration).

5. **Admin / project / dev keys**  
   Admin keys and project tokens are different key classes with broader or different behavior. Production CI should use a **production deployment deploy key**. Source: [Deploy Keys](https://docs.convex.dev/cli/deploy-key-types).

6. **Bundling frontend deploy into Convex on GHA while Vercel also deploys**  
   Using `npx convex deploy --cmd 'pnpm run build'` on GHA would build the client there; Vercel still builds/publishes separately. For map #23’s ordered pipeline, keep Convex push and Vercel frontend as distinct steps. Source: hosting guides describe `--cmd` for combined host builds; map standing preference is CI → Convex → Vercel.

7. **Host preview build + prod key (not GHA-specific, but related)**  
   If someone later runs Convex deploy inside a Vercel/Netlify **Preview** build with a **production** `CONVEX_DEPLOY_KEY`, default `--check-build-environment=enable` will **abort**. That guard does not apply to ordinary GitHub Actions. Source: CLI `deploy.ts` + `isNonProdBuildEnvironment`.

8. **Expecting `--yes` to be documented / required**  
   Official public help list for `convex deploy` does not show `--yes`; it exists as a **hidden** flag. Not required for deploy-key CI. Source: `npx convex deploy --help` vs `command.ts`.

---

## 4. Fit to this repo (context only)

| Fact | Implication |
| --- | --- |
| Package script `"deploy": "pnpm run preflight && npx convex deploy"` | Fine locally after login / with confirmation; for GHA prefer an explicit step with `CONVEX_DEPLOY_KEY`, and keep preflight as the existing CI job. |
| Prod slug historically `coordinated-warbler-782` | Production deploy key must be minted for **that** production deployment. |
| `.github/workflows/ci.yml` today: preflight only | No Convex deploy yet — research only; pipeline work is map #23. |
| Frontend on Vercel with `VITE_CONVEX_URL` | Convex GHA job need not set client URL via `--cmd`; Vercel already has the prod URL. |
| `.env.local` gitignored | Clean checkout on GHA will not accidentally load a local `CONVEX_DEPLOYMENT`. |

---

## 5. Suggested GHA shape (not implemented)

Illustrative only — do not treat as a committed workflow:

```yaml
# after CI success on main
- run: pnpm install --frozen-lockfile
- run: npx convex deploy
  env:
    CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

Optional: `-y` if any path could still hit the interactive confirm. Prefer fixing env selection (prod deploy key only) over relying on `-y`.

---

## Sources (primary)

1. https://docs.convex.dev/cli/deploy-key-types  
2. https://docs.convex.dev/cli#deploying-your-app  
3. https://docs.convex.dev/cli/reference/deploy  
4. https://docs.convex.dev/production/project-configuration  
5. https://docs.convex.dev/production/hosting/vercel  
6. https://docs.convex.dev/production/hosting/netlify  
7. https://docs.convex.dev/production/multiple-deployments  
8. https://docs.convex.dev/dashboard/deployments/deployment-settings  
9. https://docs.convex.dev/team-management/role-actions  
10. Installed package `convex@1.42.1` — `npx convex deploy --help` and CLI sources under `node_modules/convex/src/cli/` (`deploy.ts`, `command.ts`, `envvars.ts`, `deploymentSelection.ts`)
