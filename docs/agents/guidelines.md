# Engineering Guidelines

Project-specific conventions for agents working in this repo. Read this after `CONTEXT.md` when exploring or implementing a change.

## Product

**Онова за сметката** — mobile web PWA for splitting restaurant bills in Bulgarian. Hosts create bills, assign receipt items to participants, track guest payments, and share totals. Guests join via share link without an account.

## Architecture map

```
shared/          Pure TS: schemas, calculations, validation, shared message strings
convex/          Backend: persistence, auth, guest sessions, OCR, rate limits
convex/lib/      Server helpers reused across Convex modules
src/routes/      TanStack Router file routes
src/components/  UI (bills/, layout/, ui/ shadcn)
src/lib/         Client helpers; often re-exports shared/ + browser-only logic
e2e/             Playwright critical-path specs (3 journeys)
```

**Where logic belongs**

| Kind of logic                                      | Put it in                        |
| -------------------------------------------------- | -------------------------------- |
| Money math, Zod schemas, validation rules          | `shared/`                        |
| Auth checks, DB access, guest privacy, rate limits | `convex/` or `convex/lib/`       |
| Browser storage, PWA, clipboard, Revolut launch    | `src/lib/`                       |
| Layout and interaction                             | `src/components/`, `src/routes/` |

Before duplicating logic, check whether `shared/` or `convex/lib/` already owns it. Many `src/lib/*.ts` files are thin re-exports.

## Host vs guest

Use terms from `CONTEXT.md`. At a high level:

- **Host** — authenticated bill owner. Routes like `/bills/$billId`, `/bills/$billId/summary`. Guarded by `requireAuth` / `requireBillOwner` on the server and `useRequireHostAuth` on the client.
- **Guest** — unauthenticated participant. Joins via `?t={shareToken}` → `/join` → `/claim`. Mutations require a valid guest session token (`convex/lib/requireGuestSession.ts`).

Guest-facing queries must not leak other participants' payment details. Respect existing privacy boundaries in `getForGuest` and related helpers.

## Imports and generated files

- **Aliases**: `#/*` and `@/*` map to `src/*`. Use `#/…` with `.ts`/`.tsx` extensions (`verbatimModuleSyntax: true`).
- **`shared/`**: import with relative paths from `src/` or `convex/` (no alias). Convex tsconfig includes `../shared/**/*`.
- **Do not edit**: `convex/_generated/*`, `src/routeTree.gen.ts`.
- **Regenerate routes** after adding/moving route files: `pnpm run generate-routes`.

## Convex

See `.cursorrules` for schema validator (`v`) and system-field conventions.

- New tables and indices go in `convex/schema.ts`.
- Put reusable server logic in `convex/lib/`, not duplicated across top-level modules.
- Secrets and server flags (`DEV_MODE`, OAuth keys, `GEMINI_API_KEY`) live in the **Convex Dashboard**, not Vercel.
- **`DEV_MODE=true`** is allowed only on dev deployments in the allowlist (`convex/lib/devMode.ts`). Never on production.

## UI and copy

- **Bulgarian only** — no i18n framework. User-facing strings are hardcoded in Bulgarian.
- Prefer centralized message modules when logic is shared across client and server:
  - `shared/guest-flow-messages.ts`
  - `shared/combined-payment-messages.ts`
  - `src/lib/destructive-action-copy.ts` (confirm dialogs)
- Use domain vocabulary from `CONTEXT.md` in UI labels, issue titles, and test names.

Install new shadcn components with:

```bash
pnpm dlx shadcn@latest add <component>
```

## Testing

| Layer     | Command                 | Convention                                                              |
| --------- | ----------------------- | ----------------------------------------------------------------------- |
| Unit      | `pnpm run test`         | `*.test.ts` / `*.test.tsx` colocated with source                        |
| E2E       | `pnpm run test:e2e`     | `e2e/*.spec.ts` — needs `npx convex dev` + `DEV_MODE` on dev deployment |
| Full gate | `pnpm run ci:preflight` | Prettier + ESLint + Vitest + PWA icons + production build               |

**Testing priorities**

1. **`shared/`** — primary home for business-logic tests (calculations, schemas, validation).
2. **`convex/lib/`** — server-only rules (auth, draft assertions, dev mode).
3. **`src/lib/`** — client adapters and browser helpers.
4. **`e2e/`** — only for critical browser journeys; see `e2e/README.md`.

Vitest excludes `e2e/**` and `.worktrees/**`. Local git worktrees under `.worktrees/` are ignored by git and tooling — do not commit them.

When implementing from a spec or ticket, prefer `/tdd` at agreed seams (usually `shared/` or `convex/lib/`).

## Local development

Two terminals:

```bash
npx convex dev    # terminal 1
pnpm run dev      # terminal 2 — http://localhost:3000
```

Copy `.env.example` → `.env.local` and set `VITE_CONVEX_URL`. Enable `DEV_MODE=true` on the **Convex dev deployment** for password dev auth.

## Before finishing

1. Run `pnpm run ci:preflight` (the pre-commit hook runs this automatically).
2. If you touched guest/host browser flows, run E2E locally per `e2e/README.md`.
3. If you changed routes, run `pnpm run generate-routes` and commit `src/routeTree.gen.ts` if it changed.
4. If you changed schema shape for existing data, note whether a manual `npx convex run backfill:*` is needed (see `docs/DEPLOY.md`).
5. Use `/code-review` on substantial changes before opening a PR.

## Common pitfalls

- Editing generated files instead of their sources.
- Putting business logic only in React components instead of `shared/` or `convex/lib/`.
- Confusing **client** dev mode (`import.meta.env.DEV`) with **server** `DEV_MODE` — both are needed for local auto-auth.
- Using English in user-facing copy.
- Drifting from `CONTEXT.md` terms (e.g. calling a Guest a "member" or the host's seat a "guest").
- Assuming E2E runs in CI — it is optional unless `E2E_VITE_CONVEX_URL` is configured.

## Related docs

- `CONTEXT.md` — domain glossary (required reading)
- `README.md` — setup and scripts
- `docs/DEPLOY.md` — env matrix, deploy path, security notes, backfills
- `e2e/README.md` — Playwright prerequisites and failure modes
- `.cursorrules` — Convex schema specifics
