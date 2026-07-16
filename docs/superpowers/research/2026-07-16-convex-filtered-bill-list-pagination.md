# Convex pagination patterns for a filtered host bill list

**Date:** 2026-07-16  
**Issue:** [#18](https://github.com/HayGrouve/onova-za-smetkata/issues/18)  
**Map:** [#17](https://github.com/HayGrouve/onova-za-smetkata/issues/17)  
**Sources:** Official Convex docs and API references only.

## Question

What is the idiomatic Convex approach for a reactive host bill list that supports:

- server-side text search
- status filter (`draft` | `final` | all)
- cursor-based «Зареди още» chunks

…including how filters interact with `usePaginatedQuery` / cursors, and constraints that should shape the API.

## Verdict (short)

Use a **paginated query** that takes `paginationOpts` plus filter args, ends the DB query with `.paginate(paginationOpts)`, and drive the UI with **`usePaginatedQuery` + explicit `loadMore`**. Put status (and owner) into an **index range** when possible; treat full-text search as a **separate query shape** (`searchIndex` / `withSearchIndex`) because it changes ordering and field model. At our scale (tens–low hundreds of bills per host), a compound owner/status index plus either a denormalized search field or a post-index `.filter` are both viable; prefer indexes for status equality, and only adopt Convex FTS if keyword/relevance search is acceptable.

---

## 1. Recommended pagination API

### Server: `paginationOpts` + `.paginate`

Idiomatic Convex pagination is cursor-based:

1. Query args include `paginationOpts` validated with `paginationOptsValidator` from `"convex/server"`.
2. The handler builds a document query (index / order / optional filters) and ends with `.paginate(args.paginationOpts)`.
3. Return the `PaginationResult` (optionally mapping `page` for DTO shaping).

Sources:

- [Paginated Queries](https://docs.convex.dev/database/pagination) — “Writing paginated query functions”
- [`paginationOptsValidator`](https://docs.convex.dev/api/modules/server#paginationoptsvalidator)
- [`PaginationOptions`](https://docs.convex.dev/api/interfaces/server.PaginationOptions)
- [`PaginationResult`](https://docs.convex.dev/api/interfaces/server.PaginationResult)

`PaginationOptions` includes at least:

| Field | Role |
| --- | --- |
| `numItems` | Initial page size (reactive pages may grow/shrink) |
| `cursor` | `null` to start, or continue cursor from prior page |
| `endCursor` | Used by reactive clients for gap-less pages / splits |
| `maximumRowsRead` / `maximumBytesRead` | Bound work **before** filters apply; not enforced for search queries |

Sources: [PaginationOptions](https://docs.convex.dev/api/interfaces/server.PaginationOptions), [Paginated Queries](https://docs.convex.dev/database/pagination).

`PaginationResult` exposes `page`, `isDone`, `continueCursor`, and optional `splitCursor` / `pageStatus` (`"SplitRecommended"` | `"SplitRequired"`) when a page read too much data. Source: [PaginationResult](https://docs.convex.dev/api/interfaces/server.PaginationResult).

### Client: `usePaginatedQuery` (prefer over manual cursors in React)

For React UIs, the documented approach is `usePaginatedQuery` from `"convex/react"`:

- Pass query args **excluding** `paginationOpts` (the hook injects it).
- Pass `{ initialNumItems }`.
- Use returned `results`, `status` (`"LoadingFirstPage"` | `"CanLoadMore"` | `"LoadingMore"` | `"Exhausted"`), and `loadMore(n)`.

That maps directly to an explicit «Зареди още» button: enable when `status === "CanLoadMore"`, call `loadMore(chunkSize)`.

Sources:

- [Paginated Queries — Paginating within React Components](https://docs.convex.dev/database/pagination)
- [`usePaginatedQuery`](https://docs.convex.dev/api/modules/react#usepaginatedquery)

Manual cursor looping (`continueCursor` / `isDone`) is documented for non-React clients (e.g. `ConvexHttpClient`). Source: [Paginated Queries — Paginating manually](https://docs.convex.dev/database/pagination). Prefer the hook for the home list.

### Reactivity constraint (shapes UX expectations)

Paginated queries stay fully reactive. Page sizes are not fixed: if items are added/removed in the loaded range, a page may grow or shrink. Source: [Paginated Queries — Reactivity](https://docs.convex.dev/database/pagination). Also: after the first invocation in a reactive query, `paginate` keeps the original query range so pages stay adjacent/non-overlapping — `numItems` is only an initial value. Source: [`Query.paginate`](https://docs.convex.dev/api/interfaces/server.Query).

---

## 2. How filter args coexist with cursors

### Pattern: sibling args + injected `paginationOpts`

Paginated queries may take **additional arguments** beside `paginationOpts`. Official example: `author` + `paginationOpts`, applied via `.withIndex(...).paginate(args.paginationOpts)`. On the client, those extra args are passed to `usePaginatedQuery`; the hook still injects `paginationOpts`.

Sources:

- [Paginated Queries — Additional arguments](https://docs.convex.dev/database/pagination)
- [`usePaginatedQuery` args type omits `paginationOpts`](https://docs.convex.dev/api/modules/react#usepaginatedquery)

Suggested bill-list shape (illustrative):

```ts
args: {
  paginationOpts: paginationOptsValidator,
  status: v.optional(v.union(v.literal("draft"), v.literal("final"))), // omit / undefined = all
  search: v.optional(v.string()),
}
```

Cursors are **opaque continuation tokens for one query identity** (same underlying ordered result set). They are not a separate product field the UI designs; the hook owns them. Source: [Cursor / paginate description in server API](https://docs.convex.dev/api/modules/server) (cursors from `paginate` represent where the page ended; pass back in `PaginationOptions`).

### Filter changes reset pagination

From the React API: **if the query reference or arguments change, pagination state resets to the first page.** Invalid cursor / too-much-data errors also reset to the first page.

Source: [`usePaginatedQuery`](https://docs.convex.dev/api/modules/react#usepaginatedquery).

**API implication:** status chip and search string must be **query args**. Changing them naturally restarts from page 1 — no custom cursor invalidation needed. Spec empty/loading/error UX around that reset.

### Apply filters in the query pipeline, not as a substitute on `page`

Docs allow `map` / `filter` on the returned `page` array before returning from the query (e.g. DTO mapping like today’s summary fields). Source: [Paginated Queries — Transforming results](https://docs.convex.dev/database/pagination).

That is for **shaping** results. Predicates that define *which bills belong in the list* (status, text match) should run **before** `.paginate` via `withIndex` / `withSearchIndex` / `.filter`, so pagination counts matching documents. Post-paginate array filtering can under-fill pages and skip matches that never entered the raw page.

---

## 3. Status filter: indexes vs `.filter`

### Prefer indexes for equality filters

Convex’s guidance: best filtering is via indexes (`withIndex`); `.filter` loops documents in the current range and can hit limits on large tables. Sources:

- [Reading Data — Filtering](https://docs.convex.dev/database/reading-data/)
- [Filters](https://docs.convex.dev/database/reading-data/filters)
- [Indexes](https://docs.convex.dev/database/reading-data/indexes)
- [Indexes and Query Performance](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf)
- [`Query.filter` — prefer `withIndex`](https://docs.convex.dev/api/interfaces/server.Query)

Index range rules: equality prefixes in index field order, then optional bounds on the next field. Queries using an index are ordered by index columns (plus automatic `_creationTime` tie-break). Sources: [Indexes](https://docs.convex.dev/database/reading-data/indexes), [Indexes and Query Performance](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf).

### Implication for `draft` | `final` | all

Today’s schema already has `by_ownerId_updatedAt` on `bills` (`ownerId`, `updatedAt`) — good for “all statuses, newest first.”

For a **status chip**, idiomatic options:

1. **Compound index** e.g. `by_ownerId_status_updatedAt` on `["ownerId", "status", "updatedAt"]`:
   - When status is `draft` or `final`: `.withIndex(..., q => q.eq("ownerId", userId).eq("status", status)).order("desc").paginate(...)`
   - When status is **all**: keep using `by_ownerId_updatedAt` (a status-prefixed index cannot efficiently mean “any status” while still sorting only by `updatedAt` across statuses — same left-prefix rules as in the compound-index docs).

2. **Owner index + `.filter` on status** for the draft/final chips:
   - Performance is based on how many of the host’s bills are scanned in the owner range, not the whole table. Sources: [Indexes — `.filter` after `withIndex`](https://docs.convex.dev/database/reading-data/indexes), [Indexes and Query Performance](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf).
   - Docs note full scans / filter loops are fine for small tables (on the order of hundreds). Sources: [Reading Data](https://docs.convex.dev/database/reading-data/), [Indexes and Query Performance](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf).

**At our product scale (tens–low hundreds per host):** either works. Prefer the compound index if status filtering is a permanent home-list control; `.filter` is acceptable as a smaller schema change.

When using `.filter` for rare matches while paginating, consider `maximumRowsRead` so a sparse filter cannot scan unbounded rows before filling `numItems`. Source: [PaginationOptions.maximumRowsRead](https://docs.convex.dev/api/interfaces/server.PaginationOptions).

---

## 4. Text search: different approach than `.filter` after an index

### When the docs say use search

If you need keyword matching *inside* a string field, Convex points to **full-text search**, not ordinary `.filter`. Source: [Filters](https://docs.convex.dev/database/reading-data/filters) (“If you need to filter to documents containing some keywords, use a search query.”), [Full Text Search](https://docs.convex.dev/search/text-search).

### Search index model

- Define `searchIndex` with exactly **one** `searchField` (string) and optional `filterFields` for fast equality filters.
- Query with `.withSearchIndex("…", q => q.search("field", query).eq("filterField", value)…)`.
- Search results **always order by relevance**; custom ordering (e.g. `updatedAt` desc) is **not supported**.
- Search works with `.paginate(paginationOpts)` and is reactive.
- Put as many equality filters as possible into `withSearchIndex` (`filterFields`), not post-hoc `.filter`.

Sources: [Full Text Search](https://docs.convex.dev/search/text-search).

Limits that matter for API design:

- One search field per search index; up to 16 filter fields.
- Search queries: up to 16 terms, up to 8 filter expressions; can scan up to 1024 search-index results.
- Tokenization is English/Latin-script oriented (Tantivy `SimpleTokenizer`); terms lowercased, max 32 chars.
- `maximumRowsRead` / `maximumBytesRead` are **not** enforced for search queries.

Sources: [Full Text Search — Limits](https://docs.convex.dev/search/text-search), [PaginationOptions](https://docs.convex.dev/api/interfaces/server.PaginationOptions).

### Fit to “restaurant + participant names”

Convex FTS searches **one string field**. Our list today matches restaurant and denormalized `listParticipantNames` client-side. To use FTS server-side across both, the schema needs a **denormalized searchable string** (e.g. restaurant + joined names) as the single `searchField`, with `filterFields` like `ownerId` and optionally `status`.

Tradeoffs vs index + `.filter` / JS match:

| Approach | Order | Matching | Schema |
| --- | --- | --- | --- |
| `searchIndex` + paginate | Relevance only | Keyword / prefix-on-last-term | Denormalized search string + search index |
| `by_ownerId_updatedAt` (+ status) + `.filter` / JS | `updatedAt` desc (index order) | App-defined (substring, case-fold, etc.) | Minimal / reuse denormalized names |

Sources for ordering/search behavior: [Full Text Search — Ordering / Typeahead](https://docs.convex.dev/search/text-search); for index order: [Indexes — Sorting](https://docs.convex.dev/database/reading-data/indexes).

**Practical recommendation for this app:**  

- **Browse / filter-by-status (empty search):** paginate over `by_ownerId_updatedAt` or `by_ownerId_status_updatedAt`, `order("desc")`, `usePaginatedQuery` + `loadMore`.  
- **Non-empty search:** either  
  - (A) same index path + server-side string match via `.filter` / handler logic on the owner (and status) range — simplest, keeps recency order, fine at hundreds of bills; or  
  - (B) dedicated search query using `searchIndex` if product wants keyword/relevance search — expect different sort and a denormalized search field.

Do **not** assume one FTS query can preserve “newest first” browsing; the docs forbid alternate search ordering.

---

## 5. Constraints that should shape our API

1. **Query must accept `paginationOpts` and return `PaginationResult`** to work with `usePaginatedQuery` (`PaginatedQueryReference`). Source: [react API — PaginatedQueryReference / usePaginatedQuery](https://docs.convex.dev/api/modules/react#usepaginatedquery).
2. **Filters are ordinary args** alongside `paginationOpts`; client never passes cursors when using the hook. Source: [Paginated Queries](https://docs.convex.dev/database/pagination).
3. **Changing search/status args resets loaded pages** — design UX for restart-from-top. Source: [usePaginatedQuery](https://docs.convex.dev/api/modules/react#usepaginatedquery).
4. **Prefer index equality for `ownerId` + `status`**; use `.filter` only for residual predicates or tiny ranges. Sources: [Filters](https://docs.convex.dev/database/reading-data/filters), [Indexes and Query Performance](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf).
5. **“All” vs typed status likely needs two index paths** (or filter-on-status). Compound-index left-prefix rules: [Indexes](https://docs.convex.dev/database/reading-data/indexes), [Indexes and Query Performance](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf).
6. **FTS is optional and structurally different** (one search field, relevance order, `filterFields`). Source: [Full Text Search](https://docs.convex.dev/search/text-search).
7. **Map `page` for summary DTOs**; don’t use post-page filtering as the status/search implementation. Source: [Paginated Queries — Transforming results](https://docs.convex.dev/database/pagination).
8. **Reactive page size drift** is expected; UI should not assume fixed chunk lengths after load. Source: [Paginated Queries — Reactivity](https://docs.convex.dev/database/pagination), [`Query.paginate` note](https://docs.convex.dev/api/interfaces/server.Query).
9. **Explicit Load More is first-class** in the pagination docs (button example); infinite scroll is optional, not required. Source: [Paginated Queries](https://docs.convex.dev/database/pagination).

---

## 6. Practical recommendation for onova-za-smetkata

Given charting lean (server-side search + status, «Зареди още», tens–low hundreds):

| Concern | Recommendation |
| --- | --- |
| Pagination mechanism | Successor to `listWithSummary`: paginated query + `usePaginatedQuery` + `loadMore` |
| Status | Args `status?: "draft" \| "final"`; compound index `by_ownerId_status_updatedAt` for chips; `by_ownerId_updatedAt` when unset (“all”) |
| Search | Keep recency order: apply server-side match on denormalized restaurant / participant fields within the owner(+status) index range; adopt `searchIndex` only if relevance ranking is desired |
| Chunk size | Product decision (`initialNumItems` / `loadMore(n)`); not constrained by Convex beyond normal read limits |
| Replace `limit` max-200 | Pagination supersedes a single large `take`; still bound work with page size (+ optional `maximumRowsRead` if using sparse `.filter`) |

This stays within primary Convex patterns and matches the map’s load UX without inventing manual cursor state on the client.

---

## Primary sources

| Topic | URL |
| --- | --- |
| Paginated queries | https://docs.convex.dev/database/pagination |
| Reading data / indexes overview | https://docs.convex.dev/database/reading-data/ |
| Filters | https://docs.convex.dev/database/reading-data/filters |
| Indexes | https://docs.convex.dev/database/reading-data/indexes |
| Indexes & query performance | https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf |
| Full text search | https://docs.convex.dev/search/text-search |
| `usePaginatedQuery` | https://docs.convex.dev/api/modules/react#usepaginatedquery |
| `paginationOptsValidator` | https://docs.convex.dev/api/modules/server#paginationoptsvalidator |
| `PaginationOptions` | https://docs.convex.dev/api/interfaces/server.PaginationOptions |
| `PaginationResult` | https://docs.convex.dev/api/interfaces/server.PaginationResult |
| `Query` / `paginate` / `filter` | https://docs.convex.dev/api/interfaces/server.Query |
