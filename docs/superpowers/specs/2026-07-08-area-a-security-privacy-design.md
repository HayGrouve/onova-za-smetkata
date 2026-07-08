# Area A — Security & Privacy (Scoped Design)

**Date:** 2026-07-08  
**Status:** Scoped — ready for implementation plans  
**Parent audit:** `docs/superpowers/specs/2026-07-08-application-audit.md`  
**Findings covered:** SEC-1 through SEC-7

---

## Summary

This spec scopes **Area A** from the application audit into implementable work. It makes one product/security decision explicit, then defines concrete changes for each finding.

**Recommended delivery:** three phases — hotfixes first (no link breakage), then share-token capability model, then hardening.

---

## Goals

1. Close real vulnerabilities (`files.getUrl` IDOR, dev-auth fail-open).
2. Make guest access **deliberate**: revocable share links, not raw `billId` as secret.
3. Stop finalized-bill **participant impersonation**.
4. Reduce abuse surface (uploads, guest mutation spam, claim lockout).
5. Document accepted risks for accountless guest identity.

## Non-goals (Area A)

- Full user accounts for guests / per-person magic links (future Option 2).
- GDPR/legal compliance review.
- Read-side rate limiting on Convex queries (deferred; token + rotation mitigates scraping).
- Payment corrections, money-logic consolidation (Area B).
- IBAN surfacing to guests (Area C; depends on SEC-4 token gating).

---

## Anchor decision: capability links with share tokens

**Chosen model:** **Option 1 — Capability links**

| Principle | Decision |
|-----------|----------|
| Who may view/join a bill? | Anyone with **`billId` + `shareToken`** (secret link). |
| Is `billId` alone sufficient? | **No** — after migration, guest APIs reject missing/invalid token. |
| Revocation | Host rotates token → old links die. |
| Finalized bills | Same link; **session locking applies** (no impersonation). |
| Receipt images | Host-only via ownership; **never** expose `receiptStorageId` to guests. |

**Join URL format:**

```
https://onova-za-smetkata.com/bills/{billId}/join?t={shareToken}
```

- `billId` stays in the path (routing unchanged).
- `t` query param is the capability secret (short, share-friendly).
- QR codes and copy-link include `?t=`.

**Why not path-only token (`/join/{token}`)?** Larger route refactor; query param achieves the same security with less churn.

---

## Threat model (Area A)

| Threat | Before | After |
|--------|--------|-------|
| Host A reads Host B's receipt | 🔴 Any `storageId` | ✅ `getUrl` scoped to owned bill |
| Leaked join link | 🟡 Permanent, `billId`-only | ✅ Rotatable token; invalid without `t` |
| Final bill: pick any name | 🔴 All names open | ✅ Same “Заето” rules as draft |
| `DEV_MODE` on wrong deployment | 🔴 Fixed password auth | ✅ Dev auth only on explicit dev allowlist |
| Storage fill / upload spam | 🟡 Unbounded uploads | ✅ Bill-scoped + rate limit |
| Claim spam blocks table | 🟡 Shared per-bill bucket | ✅ Per-actor + per-bill limits |
| Guest name hijack after 90s idle | 🟡 Accepted | 🟡 Documented; partial mitigation via final lock |

---

## SEC-1 🔴 — Fix `files.getUrl` IDOR

### Problem

Authenticated hosts can fetch any storage object by ID.

### Design

**Replace** `files.getUrl({ storageId })` with **`files.getReceiptUrl({ billId })`**:

```ts
// convex/files.ts
export const getReceiptUrl = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    if (!bill.receiptStorageId) return null
    return await ctx.storage.getUrl(bill.receiptStorageId)
  },
})
```

**Remove** the old `getUrl` export (no backward-compat shim — internal app only).

### Client updates

| File | Change |
|------|--------|
| `src/routes/bills/$billId/index.tsx` | `getReceiptUrl({ billId })` |
| `src/components/bills/receipt-preview-card.tsx` | Pass `billId` instead of `storageId` |

### Guest receipt access

- **Do not** add guest receipt URL in Area A.
- **`getForGuest`** must **omit** `receiptStorageId` from the returned `bill` object (see SEC-4 response shaping).

### Acceptance criteria

- [ ] No Convex function accepts arbitrary `_storage` id from clients.
- [ ] Cross-owner receipt fetch returns error / null.
- [ ] Existing host receipt preview still works.

---

## SEC-3 🔴 — Dev auth fail-closed

### Problem

`DEV_MODE=true` enables fixed-credential Password provider on any deployment except a hardcoded prod slug list.

### Design

**Invert the gate:** dev Password provider enabled only when **all** are true:

1. `DEV_MODE === 'true'`
2. Deployment is on an **explicit dev allowlist**

**Allowlist sources (first match wins):**

```ts
// convex/lib/devMode.ts
const DEV_DEPLOYMENT_SLUGS = [
  'striped-shepherd-984', // current dev — or read from env
] as const

export function isDevModeEnabled(): boolean {
  if (process.env.DEV_MODE !== 'true') return false
  const deployment = normalizeDeploymentName(process.env.CONVEX_DEPLOYMENT ?? '')
  // Optional: CONVEX_DEV_DEPLOYMENTS=comma,separated,slugs
  const fromEnv = process.env.CONVEX_DEV_DEPLOYMENTS?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  const allowlist = [...DEV_DEPLOYMENT_SLUGS, ...fromEnv]
  return allowlist.includes(deployment)
}
```

**Remove** `PROD_DEPLOYMENT_SLUGS` negative check — prod is secure by default when not on allowlist.

**Keep** hardcoded prod slug block as **defense in depth** (if `DEV_MODE=true` on prod slug, always false).

### Client

- `DevAutoSignIn` unchanged — only runs when `import.meta.env.DEV` and provider exists.

### Tests

- `isDevModeEnabled()` returns `false` when `DEV_MODE` unset.
- Returns `false` when `DEV_MODE=true` but deployment not in allowlist.
- Returns `true` only for allowlisted dev deployment.
- Returns `false` for `coordinated-warbler-782` even if `DEV_MODE=true`.

### Docs

- Update `docs/DEPLOY.md` and `e2e/README.md`: dev slug must be in allowlist / `CONVEX_DEV_DEPLOYMENTS`.

### Acceptance criteria

- [ ] Unknown deployment + `DEV_MODE=true` → no Password provider.
- [ ] E2E dev deployment documented and allowlisted.

---

## SEC-4 🟡 — Share token capability model

### Schema

```ts
// convex/schema.ts — bills table
shareToken: v.string(),
```

**Index:** `.index('by_shareToken', ['shareToken'])` — optional; lookup is always `billId` + token compare.

### Token generation

- On **`bills.create`**: `shareToken = crypto.randomUUID()` (or 32-byte hex).
- **Backfill** mutation/script: `backfill:shareTokens` — set token for bills missing one.

### Server helper

```ts
// convex/lib/guestAccess.ts
export async function assertShareToken(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
  shareToken: string,
): Promise<Doc<'bills'>> {
  const bill = await ctx.db.get(billId)
  if (!bill?.ownerId) throw new ConvexError('Сметката не е намерена.')
  if (!shareToken || bill.shareToken !== shareToken) {
    throw new ConvexError('Невалиден или изтекъл линк за споделяне.')
  }
  return bill
}
```

Use in **all guest-facing** queries/mutations:

| Function | Add `shareToken: v.string()` |
|----------|------------------------------|
| `bills.getForGuest` | ✅ Required |
| `paymentSettings.getForGuest` | ✅ Required |
| `guestSessions.listActiveForBill` | ✅ Required |
| `guestSessions.claim` | ✅ Required |
| `guestSessions.heartbeat` | ✅ Required |
| `guestSessions.release` | ✅ Required |
| Guest assignment mutations | ✅ Via `requireGuestSession` — validate token matches bill at session creation (claim) and optionally re-check on mutation |

### Response shaping (`getForGuest`)

Return a **sanitized** bill object:

```ts
{
  _id, restaurantName, date, note, status, tipCents, createdAt, updatedAt
  // EXCLUDE: ownerId, receiptStorageId, shareToken
}
```

### Host: rotate token

```ts
// convex/bills.ts
export const rotateShareToken = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const shareToken = crypto.randomUUID()
    await ctx.db.patch(args.billId, { shareToken, updatedAt: Date.now() })
    return { shareToken }
  },
})
```

UI: “Обнови линка” in `bill-invite-card.tsx` with confirm (“Старите линкове ще спрат да работят”).

### Client / routes

**URL builder** — `src/lib/bill-join-url.ts`:

```ts
export function buildBillJoinPath(billId: string, shareToken: string): string {
  const params = new URLSearchParams({ t: shareToken })
  return `/bills/${billId}/join?${params}`
}
```

**Join route** — `src/routes/bills/$billId/join.tsx`:

- Read `t` from search params (`validateSearch` or `useSearch`).
- Pass `shareToken: t` to all guest Convex calls.
- If `t` missing → show “Невалиден линк” (not generic loading forever).

**Claim route** — persist token in session storage alongside guest session:

```ts
// guest-participant-session.ts
{ billId, participantId, sessionToken, shareToken }
```

**Invite card / QR / share** — include token in generated URLs.

### Migration & rollout

1. Deploy schema + backfill on prod: `npx convex run backfill:shareTokens`
2. Deploy backend requiring token (fail closed).
3. Deploy frontend emitting tokenized links.
4. **Old links without `?t=` stop working** — acceptable; document in release notes.

### Acceptance criteria

- [ ] `getForGuest({ billId })` without token → error/null.
- [ ] Join/claim/payment guest flows work with full URL.
- [ ] Rotate invalidates old URL.
- [ ] Guest responses never include `receiptStorageId` or `shareToken`.

---

## SEC-2 🔴 — Finalized bill impersonation

### Problem

On `status === 'final'`, join UI skips “Заето” and backend `claim` allows claiming any participant without conflict checks.

### Design

**Backend** — `guestSessions.claim` when `bill.status === 'final'`:

- Apply **same active-session conflict rules** as draft (reject if another active session holds `participantId`).
- Allow **re-claim** only for same `sessionToken` (resume) or expired session.
- Remove the special-case branch that always inserts (lines 75–91 today).

**Frontend** — `join.tsx`:

- Remove `bill.status === 'final'` branch that lists all names as clickable without `takenParticipantIds`.
- Use **one code path** for draft and final: show “Заето”, disable taken names.
- Copy for final: “Сметката е приключена — изберете името си, за да видите разбивката.”

**Claim page** — re-enable heartbeat on final if needed for session TTL consistency (optional; read-only still works with valid session).

### Acceptance criteria

- [ ] E2E `final-readonly.spec.ts` still passes.
- [ ] Second guest cannot claim name held by active session on **final** bill.
- [ ] Legitimate guest can resume with stored session.

---

## SEC-5 🟡 — Scoped uploads

### Design

```ts
export const generateUploadUrl = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const ownerId = await requireAuth(ctx)
    await requireBillOwner(ctx, args.billId)
    await assertRateLimit(ctx, `upload:${ownerId}`, 30, 60 * 60 * 1000) // 30/hour/user
    return await ctx.storage.generateUploadUrl()
  },
})
```

**Client:** pass `billId` from bill editor upload handler.

**Post-upload validation (client-side today, server on attach):**

- When setting `receiptStorageId` on bill, owner already required via `bills.update`.
- Optional: reject attach if file metadata unavailable (Convex limitation — document).

**Future:** track pending uploads table — out of scope unless abuse observed.

### Acceptance criteria

- [ ] Upload URL requires owned `billId`.
- [ ] Rate limit triggers after threshold.
- [ ] Receipt upload flow unchanged for host.

---

## SEC-6 🟡 — Guest mutation rate limits

### Claim lockout fix

**Current:** `claim:bill:${billId}` — 40/min shared → one griefer blocks everyone.

**New keys:**

```ts
// Per session token (or hash prefix) — prevents one actor burning shared budget
`claim:actor:${hash(sessionToken)}:bill:${billId}` — 10 / min
// Per bill — global ceiling
`claim:bill:${billId}` — 100 / min (raised; only blocks extreme abuse)
```

Use **both**: increment actor bucket first; if bill bucket exceeded, throw.

For **claim without session yet**, use a client-stable `deviceId` in sessionStorage (generate once) as actor key fallback:

```ts
`claim:device:${deviceId}:bill:${billId}`
```

Pass optional `deviceId` arg to `claim` mutation (string, max 64 chars).

### Other guest mutations

| Mutation | Limit |
|----------|-------|
| `guestSessions.heartbeat` | 120/min per `sessionToken` |
| `guestSessions.release` | 20/min per `sessionToken` |
| `assignments.toggle` | 60/min per `sessionToken` |
| `assignments.setUnits` | 60/min per `sessionToken` |

Implement via shared helper wrapping `requireGuestSession`.

### Read queries

Defer `getForGuest` rate limiting to Phase 2 (requires action/cron pattern or external WAF). Token rotation + non-enumerable token mitigates scraping.

### Acceptance criteria

- [ ] One client cannot exhaust claim budget for entire bill at 40/min.
- [ ] Assignment spam throttled with clear Bulgarian error.

---

## SEC-7 🟡 — Guest identity (accepted risk + mitigations)

### Accepted

- Guest identity = **claimed display name** + client-generated session token.
- 90s idle TTL allows name takeover if guest backgrounds app — **acceptable for “people at the table”** use case.

### Mitigations in Area A

1. SEC-2 session locking on **final** bills.
2. SEC-4 revocable links (mis-shared link can be rotated).
3. Document in `docs/DEPLOY.md` under Security notes.

### Out of scope (future)

- Host “lock roster” after first claim.
- Host approval for re-claim.
- Assignment audit log.

### Acceptance criteria

- [ ] Risk documented in deploy runbook.
- [ ] No code change required beyond SEC-2/SEC-4.

---

## Implementation phases

### Phase A1 — Hotfixes (no link format change)

| Task | Finding | Effort |
|------|---------|--------|
| A1.1 Replace `files.getUrl` with `getReceiptUrl(billId)` | SEC-1 | S |
| A1.2 Dev allowlist gate + tests | SEC-3 | S |
| A1.3 Deploy + verify | — | S |

**Ship first.** No guest URL changes.

### Phase A2 — Share tokens + final impersonation fix

| Task | Finding | Effort |
|------|---------|--------|
| A2.1 Schema: `shareToken` + index | SEC-4 | S |
| A2.2 Generate on create + backfill | SEC-4 | S |
| A2.3 `assertShareToken` + wire all guest APIs | SEC-4 | M |
| A2.4 Sanitize `getForGuest` bill payload | SEC-1, SEC-4 | S |
| A2.5 URL builders, join/claim token param + storage | SEC-4 | M |
| A2.6 Invite card / QR / share text with `?t=` | SEC-4 | S |
| A2.7 `rotateShareToken` + host UI | SEC-4 | S |
| A2.8 Fix final `claim` + join UI (SEC-2) | SEC-2 | M |
| A2.9 Update E2E + unit tests | All | M |
| A2.10 Prod backfill + deploy | SEC-4 | S |

### Phase A3 — Abuse hardening

| Task | Finding | Effort |
|------|---------|--------|
| A3.1 Bill-scoped upload + rate limit | SEC-5 | S |
| A3.2 Guest mutation rate limits + deviceId on claim | SEC-6 | M |
| A3.3 Document SEC-7 accepted risks | SEC-7 | S |

---

## Testing plan

### Unit (Convex / Vitest)

- `devMode.test.ts` — allowlist matrix.
- `guestAccess.test.ts` — token validation, sanitized bill shape.
- `rateLimit.test.ts` — actor vs bill keys (if extractable).

### Integration / E2E

- Update `e2e/*.spec.ts` to use join URLs with `?t=` (host fetches token from bill or test helper).
- `final-readonly` — impersonation blocked.
- `session-conflict` — still passes with token.
- Manual: rotate token → old link 403/error.

### Security regression checklist

- [ ] Cannot `getReceiptUrl` on another host's bill.
- [ ] Cannot `getForGuest` without token.
- [ ] Guest JSON has no `receiptStorageId`, `shareToken`, `ownerId`.
- [ ] Password sign-in fails on prod deployment with `DEV_MODE=true`.

---

## Files touched (expected)

| Area | Files |
|------|-------|
| Schema | `convex/schema.ts` |
| Backfill | `convex/backfill.ts` (new export) |
| Auth/dev | `convex/lib/devMode.ts`, `convex/auth.ts` |
| Files | `convex/files.ts` |
| Bills | `convex/bills.ts` |
| Guest | `convex/guestSessions.ts`, `convex/lib/guestAccess.ts` (new) |
| Payments guest | `convex/paymentSettings.ts` |
| Assignments | `convex/assignments.ts` (rate limits) |
| Client URLs | `src/lib/bill-join-url.ts`, `bill-invite-card.tsx` |
| Guest routes | `join.tsx`, `claim.tsx`, `guest-participant-session.ts` |
| Receipt UI | `index.tsx`, `receipt-preview-card.tsx` |
| Tests | `e2e/*`, new `devMode.test.ts`, `guestAccess.test.ts` |
| Docs | `docs/DEPLOY.md` |

---

## Open questions (defaults chosen)

| Question | Default in this spec |
|----------|----------------------|
| Query param name | `t` |
| Old links without token | Fail closed after A2 deploy |
| Guest receipt viewing | Not in Area A |
| Read rate limits on `getForGuest` | Deferred |

---

## Task tickets (copy to tracker)

```
[A1] SEC-1: Replace files.getUrl with bill-scoped getReceiptUrl
[A1] SEC-3: Dev auth allowlist + tests + DEPLOY.md

[A2] SEC-4: Add shareToken to schema + create + backfill
[A2] SEC-4: assertShareToken on all guest Convex functions
[A2] SEC-4: Sanitize getForGuest response (strip receiptStorageId)
[A2] SEC-4: Client join URLs ?t= + session storage + invite/QR
[A2] SEC-4: rotateShareToken mutation + host UI
[A2] SEC-2: Final bill claim conflict + join UI Заето
[A2] Tests: E2E + guest access unit tests

[A3] SEC-5: Bill-scoped generateUploadUrl + rate limit
[A3] SEC-6: Guest mutation rate limits + claim actor key
[A3] SEC-7: Document guest identity accepted risk
```

---

## Success criteria (Area A complete)

1. All 🔴 findings (SEC-1, SEC-2, SEC-3) resolved.
2. Share links are **revocable** and **invalid without token** (SEC-4).
3. Upload and guest mutation abuse materially constrained (SEC-5, SEC-6).
4. SEC-7 documented; no undocumented guest identity assumptions.
5. E2E green on dev deployment with tokenized join URLs.
