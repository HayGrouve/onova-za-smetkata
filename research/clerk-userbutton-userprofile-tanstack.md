# Research: Clerk UserButton + in-app UserProfile on TanStack Start

> **Decision already locked:** Host account = Clerk `<UserButton />` in **navigation** mode + a dedicated in-app `<UserProfile />` catch-all. Not Account Portal. Not `openUserProfile()` modal. Host profile (`Профил` sheet) stays. No Clerk Billing. No UserProfile custom pages for payment/groups. Planning only — this file does not implement.

Ticket: [#139](https://github.com/HayGrouve/onova-za-smetkata/issues/139) (parent [#138](https://github.com/HayGrouve/onova-za-smetkata/issues/138)). Domain split: [CONTEXT.md](../CONTEXT.md) (Host account vs Host profile). Auth: [ADR 0002](../docs/adr/0002-clerk-auth-billing.md). Host Pro: [ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md).

## Question

How do we mount Clerk **UserButton** (navigation mode) and an in-app **UserProfile** catch-all with `@clerk/tanstack-react-start` so Hosts get Account and Security (email, password/passkeys, MFA, connected accounts, sessions, delete account) without Account Portal or the `openUserProfile()` modal?

## Verdict

Use Clerk’s documented TanStack catch-all at **`/user-profile/$`**, render `<UserProfile routing="path" path="/user-profile" />`, and point the header `<UserButton />` at that page with **`userProfileMode="navigation"`** and **`userProfileUrl="/user-profile"`**. Gate the route with the same `useRequireHostAuth` used on `/` and `/bills/$billId`. Show UserButton only when `showHostActions` is true (signed-in Host, not guest join/claim, not `/login`). Keep default **Account** and **Security** pages; do not add custom pages. Hide Billing by never enabling Clerk Billing; hide API Keys in the component if the Dashboard feature is on. Stop calling `openUserProfile()` from the profile sheet and paywall — those were Clerk-modal workarounds, not Host account UX.

---

## What this repo has today

| Surface       | Behavior                                                                                  | Source                                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clerk SDK     | `@clerk/tanstack-react-start` `^1.4.25`, `@clerk/localizations` `bgBG`                    | [`package.json`](../package.json), [`src/integrations/convex/provider.tsx`](../src/integrations/convex/provider.tsx)                                                                                                    |
| Provider      | `<ClerkProvider publishableKey localization={bgBG}>` — no `userProfileUrl`, no UserButton | [`src/integrations/convex/provider.tsx`](../src/integrations/convex/provider.tsx)                                                                                                                                       |
| Sign-in       | In-app `<SignIn routing="hash" />` on `/login` — not Account Portal                       | [`src/routes/login.tsx`](../src/routes/login.tsx)                                                                                                                                                                       |
| Host gate     | `useRequireHostAuth(path)` → unsigned users to `/login?redirect=…`                        | [`src/hooks/use-require-host-auth.ts`](../src/hooks/use-require-host-auth.ts); used on [`src/routes/index.tsx`](../src/routes/index.tsx), [`src/routes/bills/$billId/index.tsx`](../src/routes/bills/$billId/index.tsx) |
| Header        | Kebab only. `showHostActions = isSignedIn && !isGuestRoute && !isLogin`                   | [`src/components/layout/app-header.tsx`](../src/components/layout/app-header.tsx)                                                                                                                                       |
| Kebab         | Product **Профил**, payment settings, groups, guidance, **Изход** (`signOut` + confirm)   | [`src/components/layout/app-header-menu.tsx`](../src/components/layout/app-header-menu.tsx)                                                                                                                             |
| Profile sheet | Convex username + quotas + button **Управление на абонамента** → `openUserProfile()`      | [`src/components/profile/profile-sheet.tsx`](../src/components/profile/profile-sheet.tsx)                                                                                                                               |
| Paywall       | `onUpgrade` → `openUserProfile()`                                                         | [`src/components/subscription/subscription-provider.tsx`](../src/components/subscription/subscription-provider.tsx)                                                                                                     |
| Catch-all     | `src/routes/$.tsx` is the **404** splat (`createFileRoute('/$')`)                         | [`src/routes/$.tsx`](../src/routes/$.tsx)                                                                                                                                                                               |

There is **no** `<UserButton />` or `<UserProfile />` mount today. Host account management is accidentally the **modal** via `useClerk().openUserProfile()`, which Clerk documents as an overlay on `document.body` ([JS `openUserProfile()`](https://clerk.com/docs/js-frontend/reference/components/user/user-profile)). That is the path this ticket rejects.

---

## Do not use Account Portal or the modal

Clerk offers three ways to show UserProfile:

| Mode                                      | How                                                                        | Use here?                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Account Portal** (Clerk-hosted `/user`) | Hosted pages; `RedirectToUserProfile` / `redirectToUserProfile()`          | **No.** Portal pages are hosted on Clerk, cannot use in-app localization the same way, and are the “fastest hosted” option — opposite of self-contained prebuilt components ([Account Portal overview](https://clerk.com/docs/tanstack-react-start/guides/account-portal/overview)). |
| **Modal**                                 | `<UserButton />` default `userProfileMode='modal'`, or `openUserProfile()` | **No.** Default is modal ([UserButton properties](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-button)).                                                                                                                                               |
| **Dedicated in-app page**                 | Catch-all route + `userProfileMode='navigation'` + `userProfileUrl`        | **Yes.** Clerk’s dedicated-page tab: set `userProfileMode='navigation'` and `userProfileUrl='/user-profile'` ([custom pages — Before you start](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-profile)).                                    |

`appearance` on in-app components **does not** style Account Portal pages ([ClerkProvider](https://clerk.com/docs/tanstack-react-start/reference/components/clerk-provider), [UserButton](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-button)). Localization `bgBG` already on `ClerkProvider` applies to prebuilt components, not Portal.

Do **not** use `<RedirectToUserProfile />` / `clerk.redirectToUserProfile()` as the Host account entry — those send the user to the **configured** profile URL, which is Account Portal unless you mount in-app UserProfile and set `userProfileUrl` ([`redirectToUserProfile()`](https://clerk.com/docs/tanstack-react-start/reference/objects/clerk)).

---

## Recommended route path

**Canonical path:** `/user-profile`  
**File (this repo):** `src/routes/user-profile.$.tsx`  
**Route id:** `createFileRoute('/user-profile/$')`

This is Clerk’s TanStack Start example filename and route string ([`<UserProfile />` TanStack Start](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)):

```tsx
import { UserProfile } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/user-profile/$')({
  component: UserProfilePage,
})

function UserProfilePage() {
  return <UserProfile />
}
```

Clerk requires a **splat / catch-all** so UserProfile’s internal routes work (`/user-profile/security`, nested forms). TanStack splat: a path ending in `$` captures the remainder as `_splat` ([TanStack routing concepts](https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts#splat--catch-all-routes)). Clerk links that requirement to the same splat docs ([UserProfile TanStack](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)).

**Why not reuse `src/routes/$.tsx`?** That file is the app 404 (`createFileRoute('/$')`). A more specific `/user-profile/$` ranks above the global splat. Keep the 404 as-is.

**Directory alternative:** `src/routes/user-profile/$.tsx` is equivalent in TanStack file routing; Clerk’s published example uses the flat `user-profile.$.tsx` name. Either is fine if `createFileRoute('/user-profile/$')` matches.

**Head:** `buildNoIndexHead(…)` like `/login` ([`src/routes/login.tsx`](../src/routes/login.tsx)) — Host account is not a marketing page.

**Copy:** Do not title this page **Профил**. That word is reserved for the Convex Host profile sheet ([CONTEXT.md](../CONTEXT.md)). Clerk’s sidenav already labels Account / Security (Bulgarian via `bgBG`). App header title can be something like **Акаунт** if a product string is needed.

---

## Exact component props

### `<UserProfile />` on the catch-all

Clerk’s minimal example is a bare `<UserProfile />`. For path routing, dedicated-page examples set **`routing="path"`** and **`path="/user-profile"`** ([custom pages dedicated-page tab](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-profile)).

`<UserProfile />` props (all optional) ([UserProfile TanStack](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)):

| Prop                    | Set to                                          | Why                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routing`               | `'path'`                                        | Internal Account/Security URLs become `/user-profile/…`. Default is `'path'` for “frameworks that handle routing” (Next.js) and `'hash'` for other SDKs. **Set it explicitly** so TanStack Start is not treated as hash-only React. `/login` already uses **hash** for `<SignIn />` — mixed strategies are allowed; UserProfile **needs** path + splat. |
| `path`                  | `'/user-profile'`                               | Mount path when `routing='path'`. Ignored for hash.                                                                                                                                                                                                                                                                                                     |
| `appearance`            | optional later                                  | Styles this component only, not Account Portal.                                                                                                                                                                                                                                                                                                         |
| `fallback`              | optional spinner                                | While Clerk UI mounts.                                                                                                                                                                                                                                                                                                                                  |
| `additionalOAuthScopes` | omit unless product needs extra Google scopes   | Not required for connected-account management.                                                                                                                                                                                                                                                                                                          |
| `apiKeysProps`          | `{ hide: true }` if API keys feature is enabled | See pages table.                                                                                                                                                                                                                                                                                                                                        |
| `customPages`           | omit                                            | JS SDK only; React uses children.                                                                                                                                                                                                                                                                                                                       |

Recommended mount (no custom pages):

```tsx
<UserProfile
  routing="path"
  path="/user-profile"
  apiKeysProps={{ hide: true }}
/>
```

Optional explicit default pages (reorder API — **not** required to “keep” them; they are already the two defaults):

```tsx
<UserProfile routing="path" path="/user-profile" apiKeysProps={{ hide: true }}>
  <UserProfile.Page label="account" />
  <UserProfile.Page label="security" />
</UserProfile>
```

`<UserProfile.Page label="account" />` / `label="security"` **retargets** the built-in items for reorder. Custom pages need `label`, `labelIcon`, `url`, and `children` ([custom pages props](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-profile)). **Do not** add `UserProfile.Page` / `UserProfile.Link` for payment settings or friend groups — those stay in the kebab ([#139](https://github.com/HayGrouve/onova-za-smetkata/issues/139) constraints).

Do **not** use experimental `@clerk/ui` compose (`UserProfileProvider` / panels). Clerk marks it experimental, not semver-stable, and TanStack Start can duplicate Clerk context unless Vite `dedupe` is tuned ([UserProfile — Compose your own profile](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)). The ticket wants the full Account + Security UI, which the default component already is.

### `<UserButton />` in the host header

Clerk’s header example ([UserButton TanStack](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-button)):

```tsx
<Show when="signed-in">
  <UserButton />
</Show>
```

For this app, prefer the existing **`showHostActions`** flag over Clerk `<Show when="signed-in">` alone, so a signed-in Host on a **guest** join/claim URL still does not see Host account UI ([`app-header.tsx`](../src/components/layout/app-header.tsx)).

Required props for navigation mode ([UserButton properties](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-button); [Before you start](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-profile)):

```tsx
<UserButton
  userProfileMode="navigation"
  userProfileUrl="/user-profile"
  userProfileProps={{
    routing: 'path',
    path: '/user-profile',
    apiKeysProps: { hide: true },
  }}
/>
```

| Prop               | Value                        | Notes                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userProfileMode`  | `'navigation'`               | Default is `'modal'`. Navigation sends the browser to `userProfileUrl` instead of opening UserProfile as a modal.                                                                                                                                                                                                                     |
| `userProfileUrl`   | `'/user-profile'`            | Must match the catch-all mount.                                                                                                                                                                                                                                                                                                       |
| `userProfileProps` | path routing + hide API keys | Same options as `<UserProfile />`. If you only set props on the page component and not here, **Manage account** still navigates, but nested UserProfile config on the button is the documented pairing.                                                                                                                               |
| `showName`         | omit or `false`              | Header is tight (h-14 + logo). Avatar-only matches a mobile PWA.                                                                                                                                                                                                                                                                      |
| `appearance`       | optional                     | Button only; pass `userProfileProps.appearance` for the **page** if opened from the button ([appearance — nested components](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview)). With navigation mode, the page’s own `<UserProfile appearance>` is the one that matters after navigate. |

Default UserButton menu items: **Manage account** and **Sign out** ([UserButton custom items](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-button)). Reorder with `<UserButton.Action label="manageAccount" />` / `label="signOut"`. There is **no** documented `hide: true` for those defaults (unlike `apiKeysProps.hide`). Do **not** add `<UserButton.UserProfilePage>` custom pages.

`ClerkProvider` has **no** `userProfileUrl` prop in the current TanStack reference ([ClerkProvider properties](https://clerk.com/docs/tanstack-react-start/reference/components/clerk-provider)). Wire URL on **UserButton**, not the provider. Vite env docs cover sign-in/up URLs, not a `VITE_CLERK_USER_PROFILE_URL` ([environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables)).

---

## Auth gating (guests never see Host account UI)

Guests join with a share token, not Clerk ([CONTEXT.md](../CONTEXT.md), [ADR 0002](../docs/adr/0002-clerk-auth-billing.md)). Gating is two layers:

### 1. Do not render UserButton on guest chrome

Reuse `showHostActions` in [`app-header.tsx`](../src/components/layout/app-header.tsx):

```ts
const isGuestRoute =
  pathname.endsWith('/join') || (pathname.endsWith('/claim') && !isHostClaim)
const showHostActions = isSignedIn && !isGuestRoute && !isLogin
```

Place `<UserButton … />` next to the kebab **only when `showHostActions`**. Theme + bill actions stay in the kebab. A Host who opens a guest QR while still signed in keeps the kebab’s theme switcher but **must not** get UserButton on join/claim (same rule as Профил / Изход today).

Extend `resolveRouteContext` / `useHeaderConfig` so `/user-profile` is not treated as a mystery “home” title with the marketing logo if that looks wrong; gating itself does not depend on that.

### 2. Protect the catch-all like other Host routes

On the UserProfile route, call the same hook as home/editor:

```ts
const { isAuthenticated, isLoading } = useRequireHostAuth('/user-profile')
```

Unsigned visitors → `/login?redirect=/user-profile` ([`use-require-host-auth.ts`](../src/hooks/use-require-host-auth.ts)). That is correct: there is no Guest Clerk account to manage.

`useRequireHostAuth` is **client-side** (effect + navigate). Same as `/` and `/bills/$billId` today — no extra Clerk `<SignedIn>` required if the hook runs. Optional belt-and-suspenders: Clerk `<Show when="signed-in">` around `<UserProfile />`.

Do **not** rely on “guests aren’t signed in” alone. A signed-in Host can still hit `/join` and `/claim`; header gating is what hides account UI there.

### What guests still never get

- No UserButton, no UserProfile route in guest flows.
- Guest queries must not leak other participants’ payment details (existing rule in `.cursor/rules/context-core.mdc`) — UserProfile is Host-only and does not change guest APIs.

---

## Default pages: keep vs hide

Clerk UserProfile sidenav defaults: **Account** then **Security** ([reorder default routes](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-profile)). Core-2 split Security onto `/security` ([upgrade guide](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2)).

| Page / section       | Keep?          | How it appears                       | Notes                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | -------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account**          | **Keep**       | Default                              | Profile photo / name from IdP. Not Convex **Username**. Prefer Dashboard: do not enable Clerk **username** as an identifier so Hosts do not confuse it with `Профил` → `Потребителско име` ([CONTEXT.md](../CONTEXT.md)).                                                                                                                                            |
| **Security**         | **Keep**       | Default                              | Email, password, passkeys, MFA, connected accounts, active sessions, delete account — driven by Dashboard auth settings and `user.deleteSelfEnabled` ([User resource](https://clerk.com/docs/js-frontend/reference/objects/user)). Enable delete-self in Clerk Dashboard if Hosts must delete the Host account from this UI.                                         |
| **Billing / Plans**  | **Hide**       | Appears when Clerk Billing is on     | “If it's a user Plan, it can appear in the UserProfile component” ([B2C Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c)). **Do not enable Clerk Billing** ([ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md)). There is no first-party “hide Billing tab” besides leaving Billing off / marking plans not publicly available. |
| **API Keys**         | **Hide**       | Appears if API keys feature enabled  | Pass `apiKeysProps={{ hide: true }}` on `<UserProfile />` and `userProfileProps` ([API keys](https://clerk.com/docs/guides/development/machine-auth/api-keys)). This product does not issue user API keys. Hiding UI does not disable Frontend API key creation if the feature is on — leave the feature **disabled** in Dashboard.                                  |
| Custom pages / links | **Do not add** | Children of UserProfile / UserButton | Payment settings and groups stay in kebab.                                                                                                                                                                                                                                                                                                                           |

Clerk does **not** document a `hide` flag for Account or Security. Omitting `<UserProfile.Page label="account" />` does **not** remove Account; those two are built-in. Hiding them would mean experimental compose or CSS hacks — out of scope.

Phone numbers on Account/Security follow Dashboard phone settings. If the product does not collect phones, leave phone auth off so the section stays empty/absent.

---

## What profile-sheet / header should stop doing for Clerk

### Remove every `openUserProfile()` (modal)

| File                                                                                                                | Today                                                          | After                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/components/profile/profile-sheet.tsx`](../src/components/profile/profile-sheet.tsx)                           | `useClerk().openUserProfile()` on **Управление на абонамента** | **Delete** `openUserProfile` import/call. Sheet stays Convex username + quota readout. Subscription management is **Stripe** (ADR 0003), not Clerk UserProfile. Retarget that button to Stripe Customer Portal / pricing when Host Pro UI exists; until then, do not open Clerk. |
| [`src/components/subscription/subscription-provider.tsx`](../src/components/subscription/subscription-provider.tsx) | Paywall `onUpgrade={() => openUserProfile()}`                  | **Delete** `openUserProfile`. Same Stripe retarget. Opening UserProfile from a quota paywall would dump Hosts into Account/Security, not checkout.                                                                                                                               |

Grep after implementation should find **zero** `openUserProfile` in `src/`.

### Header: start doing Host account; kebab stays product

| Control                           | Keep / change                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kebab **Профил**                  | **Keep** — opens product sheet (username + usage). Do not navigate to `/user-profile`.                                                                       |
| Kebab payment / groups / guidance | **Keep** — not UserProfile pages.                                                                                                                            |
| Kebab **Изход**                   | **Keep** (confirm dialog in [`getSignOutCopy`](../src/lib/destructive-action-copy.ts)). UserButton also ships **Sign out** without that confirm — see risks. |
| UserButton                        | **Add** when `showHostActions`. Entry to Host account (“Manage account” → `/user-profile`).                                                                  |
| Viewer label in kebab             | Optional overlap with UserButton avatar; can stay as context.                                                                                                |

`AppHeaderMenu` must **not** grow a “Clerk account” item that calls `openUserProfile()`.

---

## Localization

`ClerkProvider` already passes `localization={bgBG}` ([`provider.tsx`](../src/integrations/convex/provider.tsx)). In-app UserButton / UserProfile pick that up; Account Portal would **not** ([ClerkProvider](https://clerk.com/docs/tanstack-react-start/reference/components/clerk-provider)). Another reason to stay off Portal.

---

## Open risks

### Mobile layout of UserProfile (highest)

This app is a **mobile-first PWA**: sticky `h-14` header, `page-shell` / `max-w-lg`, `viewport-fit=cover` ([`__root.tsx`](../src/routes/__root.tsx), [`app-header.tsx`](../src/components/layout/app-header.tsx)). Clerk UserProfile is a **full account management UI with a sidenav** (Account / Security). Clerk does not publish a mobile layout spec for TanStack Start. Risks to verify on a phone-width viewport before shipping:

1. **Width** — UserProfile’s card is built for a two-pane desktop navbar. Nested in `max-w-lg` it may clip, double-scroll, or overflow. Prefer a **full-bleed** main on `/user-profile` (no `max-w-lg` wrapper), then constrain with `appearance.elements` if needed ([appearance](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview)).
2. **Double chrome** — App sticky header + Clerk’s own navbar (`userProfile.navbar` strings in Core-2 localization). Back chevron vs Clerk’s internal back on `/user-profile/security`.
3. **Modal vs page** — Navigation mode avoids a second overlay on a small screen (the current `openUserProfile()` problem). Path routing still needs the splat or Security subpages 404 into [`$.tsx`](../src/routes/$.tsx).
4. **Hash vs path** — `/login` uses `routing="hash"` for SignIn. If UserProfile accidentally stays on hash, URLs like `/user-profile#/security` fight TanStack. Set `routing="path"` on both the page and `userProfileProps`.
5. **PWA / iOS** — Safe-area and Clerk’s inner scroll. Test install-to-home-screen.

Mitigations (implementation, not this research): `appearance` variables to match theme; optional `fallback`; E2E that signed-in Host can open UserButton → `/user-profile` and `/user-profile/security`; screenshot pass at 390px width.

### Duplicate sign-out

UserButton always exposes **Sign out** unless Clerk later adds hide. Kebab **Изход** uses a confirm. Two exits with different safety. Product choice: keep kebab confirm for destructive habit; accept Clerk’s unconfirmed sign-out, or stop putting **Изход** in the kebab (Hosts would only sign out from UserButton). Clerk does not document hiding `signOut` the way it documents `apiKeysProps.hide`.

### Clerk username vs product Username

Account page can show a Clerk username field if enabled in Dashboard. Product Username is Convex-only ([CONTEXT.md](../CONTEXT.md)). Disable Clerk username identifier in Dashboard.

### Account deletion vs Convex `users` row

Security “delete account” calls Clerk `user.delete()`. Convex `users` keyed by `clerkSubject` may remain unless a `user.deleted` webhook exists. Out of scope for mount research; flag for a follow-up if delete-self is enabled.

### Experimental compose / Vite duplicate Clerk

Do not pull `@clerk/ui/experimental` for this ticket. Clerk already warns TanStack Vite can inline a second Clerk context (`useClerk can only be used within <ClerkProvider />`) ([UserProfile compose](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)).

---

## Implementation sketch (not done here)

1. Add `src/routes/user-profile.$.tsx` with `useRequireHostAuth('/user-profile')` + `<UserProfile routing="path" path="/user-profile" apiKeysProps={{ hide: true }} />`.
2. In `AppHeader`, when `showHostActions`, render `<UserButton userProfileMode="navigation" userProfileUrl="/user-profile" userProfileProps={{ routing: 'path', path: '/user-profile', apiKeysProps: { hide: true } }} />`.
3. Remove `openUserProfile` from `profile-sheet.tsx` and `subscription-provider.tsx`.
4. Leave kebab **Профил** / payment / groups unchanged.
5. Confirm Clerk Dashboard: Billing off, user API keys off, delete-self as product wants, Clerk username identifier off.
6. Manual + E2E: Host-only visibility; guest join/claim has no UserButton; unsigned `/user-profile` → login.

---

## Sources

### Clerk (primary)

- [UserProfile — TanStack React Start](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile) — catch-all `createFileRoute('/user-profile/$')`, `routing` / `path`, experimental compose warning.
- [UserButton — TanStack React Start](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-button) — `userProfileMode`, `userProfileUrl`, `userProfileProps`, default modal.
- [Add custom pages to UserProfile](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-profile) — dedicated page: `userProfileMode='navigation'` + `userProfileUrl='/user-profile'`; default Account + Security; `UserProfile.Page` `label="account"|"security"`.
- [Add custom items to UserButton](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/adding-items/user-button) — default Manage account + Sign out.
- [Account Portal overview](https://clerk.com/docs/tanstack-react-start/guides/account-portal/overview) — hosted pages vs in-app prebuilt components; Portal user profile page.
- [ClerkProvider](https://clerk.com/docs/tanstack-react-start/reference/components/clerk-provider) — localization/appearance do not affect Account Portal; no `userProfileUrl` prop.
- [Appearance prop](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview) — `userProfileProps.appearance` when UserButton opens UserProfile.
- [B2C Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c) — user Plans appear in UserProfile when Billing is enabled.
- [API keys](https://clerk.com/docs/guides/development/machine-auth/api-keys) — API Keys tab; `apiKeysProps={{ hide: true }}`.
- [JS `openUserProfile()`](https://clerk.com/docs/js-frontend/reference/components/user/user-profile) — overlay on `body`.
- [`redirectToUserProfile()`](https://clerk.com/docs/tanstack-react-start/reference/objects/clerk)
- [Environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables) — Vite `VITE_CLERK_SIGN_IN_URL` family; no user-profile URL env.
- [Core-2 UserProfile Account vs Security](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2)
- [User object](https://clerk.com/docs/js-frontend/reference/objects/user) — emails, passkeys, sessions, `delete()`, `deleteSelfEnabled`.

### TanStack

- [Splat / catch-all routes](https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts#splat--catch-all-routes)

### This repo

- [`package.json`](../package.json), [`src/integrations/convex/provider.tsx`](../src/integrations/convex/provider.tsx), [`src/start.ts`](../src/start.ts)
- [`src/hooks/use-require-host-auth.ts`](../src/hooks/use-require-host-auth.ts)
- [`src/components/layout/app-header.tsx`](../src/components/layout/app-header.tsx), [`app-header-menu.tsx`](../src/components/layout/app-header-menu.tsx)
- [`src/components/profile/profile-sheet.tsx`](../src/components/profile/profile-sheet.tsx)
- [`src/components/subscription/subscription-provider.tsx`](../src/components/subscription/subscription-provider.tsx)
- [`src/routes/login.tsx`](../src/routes/login.tsx), [`src/routes/$.tsx`](../src/routes/$.tsx)
- [CONTEXT.md](../CONTEXT.md), [ADR 0002](../docs/adr/0002-clerk-auth-billing.md), [ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md)
- [#139](https://github.com/HayGrouve/onova-za-smetkata/issues/139)
