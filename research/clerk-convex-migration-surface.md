# Clerk + Convex + TanStack Start — migration surface from `@convex-dev/auth`

Research for wayfinder map **#103** / question **#105**.

**Scope:** Host authentication only. Guest flows use `guestSessions` + `sessionToken` and are orthogonal to the host auth provider.

**Current stack:** TanStack Start, `@convex-dev/auth` (Google OAuth, Resend magic link, Password dev provider), Convex, Vercel.

---

## Executive summary

| Area               | Impact                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host auth provider | **Replace entirely** — `@convex-dev/auth` → Clerk + `convex/react-clerk`                                                                            |
| Guest auth         | **Unchanged** — `requireGuestSession`, `guestSessions`, share tokens                                                                                |
| Identity model     | **High risk** — `getAuthUserId()` returns `Id<'users'>` today; Clerk gives a string `subject`. All `ownerId` / `userId` FKs need a mapping strategy |
| Dev mode / E2E     | **Rework required** — Password auto-sign-in and `DEV_MODE` Convex env no longer apply                                                               |
| Deploy / env       | **Swap** — remove Convex JWT/OAuth/Resend auth vars; add Clerk + `CLERK_JWT_ISSUER_DOMAIN` on Convex                                                |
| Rough effort       | **M–L** (M if no prod user data to migrate; **L** with live prod users + E2E + deploy runbook)                                                      |

---

## Official integration pattern

Sources: [Convex Clerk auth](https://docs.convex.dev/auth/clerk), [Clerk ↔ Convex integration](https://clerk.com/docs/guides/development/integrations/databases/convex), [Clerk TanStack Start quickstart](https://github.com/clerk/clerk-tanstack-react-start-quickstart).

### 1. Clerk dashboard

1. Create Clerk application (separate dev / prod instances recommended).
2. Enable sign-in methods matching product needs: **Google**, **Email** (magic link or code — replaces Resend provider).
3. Create a JWT template named **`convex`** with standard Clerk claims. Convex validates tokens where `applicationID` matches `"convex"`.
4. Note **Frontend API URL** (issuer), e.g. `https://verb-noun-00.clerk.accounts.dev` (dev) or custom domain (prod).

### 2. Convex backend — `convex/auth.config.ts`

Replace the current `@convex-dev/auth`-oriented config (`CONVEX_SITE_URL`) with Clerk issuer domain:

```ts
import type { AuthConfig } from 'convex/server'

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig
```

Set `CLERK_JWT_ISSUER_DOMAIN` on **each** Convex deployment (dev + prod) in Dashboard → Settings → Environment.

Run `npx convex dev` / deploy after changing auth config so Convex picks up the new provider.

### 3. React client — provider nesting

**ClerkProvider** must wrap **ConvexProviderWithClerk**. Pass Clerk's `useAuth` so Convex can attach JWTs to websocket subscriptions and mutations.

For TanStack Start, prefer **`@clerk/tanstack-react-start`** (not `@clerk/clerk-react`) for `ClerkProvider`, `useAuth`, and server `auth()`.

```tsx
import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {children}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

This repo uses `@convex-dev/react-query`'s `ConvexQueryClient` in `src/integrations/convex/provider.tsx`. The same nesting applies: `ClerkProvider` → `ConvexProviderWithClerk` → app (and any QueryClient wiring). See [Convex react-query + Clerk example](https://github.com/get-convex/convex-backend/blob/main/npm-packages/@convex-dev/react-query/README.md).

### 4. TanStack Start server middleware

Register Clerk request middleware so server routes / loaders can call `auth()`:

```ts
import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createStart } from '@tanstack/react-start'

export const startInstance = createStart(() => ({
  requestMiddleware: [clerkMiddleware()],
}))
```

**Note:** This repo does not yet define a `createStart` entry file; adding one is part of the migration. Host routes today rely on **client-side** `useRequireHostAuth` redirects, not server `beforeLoad` auth — that pattern can remain initially.

### 5. Convex function auth (server)

Replace `getAuthUserId(ctx)` from `@convex-dev/auth/server` with:

```ts
const identity = await ctx.auth.getUserIdentity()
if (identity === null) throw new ConvexError('Изисква се вход')
// identity.subject  → Clerk user ID (string)
// identity.email, identity.name, identity.pictureUrl → optional profile claims
```

**Critical:** `identity.subject` is **not** `Id<'users'>`. The app must resolve (or create) a Convex `users` row and use its `_id` for `ownerId`, `paymentSettings.userId`, etc.

Recommended patterns from Convex docs:

- **Lazy upsert on first authenticated call** — query `users` by `clerkSubject` index; insert if missing.
- **Clerk webhooks** (`user.created` / `user.updated`) → Convex HTTP action → upsert `users` (keeps profile in sync; adds webhook verification + HTTP route).

---

## Current auth architecture (baseline)

### Provider stack

```text
RootDocument (__root.tsx)
  └─ ConvexProvider (provider.tsx)
       └─ ConvexAuthProvider (@convex-dev/auth/react)
            └─ DevAutoSignIn (dev password sign-in)
```

### Convex auth module

| File                    | Role                                                     |
| ----------------------- | -------------------------------------------------------- |
| `convex/auth.ts`        | `convexAuth({ providers: [Google, Resend, Password?] })` |
| `convex/http.ts`        | `auth.addHttpRoutes(http)` — OAuth callbacks, magic link |
| `convex/auth.config.ts` | JWT issuer = `CONVEX_SITE_URL` (convex-dev-auth)         |
| `convex/schema.ts`      | `...authTables` + app `users` table                      |
| `convex/lib/auth.ts`    | `requireAuth` → `getAuthUserId` → `Id<'users'>`          |
| `convex/lib/devMode.ts` | Gates Password provider + documents E2E allowlist        |

### Client auth touchpoints

| File                                                          | APIs used                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/integrations/convex/provider.tsx`                        | `ConvexAuthProvider`                                       |
| `src/routes/login.tsx`                                        | `useConvexAuth`, `useAuthActions`, Google + Resend sign-in |
| `src/hooks/use-require-host-auth.ts`                          | `useConvexAuth`, redirect to `/login`                      |
| `src/components/auth/dev-auto-sign-in.tsx`                    | Password `signIn('password', …)`                           |
| `src/components/layout/app-header-menu.tsx`                   | `useAuthActions().signOut`                                 |
| `src/components/layout/app-footer.tsx`                        | `useConvexAuth`                                            |
| `src/components/layout/app-header.tsx`                        | `useConvexAuth`                                            |
| `src/components/profile/profile-sheet.tsx`                    | `useConvexAuth`                                            |
| `src/components/bills/payment-settings-provider.tsx`          | `useConvexAuth`                                            |
| `src/components/host-onboarding/host-onboarding-provider.tsx` | `useConvexAuth`                                            |

Host-protected routes (client guard): `/`, `/bills/$billId`, `/bills/$billId/summary`, `/bills/$billId/claim` (host preview).

### Server auth touchpoints

All host mutations/queries use `requireAuth` / `requireBillOwner` / direct `getAuthUserId`:

- `convex/bills.ts`, `participants.ts`, `items.ts`, `assignments.ts`, `payments.ts`, `combinedPayments.ts`, `receiptScan.ts`, `files.ts`, `friendGroups.ts`, `hostOnboarding.ts`, `paymentSettings.ts`, `users.ts`
- `convex/lib/assertCanMutateAssignment.ts` — host **or** guest session (guest path unchanged)

### Dependencies to remove

- `@convex-dev/auth`
- `@auth/core` (Google, Resend providers)
- Convex-side: `convex/lib/magicLinkEmail.ts`, Resend env vars, JWT key generation workflow

### Dependencies to add

- `@clerk/tanstack-react-start`
- `convex/react-clerk` (ships with `convex` package)

---

## File-by-file migration checklist

### Delete or replace

| File                                       | Action                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `convex/auth.ts`                           | **Delete** — no `convexAuth`, no Password/Google/Resend providers                                      |
| `convex/http.ts`                           | **Remove** `auth.addHttpRoutes` — keep router only if other HTTP routes added (e.g. Clerk webhooks)    |
| `convex/lib/magicLinkEmail.ts`             | **Delete** (Clerk handles email)                                                                       |
| `src/components/auth/dev-auto-sign-in.tsx` | **Replace** with Clerk-aware dev/E2E strategy (see Dev mode section)                                   |
| `src/routes/login.tsx`                     | **Replace** with Clerk `<SignIn />` / redirect to Clerk hosted sign-in, or remove route if using modal |

### Rewrite (core)

| File                                            | Changes                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/auth.config.ts`                         | Clerk `CLERK_JWT_ISSUER_DOMAIN`, `applicationID: 'convex'`                                                                                                          |
| `convex/schema.ts`                              | Remove `authTables`; extend `users` with `clerkSubject: v.string()` + `.index('by_clerkSubject', ['clerkSubject'])`; plan deprecation of auth-only fields if unused |
| `convex/lib/auth.ts`                            | `requireAuth` resolves Clerk `subject` → `Id<'users'>` via upsert/lookup helper                                                                                     |
| `convex/users.ts`                               | `viewer` uses new resolver; optional `ensureCurrentUser` mutation                                                                                                   |
| `convex/lib/assertCanMutateAssignment.ts`       | Replace `getAuthUserId` with new `requireAuth` / owner lookup                                                                                                       |
| `src/integrations/convex/provider.tsx`          | `ClerkProvider` + `ConvexProviderWithClerk`; drop `ConvexAuthProvider`                                                                                              |
| `src/routes/__root.tsx`                         | ClerkProvider placement (may move entirely into `provider.tsx`)                                                                                                     |
| **New:** `src/start.ts` (or project convention) | `createStart` + `clerkMiddleware()`                                                                                                                                 |

### Update (client hooks / UI)

| File                                        | Changes                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/hooks/use-require-host-auth.ts`        | `useAuth()` from Clerk — `isSignedIn`, `isLoaded` instead of `useConvexAuth`                            |
| `src/routes/login.tsx`                      | Clerk sign-in UI; preserve `redirect` search param via Clerk `forceRedirectUrl` / `fallbackRedirectUrl` |
| `src/components/layout/app-header-menu.tsx` | `useClerk().signOut()` or `<SignOutButton />`                                                           |
| All `useConvexAuth` consumers (6 files)     | Map to Clerk `useAuth` or `useUser`                                                                     |

### Update (docs / config / CI)

| File                                        | Changes                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `package.json`                              | Swap auth deps                                                                                          |
| `docs/DEPLOY.md`                            | Remove `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_*`, `SITE_URL` auth rows; add Clerk + `CLERK_JWT_ISSUER_DOMAIN` |
| `docs/google-oauth-setup.md`                | Obsolete for app OAuth — Google moves to Clerk dashboard                                                |
| `e2e/README.md`, `e2e/helpers/host-auth.ts` | New host auth prerequisites                                                                             |
| `.cursor/rules/convex.mdc`, `project.mdc`   | Document Clerk as auth source                                                                           |
| `convex/lib/devMode.ts`                     | Remove Password gating or repurpose for non-auth dev flags                                              |

### Optional (recommended for prod)

| Item                              | Purpose                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Convex HTTP route + Clerk webhook | Sync `users` on create/update/delete                                             |
| Server-side route guards          | `beforeLoad` + `auth()` for host routes (defense in depth; not required day one) |
| Data migration script             | Link existing `users` rows to Clerk accounts by verified email                   |

---

## Guest auth boundary — unchanged?

**Yes, functionally unchanged.**

Guest authorization does not use `@convex-dev/auth`:

| Mechanism                 | Location                            | Clerk impact                                                               |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| Share token join          | `?t={shareToken}` → `/join`         | None                                                                       |
| Guest session token       | `guestSessions.sessionToken`        | None                                                                       |
| `requireGuestSession`     | `convex/lib/requireGuestSession.ts` | None                                                                       |
| Guest mutations           | Pass `sessionToken` in args         | None                                                                       |
| Host-or-guest assignments | `assertCanMutateAssignment`         | Only the **host branch** (`getAuthUserId`) changes; guest branch identical |

No Clerk session is required for guests. Do not wrap guest routes in `ClerkProvider` gates beyond the global provider (Clerk allows signed-out usage).

---

## Dev mode / E2E impact

### Today

| Layer                        | Behavior                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Convex `DEV_MODE=true`       | Enables Password provider on allowlisted dev deployments                             |
| Client `import.meta.env.DEV` | `DevAutoSignIn` calls `signIn('password', …)`                                        |
| E2E                          | `openHostContext` waits for **„Нова сметка“** — assumes auto host sign-in within 45s |

Documented in `e2e/README.md`, `e2e/helpers/host-auth.ts`, `convex/lib/devMode.ts`.

### After Clerk migration

Password provider and `auth:signIn` HTTP routes **go away**. Options for dev/E2E (pick one or combine):

1. **Clerk Development instance + test user** — create a dedicated Clerk user; E2E performs UI sign-in once per context (slower, realistic).
2. **Clerk Testing Tokens** — [Clerk testing docs](https://clerk.com/docs/testing/overview) for programmatic auth in Playwright (recommended for CI stability).
3. **Clerk `signInToken` API** — backend creates a one-time sign-in token; E2E navigates to completion URL (good for headless, requires `CLERK_SECRET_KEY` in E2E env).
4. **Retain a Convex-only dev bypass** — e.g. internal mutation gated by `DEV_MODE` that mints a guest-like host override. **Not recommended** — duplicates auth, bypasses Clerk, security footgun.

`DEV_MODE` on Convex currently gates Password auth only. After migration it either:

- **Removed** entirely, or
- **Repurposed** for unrelated dev flags (OCR mocks, etc.) — do not use for auth bypass in prod-like paths.

**E2E checklist updates:**

- Remove prerequisites referencing `DEV_MODE` + Password provider.
- Add `VITE_CLERK_PUBLISHABLE_KEY` to `.env.local` / CI secrets.
- Add E2E Clerk secret / testing token strategy.
- Update `E2E_HOST_AUTH_MESSAGE` copy in `host-auth.ts`.
- Revisit `host-onboarding.spec.ts` if it depends on dev welcome + auto sign-in timing.

---

## Identity mapping risk (`users` table, `ownerId`)

### Current model

```ts
// convex/lib/auth.ts — today
const userId = await getAuthUserId(ctx) // Id<'users'> directly from auth session
return userId // used as bills.ownerId, paymentSettings.userId, etc.
```

`authTables` from `@convex-dev/auth` manages auth sessions/accounts and links them to the app `users` table. `getAuthUserId` returns the **Convex document ID** of the authenticated user row.

### Post-Clerk model

```ts
const identity = await ctx.auth.getUserIdentity()
// identity.subject === Clerk user ID, e.g. "user_2abc..."
// NOT Id<'users'>
```

Every FK to `users` remains valid **only if** the same Convex `users` row is resolved for each Clerk account.

### Schema change (minimum)

```ts
users: defineTable({
  clerkSubject: v.string(), // NEW — Clerk user ID
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  // ... existing fields (username, image, etc.)
})
  .index('by_clerkSubject', ['clerkSubject'])
  .index('email', ['email'])
```

Remove `...authTables` once migration completes (orphaned tables can be dropped in a follow-up Convex migration).

### Risks

| Risk                                             | Severity                        | Mitigation                                                                                                        |
| ------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Existing prod `users` / `bills.ownerId` orphaned | **High** if prod has real hosts | One-time migration: match by verified `email` → set `clerkSubject` on first Clerk sign-in; or manual admin script |
| Duplicate user rows                              | Medium                          | Unique index on `clerkSubject`; upsert idempotent on `subject`                                                    |
| `viewer` query returns null after sign-in        | Medium                          | Call `ensureCurrentUser` from client after Clerk load, or webhook upsert                                          |
| Dev user `dev@local.test`                        | Low (dev only)                  | Create matching Clerk test user or use Testing Tokens                                                             |
| Guest/host confusion                             | Low                             | Guests never get `users` rows — unchanged                                                                         |

### Tables referencing `Id<'users'>`

- `bills.ownerId`
- `paymentSettings.userId`
- `friendGroups.userId`
- `hostOnboarding.userId`

A broken mapping means hosts lose access to their bills (ownership checks fail) or see empty dashboards. **Plan data migration before cutover** if production deployment `coordinated-warbler-782` has non-test users.

### Suggested `requireAuth` shape (target)

```ts
export async function requireAuth(ctx): Promise<Id<'users'>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity?.subject) throw new ConvexError('Изисква се вход')

  const existing = await ctx.db
    .query('users')
    .withIndex('by_clerkSubject', (q) => q.eq('clerkSubject', identity.subject))
    .unique()

  if (existing) return existing._id

  // First sign-in: optionally link by email, else insert
  return await ctx.db.insert('users', {
    clerkSubject: identity.subject,
    email: identity.email,
    name: identity.name,
    image: identity.pictureUrl,
  })
}
```

Enhance with email-based linking for migration (only when `emailVerificationTime` equivalent is trusted — Clerk verifies email).

---

## Environment variable delta

### Remove from Convex Dashboard

| Variable                               | Was used for                     |
| -------------------------------------- | -------------------------------- |
| `JWT_PRIVATE_KEY`, `JWKS`              | `@convex-dev/auth` token signing |
| `SITE_URL`                             | Magic link / OAuth redirect base |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth                     |
| `AUTH_RESEND_KEY`, `AUTH_RESEND_FROM`  | Magic link email                 |
| `DEV_MODE` (auth meaning)              | Password provider                |

### Add

| Variable                     | Where                          | Purpose                            |
| ---------------------------- | ------------------------------ | ---------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN`    | Convex (dev + prod)            | JWT validation in `auth.config.ts` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Vercel / `.env.local`          | Client ClerkProvider               |
| `CLERK_SECRET_KEY`           | Vercel server / TanStack Start | `clerkMiddleware`, webhooks        |
| Clerk webhook signing secret | Convex (if webhooks)           | Verify Clerk → Convex HTTP         |

Google OAuth redirect URIs move from `*.convex.site/api/auth/callback/google` to **Clerk-managed** callback URLs in Clerk dashboard.

---

## Login UX notes

Current `login.tsx` copy (Bulgarian) explains guests use QR without sign-in — preserve that messaging on the new sign-in surface.

Clerk options:

- **Embedded** `<SignIn />` / `<SignIn routing="hash" />` on `/login`
- **Hosted** Clerk Account Portal — less UI code, less control over BG copy
- **Google One Tap** — optional via Clerk

Magic link email branding moves from `convex/lib/magicLinkEmail.ts` to **Clerk email templates** in dashboard.

Sign-out today: `useAuthActions().signOut()` in header menu → Clerk `signOut()` or `<SignOutButton />`.

---

## Rough effort estimate

| Workstream                                       | Size    | Notes                                           |
| ------------------------------------------------ | ------- | ----------------------------------------------- |
| Clerk + Convex provider wiring                   | **S**   | `provider.tsx`, `auth.config.ts`, packages, env |
| TanStack Start `clerkMiddleware` + `createStart` | **S**   | New file; verify Nitro/Vercel SSR               |
| Rewrite `requireAuth` + `users` schema           | **M**   | Upsert, indexes, `viewer`                       |
| Replace client auth hooks (7+ files)             | **S–M** | Mechanical but broad                            |
| Login page → Clerk UI                            | **S**   | Preserve redirect + BG copy                     |
| Remove `@convex-dev/auth` + HTTP auth routes     | **S**   | Include `authTables` schema cleanup             |
| **Prod identity migration**                      | **M–L** | Email linking script, validation, rollback plan |
| Dev mode + E2E rework                            | **M**   | Testing tokens, docs, CI secrets                |
| Deploy runbook + ADR update                      | **S**   | `DEPLOY.md`, OAuth doc retirement               |

**Overall: M** (staging / no prod users) · **L** (prod hosts with existing bills)

Suggested sequencing:

1. Clerk dev instance + Convex dev deployment — prove `ConvexProviderWithClerk` + `requireAuth` upsert.
2. E2E strategy spike (Testing Tokens) before deleting Password provider.
3. Data migration design + dry run on prod snapshot.
4. Prod cutover — Clerk prod instance, env swap, monitor ownership errors.

---

## References

- [Convex — Clerk authentication](https://docs.convex.dev/auth/clerk)
- [Convex — Storing users in the database](https://docs.convex.dev/auth/database-auth)
- [Clerk — Convex integration guide](https://clerk.com/docs/guides/development/integrations/databases/convex)
- [Clerk — TanStack Start quickstart](https://github.com/clerk/clerk-tanstack-react-start-quickstart)
- [Clerk — Testing overview](https://clerk.com/docs/testing/overview)
- Repo baseline: `convex/auth.ts`, `convex/lib/auth.ts`, `convex/schema.ts`, `src/integrations/convex/provider.tsx`, `e2e/helpers/host-auth.ts`
