# Clerk production auth failure mode — diagnosis

**Wayfinder map:** [#125](https://github.com/HayGrouve/onova-za-smetkata/issues/125)  
**Research ticket:** [#126](https://github.com/HayGrouve/onova-za-smetkata/issues/126)  
**Date:** 2026-08-11  
**Site:** `https://onova-za-smetkata.com` (redirects to `https://www.onova-za-smetkata.com`)  
**Resolution (2026-08-11):** Production host auth working. Fixes applied: Clerk FAPI DNS (`clerk.onova-za-smetkata.com` CNAME verified), Vercel env (`VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`; removed `NEXT_PUBLIC_*`), Convex `CLERK_JWT_ISSUER_DOMAIN` = `https://clerk.onova-za-smetkata.com`. Runbook updated in `docs/clerk-production-setup.md`.

---

## Executive summary

**Primary failure mode:** Clerk **Frontend API custom-domain DNS is misconfigured**. The production publishable key is bound to `clerk.onova-za-smetkata.com`, but that hostname resolves to **Vercel edge IPs**, not Clerk’s Frontend API. TLS to the Clerk subdomain fails; the Clerk browser SDK never finishes loading (`isLoaded` stays false). The app therefore sits on **„Зареждане…“** and never redirects unauthenticated hosts to `/login` — matching the symptom recorded in #125.

**Not the primary blocker (based on live probes):**

| Layer                                                | Status          | Notes                                                                      |
| ---------------------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| Vercel env vars (`VITE_CLERK_PUBLISHABLE_KEY`, etc.) | **Likely OK**   | Live `pk_live_…` key is baked into HTML; no „Липсва конфигурация…“ screens |
| Server middleware (`clerkMiddleware`)                | **Working**     | `x-clerk-auth-status: signed-out` on prod responses                        |
| Post-login Convex sync (`ensureCurrent`)             | **Not reached** | Blocked upstream by Clerk client init failure                              |
| Google OAuth custom credentials                      | **Secondary**   | Only matters after Clerk JS loads; email/OAuth both need working FAPI      |

**Configuration layer that owns the fix:** **DNS / Clerk Dashboard → Domains** (ticket **#127**). Convex JWT issuer (#129) and Google OAuth (#130) are **verify-after-DNS** steps.

---

## Symptom (from #125)

> Dev login works; prod home shows loading and no Clerk sign-in UI.

---

## Code paths (how loading gets stuck)

### 1. Root provider — Clerk must load before children render

```63:68:src/integrations/convex/provider.tsx
  if (!isLoaded || (isSignedIn && !convexUserReady && !syncFailed)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">Зареждане...</p>
      </div>
```

If Clerk JS cannot reach the Frontend API, `isLoaded` from `useAuth()` never becomes `true` → global **„Зареждане…“** shell.

Missing-config guards are **not** shown in prod (would render „Липсва конфигурация на входа (VITE_CLERK_PUBLISHABLE_KEY).“ or Convex URL message instead):

```103:105:src/integrations/convex/provider.tsx
  if (!clerkPublishableKey) {
    return <MissingClerkConfig />
  }
```

### 2. Home route — auth redirect also waits on `isLoaded`

```9:17:src/hooks/use-require-host-auth.ts
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      void navigate({
        to: '/login',
        search: { redirect: redirectPath },
      })
    }
  }, [isLoaded, isSignedIn, navigate, redirectPath])
```

```130:135:src/routes/index.tsx
  if (isLoading || !isAuthenticated) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
```

Unauthenticated hosts never reach `/login` while Clerk client init is blocked.

### 3. Login route — SignIn UI also gated on `isLoaded`

```28:34:src/routes/login.tsx
  if (!isLoaded || isSignedIn) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }
```

Direct navigation to `/login` would show the same spinner until FAPI is reachable.

### 4. Server middleware — already functional

```1:6:src/start.ts
import { createStart } from '@tanstack/react-start'
import { clerkMiddleware } from '@clerk/tanstack-react-start/server'

export const startInstance = createStart(() => ({
  requestMiddleware: [clerkMiddleware()],
}))
```

Prod responses include Clerk auth headers (`x-clerk-auth-status: signed-out`), confirming `CLERK_SECRET_KEY` is present at runtime on Vercel.

### 5. Post-login Convex sync — downstream of Clerk init

After sign-in, `EnsureConvexUser` calls `users.ensureCurrent`, which uses Convex auth with Clerk JWT (`convex/auth.config.ts` → `CLERK_JWT_ISSUER_DOMAIN`). This path is documented as a **secondary** failure mode („Sign-in OK, app stuck on Зареждане…“) in `docs/clerk-production-setup.md` when JWT issuer mismatches — but we cannot observe it until FAPI DNS is fixed.

---

## Production probes (2026-08-11)

### HTTP / TLS

| URL                                       | Result                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| `https://onova-za-smetkata.com/`          | **308** → `https://www.onova-za-smetkata.com/`        |
| `https://www.onova-za-smetkata.com/`      | **200** HTML; Clerk middleware headers present        |
| `https://www.onova-za-smetkata.com/login` | **200** (after redirect chain)                        |
| `https://clerk.onova-za-smetkata.com/`    | **TLS failure** — `SSL: UNEXPECTED_EOF_WHILE_READING` |
| `http://clerk.onova-za-smetkata.com/`     | **404** (Vercel, not Clerk FAPI)                      |

Response headers on `www` (representative):

```http
x-clerk-auth-status: signed-out
x-clerk-auth-reason: session-token-and-uat-missing
server: Vercel
```

### Baked-in Clerk publishable key

Extracted from prod HTML (`www` home and `/login`):

```text
pk_live_Y2xlcmsub25vdmEtemEtc21ldGthdGEuY29tJA
```

Base64 suffix decodes to:

```text
clerk.onova-za-smetkata.com$
```

This confirms the **production Clerk instance uses a custom Frontend API domain**, not the default `*.clerk.accounts.com` dev-style host. The browser SDK will call `https://clerk.onova-za-smetkata.com/…` for session/client APIs.

### DNS (Google Public DNS API)

| Hostname                                  | Record    | Value                              |
| ----------------------------------------- | --------- | ---------------------------------- |
| `clerk.onova-za-smetkata.com`             | **A**     | `216.198.79.1`, `216.198.79.65`    |
| `clerk.onova-za-smetkata.com`             | **CNAME** | _(none)_                           |
| `www.onova-za-smetkata.com`               | **A**     | `216.198.79.1` (same Vercel range) |
| `frontend-api.clerk.services` (reference) | **CNAME** | `worker.clerkprod-cloudflare.net`  |

**Finding:** `clerk.onova-za-smetkata.com` shares Vercel anycast IPs with the app domain. It should instead carry a **CNAME to Clerk’s Frontend API target** shown in Clerk Dashboard → **Domains** (per Clerk production deployment docs).

NS for zone: `ns1.vercel-dns.com` (Vercel DNS).

### TLS certificates

| Host                          | Certificate                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `www.onova-za-smetkata.com`   | Valid Let’s Encrypt cert, CN = `www.onova-za-smetkata.com` |
| `clerk.onova-za-smetkata.com` | Handshake fails before cert inspection                     |

---

## Clerk documentation (Context7 → `/clerk/clerk-docs`)

Relevant production requirements:

1. **CNAME for Frontend API** — Production instances need DNS records; navigate to Clerk Dashboard → [**Domains**](https://dashboard.clerk.com/~/domains) for exact targets. Propagation can take up to 48 hours.  
   Source: [Clerk production deployment — DNS records](https://github.com/clerk/clerk-docs/blob/main/docs/guides/development/deployment/production.mdx)

2. **Cloudflare / proxy pitfall** — If the FAPI subdomain is reverse-proxied (e.g. Cloudflare orange cloud), Clerk’s DNS validation fails. Set the record to **DNS only**.  
   Source: same doc, „DNS records not propagating with Cloudflare“

3. **JWT issuer in production** — With custom domain, issuer / Frontend API URL format is `https://clerk.<your-domain>.com` (not `*.clerk.accounts.dev`). This must match `CLERK_JWT_ISSUER_DOMAIN` on Convex.  
   Source: [Clerk Grafbase integration — JWT issuer](https://github.com/clerk/clerk-docs/blob/main/docs/guides/development/integrations/databases/grafbase.mdx)

4. **Proxy alternative** — If CNAME is impossible, Clerk supports Frontend API proxying (`Clerk-Proxy-Url` header). Not currently configured in this app.  
   Source: [Proxying the Clerk Frontend API](https://github.com/clerk/clerk-docs/blob/main/docs/guides/dashboard/dns-domains/proxy-fapi.mdx)

---

## Project runbook alignment

`docs/clerk-production-setup.md` already assumes the custom domain:

- Google OAuth redirect URI: `https://clerk.onova-za-smetkata.com/v1/oauth_callback` (§1.8)
- Convex `CLERK_JWT_ISSUER_DOMAIN` = Clerk prod Frontend API URL / issuer (§1.4, §2.1)
- Troubleshooting table maps „Sign-in OK, stuck on Зареждане…“ → JWT issuer mismatch (#129 territory), not the current pre-sign-in spinner

The runbook’s DNS step is implicit in Clerk Dashboard domain setup but **not** called out as a separate checklist item — this diagnosis confirms it is the gating failure.

---

## Failure-mode decision tree

```text
Prod home: „Зареждане…“, no SignIn UI
│
├─ „Липсва конфигурация…“ in HTML?
│   └─ NO → VITE_CLERK_PUBLISHABLE_KEY and VITE_CONVEX_URL are baked in (#128 deprioritized)
│
├─ x-clerk-auth-* headers on SSR?
│   └─ YES → clerkMiddleware + CLERK_SECRET_KEY OK on Vercel
│
├─ pk_live encodes clerk.onova-za-smetkata.com?
│   └─ YES → browser will call custom FAPI host
│
├─ clerk.onova-za-smetkata.com DNS → Vercel A records?
│   └─ YES → **PRIMARY BLOCKER (#127)**
│       TLS fails; Clerk SDK isLoaded never true
│
└─ (After DNS fix) Sign-in completes but still „Зареждане…“?
    └─ Check CLERK_JWT_ISSUER_DOMAIN on Convex (#129)
    └─ Google redirect_uri_mismatch → #130
```

---

## Recommended fix order

| Order | Ticket                                                            | Action                                                                                                                                                                                                                                                                                         | Owner                    |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **1** | [#127](https://github.com/HayGrouve/onova-za-smetkata/issues/127) | In Vercel DNS (or registrar), **remove A records** on `clerk.onova-za-smetkata.com` pointing to Vercel. Add **CNAME** exactly as Clerk Dashboard → Domains specifies. Ensure **DNS only** (no proxy). Wait for propagation; verify TLS + `GET /v1/client` returns Clerk JSON (not Vercel 404). | Infra / Clerk Dashboard  |
| **2** | [#129](https://github.com/HayGrouve/onova-za-smetkata/issues/129) | Set Convex prod `CLERK_JWT_ISSUER_DOMAIN` to `https://clerk.onova-za-smetkata.com` (must match JWT template issuer). Redeploy Convex if changed.                                                                                                                                               | Convex Dashboard         |
| **3** | [#130](https://github.com/HayGrouve/onova-za-smetkata/issues/130) | Configure Google custom credentials in Clerk prod; redirect URI `https://clerk.onova-za-smetkata.com/v1/oauth_callback`.                                                                                                                                                                       | Clerk + Google Cloud     |
| **4** | [#128](https://github.com/HayGrouve/onova-za-smetkata/issues/128) | **Confirm-only audit** — live HTML already contains `pk_live_…`; add `https://www.onova-za-smetkata.com` to Clerk allowed domains if missing (apex redirects to www).                                                                                                                          | Vercel + Clerk Dashboard |

### Smoke test after #127

1. Incognito → `https://www.onova-za-smetkata.com/` → should redirect to `/login` (not infinite spinner).
2. `/login` → Clerk **SignIn** widget visible (Bulgarian via `bgBG` in `provider.tsx`).
3. Email or Google sign-in → brief „Зареждане…“ → host home with bill list.
4. If step 3 hangs after successful Clerk sign-in → investigate #129 (JWT issuer) before #130.

---

## Map ticket implication summary

| Ticket                                    | Implicated?         | Role                                                           |
| ----------------------------------------- | ------------------- | -------------------------------------------------------------- |
| **#127** Fix Clerk Frontend API DNS       | **Yes — primary**   | Root cause; unblocks Clerk SDK init                            |
| **#128** Audit Vercel env vars            | **Low**             | Keys appear present; confirm www domain + redeploy history     |
| **#129** Convex `CLERK_JWT_ISSUER_DOMAIN` | **Yes — secondary** | Required for post-login Convex calls; verify after DNS         |
| **#130** Google OAuth credentials         | **Yes — tertiary**  | Google sign-in only; email may work once #127+#129 are correct |

---

## Sources

| Source                                                                               | Use                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [#125](https://github.com/HayGrouve/onova-za-smetkata/issues/125)                    | Wayfinder destination + prod symptom                       |
| [#126](https://github.com/HayGrouve/onova-za-smetkata/issues/126)                    | Research question                                          |
| `docs/clerk-production-setup.md`                                                     | Env matrix, custom domain, OAuth redirect, troubleshooting |
| `src/integrations/convex/provider.tsx`                                               | Loading gates, missing-config UI                           |
| `src/routes/login.tsx`, `src/hooks/use-require-host-auth.ts`, `src/routes/index.tsx` | Client auth flow                                           |
| `src/start.ts`                                                                       | Server `clerkMiddleware`                                   |
| `convex/auth.config.ts`                                                              | JWT issuer dependency                                      |
| Live probes                                                                          | curl/openssl/Python DNS against prod (2026-08-11)          |
| Context7 `/clerk/clerk-docs`                                                         | Production DNS, Cloudflare, JWT issuer format              |

---

## Open questions (for work-through session)

- Whether `clerk.onova-za-smetkata.com` was added as a **Vercel project domain** by mistake (explains A → Vercel IPs).
- Exact CNAME target from Clerk Dashboard (not exposed in repo; copy during #127 fix).
- Convex prod value of `CLERK_JWT_ISSUER_DOMAIN` (dashboard-only; cannot verify externally).
- Whether Clerk allowed domains include `www.onova-za-smetkata.com` given apex → www redirect.
