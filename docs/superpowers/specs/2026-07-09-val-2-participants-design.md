# VAL-2 — Participants Validation (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Parent:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`  
**Depends on:** VAL-0 (`personNameSchema`, `BILL_PARTICIPANTS_MAX`)  
**Scope:** Participant name validation + duplicate/cap guards on add paths

---

## Goal

Validate participant names on every add path using shared `personNameSchema`, block duplicates per bill (case-insensitive), enforce a per-bill participant cap, and show inline errors on manual add — matching the payment-settings / VAL-1 pattern.

---

## Non-goals

- Renaming participants after add (no edit-name flow today)
- Guest join/claim text input (VAL-5 — selection only)
- Changing duplicate **display** labels (`buildParticipantLabels` disambiguation for same display name stays)
- Friend group CRUD validation (done in friend-groups schema)

---

## Surfaces

| Action | UI | Mutation |
|--------|-----|----------|
| Manual add | `ParticipantList` form | `participants.add` |
| Quick-add pill | Recent name chip | `participants.add` |
| Add group (all) | Group pill tap | `friendGroups.addToBill` |
| Partial group add | Preview sheet | `friendGroups.addToBill` |
| Undo remove | Toast „Отмени“ | `participants.add` |

---

## Validation rules

Uses `personNameSchema` from `shared/validation/fields.ts`:

| Rule | Detail |
|------|--------|
| Name | Trim; 1–50 chars; no control chars (`\x00-\x1f`) |
| Duplicate | Case-insensitive unique per bill |
| Max participants | `BILL_PARTICIPANTS_MAX` (50) per bill |
| Finalized bill | No adds (existing guards in UI + `addToBill`; extend `participants.add`) |

### Error messages

| Code | Message |
|------|---------|
| Empty / invalid name | From `personNameSchema` (e.g. `Името не може да е празно`) |
| Duplicate | `Този участник вече е на сметката` |
| Cap reached | `Максимум 50 участника на сметка` |
| Finalized bill | `Сметката е завършена.` |

### Duplicate semantics

- **Manual / quick-add:** hard reject (inline error or toast)
- **Group bulk add:** keep existing skip behavior for duplicates; toast summary unchanged (`Добавени N · M вече на сметката`)
- Comparison key: `name.trim().toLowerCase()`
- Stored value: trimmed original casing from input (first occurrence wins)

### Cap semantics

- **`participants.add`:** reject when `existing.length >= BILL_PARTICIPANTS_MAX`
- **`friendGroups.addToBill`:** add until cap; count remainder as skipped; extend toast summary only if needed (optional: include cap skips in `skipped` count — same user-visible bucket)

---

## Shared schema API

**File:** `shared/participant-schema.ts`  
**Tests:** `shared/participant-schema.test.ts`  
**Shims:** `src/lib/participant-schema.ts`, `convex/lib/participantSchema.ts`

```ts
export type ParticipantAddInput = { name: string }

export type ParticipantAddContext = {
  existingNames: string[]
  participantCount: number
}

export function participantNameKey(name: string): string

export function parseParticipantName(
  name: string,
): z.SafeParseReturnType<string, string>  // output: trimmed name

export function validateParticipantAdd(
  input: ParticipantAddInput,
  context: ParticipantAddContext,
):
  | { ok: true; name: string }
  | { ok: false; message: string; field?: 'name' }

export function formatParticipantNameError(error: z.ZodError): string
```

`validateParticipantAdd` order:

1. `parseParticipantName` — format/length
2. Duplicate check against `existingNames` keys
3. `participantCount >= BILL_PARTICIPANTS_MAX` — cap

---

## Server behavior

### `participants.add`

```ts
const bill = await requireBillOwner(ctx, args.billId)
if (bill.status === 'final') {
  throw new ConvexError('Сметката е завършена.')
}

const existing = await ctx.db.query('participants')...
const validated = validateParticipantAdd(
  { name: args.name },
  {
    existingNames: existing.map((p) => p.name),
    participantCount: existing.length,
  },
)
if (!validated.ok) {
  throw new ConvexError(validated.message)
}

await ctx.db.insert('participants', {
  billId: args.billId,
  name: validated.name,
  sortOrder: existing.length,
})
```

### `friendGroups.addToBill`

Before insert loop, load existing once (unchanged). For each candidate name:

1. `parseParticipantName` — skip invalid names silently (group members are pre-validated; defensive only)
2. Duplicate key — `skipped++` (unchanged)
3. If `existing.length + added >= BILL_PARTICIPANTS_MAX` — stop loop, count remaining as `skipped`

No change to return shape `{ added, skipped }`.

---

## Client behavior

### `ParticipantList` manual add

Replace silent `if (!trimmed) return` with validation:

```ts
const [nameError, setNameError] = useState<string | undefined>()

async function handleAdd(participantName?: string) {
  const raw = participantName ?? name
  const validated = validateParticipantAdd(
    { name: raw },
    {
      existingNames: participants.map((p) => p.name),
      participantCount: participants.length,
    },
  )
  if (!validated.ok) {
    if (participantName === undefined) {
      setNameError(validated.message)
    } else {
      toast.error(validated.message)
    }
    return
  }
  setNameError(undefined)
  // ... mutate with validated.name
}
```

- Inline error under manual input (`aria-invalid`, destructive text)
- Clear `nameError` on input change when error present
- Quick-add pills: toast on failure (no inline — pill is one-shot)
- Submit button: keep disabled when `!name.trim()`; validation on submit for edge paste cases

### Read-only mode

Unchanged — `readOnly` hides add UI; no validation needed.

---

## Files

| File | Action |
|------|--------|
| `shared/participant-schema.ts` | Create |
| `shared/participant-schema.test.ts` | Create |
| `src/lib/participant-schema.ts` | Create — re-export |
| `convex/lib/participantSchema.ts` | Create — re-export |
| `convex/participants.ts` | Validate in `add`; finalized guard |
| `convex/friendGroups.ts` | Cap + name parse in `addToBill` loop |
| `src/components/bills/participant-list.tsx` | Inline `nameError` + client pre-check |

---

## Testing

### Schema tests

- Valid name trims and passes
- Empty / overlong / control char fails
- Duplicate `Иван` vs `иван` fails
- Cap at exactly 50 fails
- `participantNameKey` normalizes consistently

### Manual QA

1. Add „Иван“ → success
2. Add „иван“ again → inline duplicate error
3. Add 50 participants → 51st shows cap error
4. Quick-add duplicate → toast error
5. Group add with some already on bill → summary toast unchanged
6. Finalized bill → add blocked (if editor exposes add — otherwise verify mutation)

---

## Exit criteria

- [x] `shared/participant-schema.ts` + tests pass
- [x] `participants.add` validates name, duplicate, cap, finalized
- [x] `friendGroups.addToBill` respects cap
- [x] Manual add shows inline errors
- [x] `pnpm run preflight` passes
- [x] Roadmap VAL-2 marked ✅

---

## Next phase

**VAL-3 Items** — name, price, quantity on add/edit forms.
