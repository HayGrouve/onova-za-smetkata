# Share-Friendly SEO Design

**Status:** Approved  
**Date:** 2026-07-08  
**Goal:** Branded link previews for shared bill join URLs, sensible homepage metadata, and no indexing of private/capability routes.

---

## Decisions

| Decision | Choice |
|----------|--------|
| Scope | Option B — share-friendly, not full marketing site |
| OG image | Dedicated `public/og-image.png` (1200×630) |
| Join link OG | Generic copy (no restaurant/bill names in meta) |
| Indexable routes | `/` only |
| Base URL | `VITE_APP_ORIGIN` with fallback `https://onova-za-smetkata.com` |

---

## Architecture

- `src/lib/site-meta.ts` — shared copy, absolute URL helpers, OG/Twitter meta builders
- Route `head()` overrides per page type
- Static `public/robots.txt`, `public/sitemap.xml`, `public/og-image.png`
- `scripts/generate-og-image.mjs` — generates OG image from brand colors + icon

---

## Route head policy

| Route | robots | OG / Twitter |
|-------|--------|--------------|
| `/` | index (default) | Full homepage tags + canonical |
| `/login` | noindex, nofollow | Title only |
| `/bills/$billId/join` | noindex, nofollow | Full share preview tags |
| Other `/bills/*` | noindex, nofollow | Title only |
| `/$` (404) | noindex | Title only |

---

## Static files

**robots.txt:** Allow `/`, disallow `/bills/` and `/login`, reference sitemap.

**sitemap.xml:** Single URL — homepage.

**og-image.png:** 1200×630, brand colors, app name in Bulgarian.

---

## Success criteria

1. Join URL shows title, description, and image in link preview debuggers.
2. Homepage has description, OG, and canonical in SSR HTML.
3. `/bills/*` and `/login` blocked in robots.txt.
4. `<title>` is top-level in TanStack `head()`, not inside `meta`.

---

## Out of scope

- Marketing landing pages, blog, FAQ
- Dynamic OG with bill/restaurant names
- JSON-LD structured data
- hreflang / bilingual SEO
