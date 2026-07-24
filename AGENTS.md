## Agent skills

### Issue tracker

GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Project

**Онова за сметката** — Bulgarian mobile web PWA for restaurant bill splitting (TanStack Start, Convex, Vercel). See `README.md` for local setup.

## Before you change code

1. **`CONTEXT.md`** — domain vocabulary (Host, Guest, Participant, Share, Unit, Outstanding, bill status). Use these terms consistently.
2. **`docs/agents/guidelines.md`** — where logic lives, imports, testing, Convex/env rules, UI copy conventions.
3. **`docs/adr/`** — architectural decisions for the area you touch (may be empty until `/domain-modeling` adds them).

## Workflow

Typical agent loop for a ticket or spec:

1. Fetch context — issue via `gh`, spec in issue body or linked doc.
2. Explore — read `CONTEXT.md`, relevant routes in `src/routes/`, Convex modules, and `shared/` helpers before editing.
3. Implement — prefer `/tdd` for logic in `shared/` or `convex/lib/`; keep diffs focused.
4. Verify — `pnpm run ci:preflight`; E2E if guest/host browser flows changed.
5. Review — `/code-review` before PR for non-trivial work.

Skills install globally (`~/.agents/skills/`). This repo only holds **per-repo config** under `docs/agents/` plus domain docs at the root.

## Quality bar

- Pre-commit runs `pnpm run ci:preflight` — do not bypass unless intentional WIP.
- Business logic and schemas belong in **`shared/`** or **`convex/lib/`**, not buried in components.
- User-facing copy is **Bulgarian**; reuse shared message modules where they exist.
- Never enable **`DEV_MODE`** on production Convex deployments.
- Do not edit generated files (`convex/_generated/`, `src/routeTree.gen.ts`).
