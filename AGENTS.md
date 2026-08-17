# Agent workflow

Repo-specific agent config. Stack and quality bar: **`.cursor/rules/project.mdc`**. Engineering detail: **`docs/agents/guidelines.md`**.

## Before you change code

1. **`CONTEXT.md`** — full domain glossary (core terms always in `.cursor/rules/context-core.mdc`).
2. **`docs/agents/guidelines.md`** — architecture map, imports, testing, Convex/env, pitfalls.
3. **`docs/adr/`** — ADRs for the area you touch. Host auth is Clerk ([0002](docs/adr/0002-clerk-auth-billing.md)); Host Pro is Stripe Billing ([0003](docs/adr/0003-stripe-billing-beside-clerk.md)).

## Typical loop

1. **Fetch context** — issue via `gh`, spec in issue body or linked doc.
2. **Explore** — read `CONTEXT.md`, relevant `src/routes/`, Convex modules, and `shared/` helpers.
3. **Implement** — prefer `/tdd` for logic in `shared/` or `convex/lib/`; keep diffs focused.
4. **Verify** — `pnpm run ci:preflight`; E2E if guest/host browser flows changed.
5. **Review** — `/code-review` before PR for non-trivial work.

## Issue tracker

GitHub Issues via `gh`. Conventions: **`docs/agents/issue-tracker.md`**.

## Triage labels

`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — see **`docs/agents/triage-labels.md`**.

## Domain docs

Glossary: **`CONTEXT.md`**. ADRs: **`docs/adr/`**. How skills consume domain docs: **`docs/agents/domain.md`**.

## Skills

Skills install globally (`~/.agents/skills/`). This repo holds per-repo config under **`docs/agents/`** plus domain docs at the root.

Scoped Cursor rules: **`context-core`**, **`convex`**, **`frontend`**, **`shared`**, **`e2e`**, **`tanstack-start`** (`.cursor/rules/`).
