# Host Authentication — Design Spec

**Date:** 2026-07-08  
**Project:** onova-za-smetkata  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`, `docs/superpowers/specs/2026-07-07-guest-qr-claim-flow-design.md`

## Summary

Add **host authentication** so each signed-in user manages only their own bills and payment settings. **Guest join/claim routes stay public** — anyone with a bill link or QR can still pick a name and claim items. Sign-in supports **Google OAuth** and **email magic links** via Convex Auth.

**Security is enforced in Convex**, not only in the UI. Host mutations and queries call `requireAuth()` and `requireBillOwner()` server-side. Frontend login redirects are a UX layer on top.

**Existing database data is not migrated.** Dev/prod can be cleared before deploy; all bills after auth require an `ownerId`.

## Decisions

| Decision | Choice |
|----------|--------|
| Auth scope | Host routes only; guest `/join` and `/claim` remain public |
| Security model | **Backend-enforced** (Convex guards) + UI redirects for UX |
| User growth | Start minimal; architecture supports many users later |
| Sign-in methods | Google OAuth + email magic link (Resend) |
| Auth library | Convex Auth (`@convex-dev/auth`) |
| Legacy data | **Ignore / wipe** — no migration, no orphan-bill support |
| Guest Revolut | Read **bill owner's** payment settings via `getForGuest` |
| SSR auth | Client-side route guards only (PWA; Convex Auth SSR still beta) |

## Security model

### Two layers

| Layer | Role | Sufficient alone? |
|-------|------|-------------------|
| **Convex functions** | `requireAuth`, `requireBillOwner` on host APIs | **Yes** — real enforcement |
| **React routes** | Redirect unauthenticated users from host pages to `/login` | No — UX only |

An attacker with the Convex client can bypass the UI but **cannot** call host mutations without a valid auth token, and cannot access another user's bills even with a guessed bill ID on host endpoints.

### Public by design (guest table flow)

These remain callable without login:

- `bills.getForGuest`
- `paymentSettings.getForGuest`
- `guestSessions.*`
- `assignments.toggle`, `assignments.setUnits`

They validate bill existence, draft status, and guest session rules — not host identity.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  TanStack Start (React + Router)                            │
│  ConvexAuthProvider                                         │
│  Host routes → redirect to /login if !isAuthenticated       │
│  Guest routes → no redirect                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ JWT on every Convex request
┌──────────────────────────▼──────────────────────────────────┐
│  Convex Auth + host/guest function guards                     │
└─────────────────────────────────────────────────────────────┘
```

### Route access matrix

| Route | UI guard | Convex |
|-------|----------|--------|
| `/login` | Public | Auth HTTP routes |
| `/` | Host | `listWithSummary` requires auth |
| `/bills/$billId` | Host | `bills.get` requires owner |
| `/bills/$billId/summary` | Host | same |
| `/bills/$billId/join` | Public | `getForGuest` |
| `/bills/$billId/claim` | Public | `getForGuest` + guest mutations |

## Schema changes

### Auth tables

Add `authTables` from `@convex-dev/auth/server` to `convex/schema.ts`.

### `bills`

```ts
ownerId: v.id('users'),  // required on all new bills
```

Index: `by_ownerId_updatedAt` on `['ownerId', 'updatedAt']`.

**Pre-auth rows:** Clear deployment data before schema push, or leave stale rows in DB — host queries never return bills without matching `ownerId`, and `getForGuest` returns null for bills without `ownerId`.

### `paymentSettings`

Per-user (replaces singleton):

```ts
paymentSettings: defineTable({
  userId: v.id('users'),
  revolutUsername: v.optional(v.string()),
  iban: v.optional(v.string()),
  updatedAt: v.number(),
}).index('by_userId', ['userId']),
```

Delete existing singleton `paymentSettings` rows on deploy.

## Authorization helpers

New `convex/lib/auth.ts`:

```ts
export async function requireAuth(ctx): Promise<Id<'users'>>
export async function requireBillOwner(ctx, billId): Promise<Doc<'bills'>>
```

Uses `getAuthUserId` from `@convex-dev/auth/server`. Throws `ConvexError` with Bulgarian-friendly messages where appropriate.

## API surface

### Host-only (require auth + owner where applicable)

| Module | Functions |
|--------|-----------|
| `bills` | `list`, `listWithSummary`, `get`, `create`, `update`, `finalize`, `remove` |
| `participants` | `add`, `remove`, `listRecentNames` |
| `items` | `add`, `update`, `remove` |
| `assignments` | `assignAll` |
| `payments` | `add` |
| `paymentSettings` | `get`, `save` |
| `receiptScan` | all public exports |
| `files` | `generateUploadUrl`, `getUrl` |

### Guest-public

| Module | Functions |
|--------|-----------|
| `bills` | **`getForGuest`** — bill must exist and have `ownerId` |
| `paymentSettings` | **`getForGuest`** — resolves settings via bill owner |
| `guestSessions` | all |
| `assignments` | `toggle`, `setUnits` |

## Frontend changes

- `ConvexAuthProvider` replaces bare `ConvexProvider` wiring
- New `/login` page (Google + magic link, Bulgarian copy)
- Host route `beforeLoad` auth check with `redirect` param
- Guest pages: switch to `bills.getForGuest`, `paymentSettings.getForGuest`
- Header: sign-out on host routes

## External setup

| Service | Convex env vars |
|---------|-----------------|
| Google OAuth | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Resend magic link | `AUTH_RESEND_KEY` |
| Redirect base | `SITE_URL` (prod Netlify URL) |

Google redirect URI: `{CONVEX_SITE_URL}/api/auth/callback/google`

## Data reset (before first auth deploy)

No migration scripts. Recommended:

1. Open Convex dashboard → Data → delete all rows in app tables (or wipe dev deployment)
2. Push schema with `ownerId` + `authTables`
3. Fresh bills created after login only

## Testing

### Manual QA

1. Google sign-in → create bill → visible on home
2. Second account → empty home (isolation)
3. Direct Convex call to `bills.list` without auth → error
4. Guest join/claim without login → works
5. Guest Revolut uses host's username
6. Magic link sign-in

## Out of scope (v1)

- Guest authentication
- Per-bill link revocation
- Legacy data migration
- SSR auth middleware
- Rate limiting on guest mutations

## Approval

- [x] User approved design
- [x] Spec reviewed
- [x] Implementation plan written (`docs/superpowers/plans/2026-07-08-host-auth.md`)
