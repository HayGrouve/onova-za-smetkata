# Home Bill List — Filter + Load-More Design Spec

**Date:** 2026-07-16  
**Status:** Complete  
**Scope:** Host home (`/`) bill list — server-side search + status chips, explicit «Зареди още», and the paginated `listWithSummary` API shape  
**Approach:** Convex `usePaginatedQuery` + filter args; status in URL; search local  
**Builds on:** `2026-07-09-area-e-architecture-scalability-design.md` (`listWithSummary`), research `2026-07-16-convex-filtered-bill-list-pagination.md`  
**Map:** [Home bill list: filter + load-more design](https://github.com/HayGrouve/onova-za-smetkata/issues/17)

---

## Problem

The host home list loads up to 100 bills client-side and filters restaurant/participant text in the browser. Finding a bill is the product driver, but there is no status chip, no server-side filter, and no chunked load path. At tens to low hundreds of bills, the list needs a mobile-first filter + load-more design without numbered pages or infinite scroll.

## Solution

Keep the home list as the host’s bill finder, and move filter + search + chunking to the server:

- Status chips **Всички / Чернови / Приключени** (schema `draft` | `final`; omit = all).
- Existing restaurant/participant search, matched server-side.
- Explicit **«Зареди още»** via `usePaginatedQuery` / `loadMore` (chunk size **20**).
- Evolve **`bills.listWithSummary`** into a paginated query (drop `limit`).

---

## UX decisions

| Topic | Choice |
|-------|--------|
| Product driver | Finding bills; load strategy follows scale |
| Filters in scope | Search (restaurant + participant names) + status chips **Всички / Чернови / Приключени** |
| Load UX | Explicit **«Зареди още»** only (v1) |
| Chunk size | **20** for first page and each `loadMore` |
| Filter location | Server-side; args on the paginated query |
| Status ↔ URL | TanStack Router search param (e.g. `?status=draft` / `?status=final`; omit = Всички); **replace** history (no chip history stack) |
| Search ↔ URL | Component-local only (v1) |
| Search match | Case-insensitive **contains** on restaurant name **or** denormalized participant names; trim; empty/whitespace = no text filter |
| Order | Recent-first (`updatedAt` desc); not FTS / relevance |
| Debounce / min-length | Implementation-plan detail, not locked here |
| Scale | Tens to low hundreds of bills per host; mobile-first |

---

## Interaction

1. Land on `/` → first chunk of 20 matching bills (status from URL; search empty).
2. Change status chip → URL `status` replaced; pagination resets to page 1; first-page skeletons while loading.
3. Type search → local state; when the debounced value is applied as a query arg, pagination resets; same skeleton treatment.
4. Scroll/list end → if more exist, show **«Зареди още»**; tap loads the next chunk of 20; list above stays mounted.
5. Navigate to a bill and back → status chip restored from URL; search string does **not** restore.

---

## Content map

### Controls (above the list)

| Element | Behavior |
|---------|----------|
| Search input | Placeholder unchanged: „Търсене по ресторант или участник“; local state |
| Status chips | **Всички** / **Чернови** / **Приключени** — mutually exclusive; selected chip reflects URL |

### List body

| State | UI |
|-------|-----|
| First page loading (`LoadingFirstPage`) / filter reset | Three card skeletons (same pattern as today); chips + search stay interactive |
| Has results | `BillCard` rows as today |
| Empty — no bills at all (Всички, empty search) | „Все още нямате сметки. Създайте първата си сметка!“ |
| Empty — search has no matches | „Няма намерени сметки.“ |
| Empty — Чернови, empty search | „Няма чернови.“ |
| Empty — Приключени, empty search | „Няма приключени.“ |
| Can load more | **«Зареди още»** button enabled |
| Loading more | Button disabled + inline loading; existing cards stay |
| Exhausted | No load-more control |
| Error — first page | Short retry message in the list area |
| Error — later page / transient | Toast; keep last good list when present |

---

## Architecture

### API — evolve `bills.listWithSummary`

Replace the current `limit` / `.take` shape with a paginated query:

```ts
args: {
  paginationOpts: paginationOptsValidator,
  status: v.optional(v.union(v.literal("draft"), v.literal("final"))), // omit = all
  search: v.optional(v.string()),
}
```

- End the DB query with `.paginate(args.paginationOpts)`.
- Return Convex `PaginationResult`, mapping `page` to today’s summary DTO:

  - `bill`
  - `participantNames`
  - `billTotalCents`
  - `totalOutstandingCents` (`null` while draft)

- **Cursors are not a product field.** Opaque via `paginationOpts` / `usePaginatedQuery`; the UI only calls `loadMore(20)`.

### Indexes

| Path | Index |
|------|--------|
| Всички (no status) | existing `by_ownerId_updatedAt` |
| Чернови / Приключени | new compound `by_ownerId_status_updatedAt` on `["ownerId", "status", "updatedAt"]` |

Search uses case-insensitive contains on restaurant + denormalized participant names **inside** the owner (+ status) index range, applied **before** `.paginate` (not post-filter on `page`). No Convex FTS for v1.

### Client

- Home switches from `useQuery(listWithSummary)` to `usePaginatedQuery(listWithSummary, { status?, search? }, { initialNumItems: 20 })`.
- Changing `status` or `search` args resets pagination (Convex behavior) — design UX around that, no manual cursor invalidation.
- Status chip writes router search with **replace**; search string never enters the URL.

```
Home `/`
  ├─ Нова сметка
  ├─ Search (local)
  ├─ Status chips ↔ URL `?status=`
  ├─ BillCard list (paginated results)
  └─ «Зареди още» → loadMore(20)
```

### Unchanged

- `BillCard` presentation and collection/outstanding display on the card.
- Create-bill flow and payment-settings banner.
- Auth gate on home.

---

## Edge cases

| Case | Behavior |
|------|----------|
| Whitespace-only search | Treated as empty — no text filter |
| Reactive page drift | Page length may grow/shrink under Convex reactivity; UI must not assume fixed chunk lengths after load |
| Sparse search matches | Prefer filling pages via pre-paginate filtering; optional `maximumRowsRead` is an implementation detail if scans get heavy |
| Back from a bill | Restores status chip from URL; search cleared (local state) |
| Chip history | Replace only — Back leaves home or returns from a bill, does not step through chips |

---

## Out of scope

- Date-range, amount-range, and sort toggles on the home list
- Separate outstanding / settled collection filter (stays on the card)
- Numbered pagination
- Auto load-on-intersect infinite scroll (v1)
- Convex full-text search / relevance ordering
- Putting search string in the URL
- Debounce / min-length constants (implementation plan)

---

## Testing

### Manual / browser

- Всички / Чернови / Приключени each show the right subset; URL updates with replace.
- Search matches restaurant or participant; empty search clears the text filter.
- First load shows ≤20; «Зареди още» appends another chunk; hidden when exhausted.
- Changing chip or search resets to a fresh first page (skeletons, not a stuck cursor).
- Empty copies for no bills / no search matches / no drafts / no finals.
- Back from a bill restores status, not search.

### Automated

- Convex query: status index path, search contains, empty search, pagination `isDone` / page size.
- Router: status search-param parse/serialize (omit = all).

---

## Success criteria

1. Host can filter home bills by status and search without loading the full history client-side.
2. Load more is an explicit «Зареди още» control with chunk size 20.
3. `listWithSummary` is the single paginated home API; cursors stay inside Convex pagination.
4. Status survives refresh/back via URL; search does not.
5. Empty, loading, and error states remain understandable when filters reset the list.
