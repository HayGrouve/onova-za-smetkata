# Research: Clerk Bulgarian localization and appearance for Host account

Part of wayfinder map [#138](https://github.com/HayGrouve/onova-za-smetkata/issues/138). Resolves research ticket [#140](https://github.com/HayGrouve/onova-za-smetkata/issues/140).

Prior notes: [`research/localization-approach.md`](./localization-approach.md) (app i18n vs Clerk catalogs), [`docs/specs/i18n-implementation.md`](../docs/specs/i18n-implementation.md), [`docs/clerk-production-setup.md`](../docs/clerk-production-setup.md) §1.3.

## Question

How do we apply Clerk **Bulgarian** localization (`bgBG` / `@clerk/localizations`) and Clerk **appearance** so UserButton and UserProfile match this PWA (Bulgarian copy, light/dark/system via `next-themes`)?

Cover: package and `ClerkProvider` wiring, gaps in the official bg pack, and the recommended appearance approach (theme sync vs leave Clerk default).

**Locked:** use Clerk Bulgarian localization (not a custom-from-scratch catalog). **Planning only.**

## Executive summary

| Concern                                   | Finding                                                                                                                                                                                                                       | Recommendation                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package**                               | App already depends on `@clerk/localizations@^4.13.9` and `@clerk/tanstack-react-start@^1.4.25` ([`package.json`](../package.json)). No `@clerk/ui` / `@clerk/themes`.                                                        | Keep `@clerk/localizations`. Do **not** add `@clerk/ui` unless adopting a prebuilt theme (`dark`, `shadcn`, …).                                                                                                                                                                    |
| **`ClerkProvider` localization**          | `localization={bgBG}` on `ClerkProvider` is the documented way to localize **all** embedded Clerk components, including UserButton and UserProfile.                                                                           | Wiring is **complete for coverage**. It is **not** complete for **100% Bulgarian strings** (community pack + English fallback).                                                                                                                                                    |
| **UserButton / UserProfile in this repo** | There is **no** `<UserButton />`. Host chrome is a custom menu (`signOut`) plus product **Профил** sheet. Clerk **UserProfile** opens via `openUserProfile()`.                                                                | Keep modal UserProfile (embedded component). Do not send Hosts to hosted Account Portal if Bulgarian copy is required.                                                                                                                                                             |
| **bg pack gaps**                          | `bgBG` is community-maintained; many keys are `undefined` and fall back to English. Host-visible leftovers exist in UserProfile (MFA SMS, passkeys, some password/OAuth copy). Billing keys are almost entirely untranslated. | Spread `bgBG` and override Host-visible keys. Do **not** enable Clerk Billing ([ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md)) so billing English tabs stay hidden.                                                                                                   |
| **Appearance vs `next-themes`**           | Clerk’s **default** theme already follows CSS `color-scheme`. This app sets `color-scheme: dark` on `.dark` and uses `next-themes` `attribute="class"`.                                                                       | **Sync via CSS `color-scheme`**, not by toggling `appearance.theme: dark` from `useTheme()`. Optionally map `appearance.variables` to existing `--primary` / `--radius` tokens. Do not leave Clerk unthemed _and_ ignore `color-scheme`; the class hook is already the right seam. |

---

## Current wiring in this repo

### Localization (already present)

```110:110:src/integrations/convex/provider.tsx
    <ClerkProvider publishableKey={clerkPublishableKey} localization={bgBG}>
```

- Import: `import { bgBG } from '@clerk/localizations'` ([`src/integrations/convex/provider.tsx`](../src/integrations/convex/provider.tsx)).
- Dashboard does **not** set Bulgarian; docs in this repo already say UI locale is **app code** ([`docs/clerk-production-setup.md`](../docs/clerk-production-setup.md) §1.3).
- Clerk’s `localization` prop “Will only affect Clerk Components and not Account Portal pages” ([ClerkProvider props](https://clerk.com/docs/tanstack-react-start/reference/components/clerk-provider), [localization guide](https://clerk.com/docs/guides/customizing-clerk/localization)).

That single prop is sufficient to feed **UserButton**, **UserProfile**, **SignIn**, and any other embedded Clerk UI. There is no separate UserProfile localization prop.

### What Hosts actually see

| Surface                                                | Implementation                                     | Localized by `bgBG`?                                        |
| ------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| Sign-in                                                | `<SignIn routing="hash" … />` on `/login`          | Yes (embedded component).                                   |
| Host overflow menu (theme, Профил, Изход)              | Custom UI + `useTheme()` + `signOut()`             | **No** — app copy, not Clerk.                               |
| Product Host profile (username, usage)                 | `ProfileSheet`                                     | **No** — app copy.                                          |
| Clerk Host **account** (emails, MFA, sessions, delete) | `openUserProfile()` from profile sheet and paywall | Yes, if it stays an **embedded modal**, not Account Portal. |

[`CONTEXT.md`](../CONTEXT.md) already splits **Host account** (Clerk UserButton / UserProfile) from in-app **Профил**. This ticket is about the Clerk layer only.

### Theme stack (already present)

- `next-themes@^0.4.6`; `ThemeProvider` in [`src/routes/__root.tsx`](../src/routes/__root.tsx): `attribute="class"`, `defaultTheme="dark"`, `enableSystem`, `storageKey="onova-theme"`.
- **`ThemeProvider` wraps `ConvexProvider` → `ClerkProvider`**, so the `html`/body `.dark` class is in place before Clerk UI mounts.
- [`src/styles.css`](../src/styles.css): `.dark { color-scheme: dark; }`. `:root` does **not** set `color-scheme: light`.
- Toaster already syncs with `useTheme()` ([`src/components/ui/sonner.tsx`](../src/components/ui/sonner.tsx)). Clerk does not.

`ClerkProvider` currently has **no** `appearance` prop.

---

## Localization: how Clerk expects this to be wired

### Package and import

1. Install `@clerk/localizations` ([localization guide](https://clerk.com/docs/guides/customizing-clerk/localization)).
2. Import the pack by stripping the hyphen from the BCP 47 tag: `bg-BG` → `bgBG`. Bulgarian is listed as a supported language in that table.
3. Pass it to `ClerkProvider`: `localization={bgBG}`.

Optional tighter import (tree-shake even in unoptimized builds): `import { bgBG } from '@clerk/localizations/bg-BG'` ([same guide, Bundle size](https://clerk.com/docs/guides/customizing-clerk/localization)).

Clerk marks the localization feature **Experimental** on that page (may change). Treat pack upgrades as a visual/string QA pass, not a silent patch.

`en-US` is the **only** locale Clerk officially maintains; all others, including Bulgarian, are community contributions ([`@clerk/localizations` README](https://github.com/clerk/javascript/blob/main/packages/localizations/README.md)). The `bg-BG.ts` file itself carries a community-contribution disclaimer ([source](https://github.com/clerk/javascript/blob/main/packages/localizations/src/bg-BG.ts)).

### What `bgBG` does **not** cover

- **App copy** (bill editor, guest join, toasts, product Профил). Already stated in [`research/localization-approach.md`](./localization-approach.md): Clerk catalog is orthogonal to Paraglide / shared message modules.
- **Hosted Account Portal.** Localization and `appearance` apply only to components you mount. Account Portal pages stay English unless Clerk Dashboard options cover them; Clerk says Account Portal cannot be customized beyond Dashboard options, and if you need localization you should use prebuilt components ([Account Portal overview](https://clerk.com/docs/guides/account-portal/overview), [localization usage note](https://clerk.com/docs/guides/customizing-clerk/localization)).
- **Future Paraglide English.** Spec already plans `localization={locale === 'en' ? enUS : bgBG}` ([`docs/specs/i18n-implementation.md`](../docs/specs/i18n-implementation.md)). Out of scope for #140 (Bulgarian-only product today; `<html lang="bg">`).

### UserButton vs UserProfile

- **`<UserButton />`**: avatar menu; “Manage account” opens UserProfile. Default `userProfileMode` is `'modal'` ([UserButton](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-button)). Provider `localization` + `appearance` apply. Per-instance UserProfile styling uses `userProfileProps.appearance` because “the top-level `appearance` prop only applies to the component that receives it” ([appearance overview](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview)).
- **`<UserProfile />` / `openUserProfile()`**: full account UI (profile, security, and **Billing** if Clerk Billing is on) ([UserProfile](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)). This repo uses `openUserProfile()`, not a mounted page.

**Recommendation:** do **not** add `<UserButton />` just for localization. The custom header already owns sign-out and theme. Keep opening Clerk account as a **modal** so `bgBG` applies. Avoid `userProfileMode: 'navigation'` to Account Portal URLs.

If a future ticket mounts `<UserButton />`, `ClerkProvider localization={bgBG}` is still enough for strings; only appearance would need `userProfileProps` if SignIn/UserButton/UserProfile should look different from each other.

---

## Gaps in the official `bgBG` pack

Clerk localizations are `DeepPartial`. Keys set to `undefined` **fall back to English** ([clerk-js fallback when key is undefined](https://github.com/clerk/javascript/commit/79eb5afd91d7b002faafd2980850d944acb37917); [locale generate aligns missing keys as `undefined`](https://github.com/clerk/javascript/pull/9100)).

Inspected against Clerk `main` `packages/localizations/src/bg-BG.ts` (same shape shipped in `@clerk/localizations`; confirm on upgrade).

### Community / structural

- File header: community contribution, not guaranteed complete ([bg-BG.ts](https://github.com/clerk/javascript/blob/main/packages/localizations/src/bg-BG.ts)).
- Entire sections left `undefined` (API keys, many badges, waitlist still English, most **billing** strings).

### Host-visible UserButton keys

Translated: manage account, sign out, add account, popover label.

Still `undefined` (a11y / menu chrome if UserButton is added):

- `userButton.action__openUserMenu`
- `userButton.action__closeUserMenu`

### Host-visible UserProfile leftovers (English or `undefined`)

These are the ones a Host is likely to hit with **Google + email** (this product’s methods) plus optional MFA/passkeys:

| Key area                                                                       | State in `bgBG`                     | Likely Host impact                                                                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `userProfile.navbar` account/security/title                                    | Translated (Профил / Сигурност)     | Good.                                                                                                                          |
| `userProfile.navbar.billing` / `apiKeys`                                       | `undefined`                         | English nav labels **if** those pages are enabled.                                                                             |
| `userProfile.billingPage.*`                                                    | Almost all `undefined`              | English Billing UI if Clerk Billing is on. **Keep Billing off** ([ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md)). |
| `userProfile.mfaPhoneCodePage.backButton`, `successMessage1/2`, `successTitle` | **English literals** in the bg file | SMS MFA enablement.                                                                                                            |
| `userProfile.phoneNumberPage.verifyTitle` / `verifySubtitle`                   | English literals                    | Phone verify.                                                                                                                  |
| `userProfile.passwordPage.checkboxInfoText__signOutOfOtherSessions`            | English literal                     | Password change.                                                                                                               |
| `userProfile.start.connectedAccountsSection.subtitle__reauthorize`             | English literal                     | Google reconnect / scope change.                                                                                               |
| `userProfile.start.passkeysSection.*`, `passkeyScreen.*`                       | `undefined`                         | Passkeys (English).                                                                                                            |
| `userProfile.emailAddressPage.enterpriseSSOLink.*`                             | `undefined`                         | Low (no enterprise SSO).                                                                                                       |
| Waitlist block                                                                 | Entirely English                    | Unused unless waitlist is enabled.                                                                                             |

Core-2 keys that **are** translated in bg (good): `formButtonPrimary__verify`, `formFieldInputPlaceholder__confirmDeletionUserAccount`, UserProfile navbar account/security ([Clerk Core 2 new keys](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2) vs [bg-BG.ts](https://github.com/clerk/javascript/blob/main/packages/localizations/src/bg-BG.ts)).

Date pipes in bg already use `'bg-BG'` (`timeString('bg-BG')`, `weekday('bg-BG','long')`) — correct per Clerk’s pipe syntax ([localization guide](https://clerk.com/docs/guides/customizing-clerk/localization)).

### How to fill gaps (without waiting on Clerk)

Clerk documents **custom localizations** by passing a `localization` object keyed like `en-US.ts` ([Custom localizations](https://clerk.com/docs/guides/customizing-clerk/localization)). There is no official deep-merge helper; nest overrides on top of the pack:

```tsx
import { bgBG } from '@clerk/localizations'

const localization = {
  ...bgBG,
  userButton: {
    ...bgBG.userButton,
    action__openUserMenu: 'Отвори менюто на акаунта',
    action__closeUserMenu: 'Затвори менюто на акаунта',
  },
  userProfile: {
    ...bgBG.userProfile,
    mfaPhoneCodePage: {
      ...bgBG.userProfile?.mfaPhoneCodePage,
      backButton: 'Използвай съществуващ номер',
      successTitle: 'Потвърждението със SMS код е включено',
      // …successMessage1/2
    },
    // passkeys, password checkbox, reauthorize subtitle, phone verify, …
  },
}

<ClerkProvider localization={localization} …>
```

Find keys via `data-localization-key` in the DOM or by searching [en-US.ts](https://github.com/clerk/javascript/blob/main/packages/localizations/src/en-US.ts) ([LocalizationResource typedoc](https://github.com/clerk/clerk-docs/blob/main/clerk-typedoc/shared/localization-resource.mdx)).

Upstream: fork `clerk/javascript` and translate `packages/localizations/src/bg-BG.ts` ([Adding or updating a localization](https://clerk.com/docs/guides/customizing-clerk/localization)). Good follow-up, not required to ship #140.

**Do not** try to translate Clerk Billing strings as a substitute for Stripe Customer Portal. Product Host Pro is Stripe ([ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md)); `openUserProfile()` as “Управление на абонамента” is leftover Clerk Billing UX ([`research/clerk-billing-integration-audit.md`](./clerk-billing-integration-audit.md)).

---

## Appearance: match light / dark / system

### Official mechanisms

| Mechanism                          | Where                            | Role                                                                                                                                                                                                                                                                    |
| ---------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default theme + CSS `color-scheme` | `global.css`                     | Default theme is light unless `color-scheme` says otherwise; `.dark { color-scheme: dark }` is Clerk’s documented class hook ([TanStack themes](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/themes)).                          |
| `appearance.theme`                 | `ClerkProvider` or per component | Prebuilt themes (`dark`, `shadcn`, `simple`, …) from `@clerk/ui/themes`. Requires **`@clerk/ui`**.                                                                                                                                                                      |
| `appearance.variables`             | Same                             | Brand tokens (`colorPrimary`, `borderRadius`, `fontFamily`, …). CSS `var(--token)` is supported for light/dark switching, with a caveat for old browsers ([variables](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/variables)). |
| `appearance.elements`              | Same                             | Fine-grained CSS on Clerk DOM ([appearance overview](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview)).                                                                                                                   |
| Clerk CSS variables                | stylesheet                       | `--clerk-color-primary`, etc. ([variables](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/variables)).                                                                                                                            |

`appearance` also **does not** style Account Portal ([ClerkProvider](https://clerk.com/docs/tanstack-react-start/reference/components/clerk-provider)).

### Why not `useTheme()` → `appearance={{ theme: dark }}`

That is how Sonner is synced in this app, and how older Clerk examples used `@clerk/themes` `dark`. Drawbacks here:

1. **`system` theme:** next-themes’ `theme` can be `"system"` while resolved class is `.dark` or not. Clerk’s `dark` theme is **always dark**, not “follow system” ([themes](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/themes)).
2. **Extra package:** current Clerk docs import `dark` from `@clerk/ui/themes` and require installing `@clerk/ui`. The app does not have that dependency.
3. **Double source of truth:** next-themes already flips `.dark`; Clerk documents that same class as the dark-mode switch for the **default** theme.
4. Provider remount / flash if appearance identity changes every theme toggle.

### Recommended approach (sync, CSS-first)

**1. Treat `color-scheme` as the Clerk ↔ next-themes contract** (already 80% done).

Clerk’s default theme: set `color-scheme: dark` on `.dark` (this repo already does). Optionally make light explicit:

```css
:root {
  color-scheme: light;
}

.dark {
  color-scheme: dark;
}
```

That matches Clerk’s “class” example and this app’s `attribute="class"` ([themes — Enable light and dark mode](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/themes)). No `appearance.theme` required. Light, dark, and **system** all work because next-themes adds/removes `.dark`.

**2. Optional brand alignment via `variables` on `ClerkProvider`** (same object for SignIn + UserProfile modal).

Map to existing tokens in [`src/styles.css`](../src/styles.css) (copper `--primary`, `--radius`, Manrope). Clerk’s own example for automatic dark/light is `colorPrimary: 'var(--brand-primary)'` with different values in `:root` vs dark ([variables — Using CSS variables](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/variables)). This PWA’s tokens already change under `.dark`, so `var(--primary)` / `var(--background)` / `var(--foreground)` is the natural mapping.

Caveat: Clerk warns that `color-mix()` / relative color on those variables needs recent Chromium/Safari; they prefer hex if targeting old browsers. This is a **mobile PWA** (modern WebViews) — CSS variables are acceptable.

Suggested starting set (not an implementation):

- `colorPrimary: 'var(--primary)'`
- `colorDanger: 'var(--destructive)'`
- `colorSuccess: 'var(--success)'`
- `borderRadius: 'var(--radius)'`
- `fontFamily: 'inherit'` (Clerk default is already `inherit` — Manrope on `body` should flow in)

Do **not** pass `colorForeground: '#000'` globally; that fights dark mode. Prefer CSS variables that already flip.

**3. Do not adopt `appearance.theme: dark` or the shadcn Clerk theme for v1 of this ticket.**

- Forced `dark` theme fights `defaultTheme` / user light preference.
- Clerk `shadcn` theme needs `@clerk/ui` + `@import '@clerk/ui/themes/shadcn.css'` and Tailwind scanning that CSS ([themes — shadcn](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/themes)). Attractive later (this UI is already shadcn-like + Tailwind v4), but it is a larger visual project than “match light/dark/system”.

**4. Leave Clerk’s default theme** only if you add the `:root { color-scheme: light }` (or confirm light SignIn/UserProfile already look correct). “Leave default” **without** `color-scheme` on `.dark` would show a light Clerk modal on a dark PWA. That class rule is already present — keep it, don’t regress it.

### UserButton / UserProfile appearance specifically

Because UserProfile is opened from `openUserProfile()` rather than `<UserButton />`, **set `appearance` on `ClerkProvider`**. That styles SignIn and the UserProfile modal together ([appearance overview](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview)).

If `<UserButton />` is added later and UserProfile needs different tokens, use `userProfileProps.appearance` on the button ([same page](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview)).

---

## Completeness verdict for current `localization={bgBG}`

| Question                                                                                  | Answer                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the package + `ClerkProvider` wiring the right pattern for UserButton and UserProfile? | **Yes.** One `localization` prop covers all embedded Clerk components.                                                                                                              |
| Is it “done” for Bulgarian Host account UX?                                               | **Mostly.** Sign-in and core UserProfile chrome are translated. Gaps: English MFA/passkey/password/OAuth-reauth strings; untranslated billing (hide by not enabling Clerk Billing). |
| Must we mount `<UserButton />`?                                                           | **No.** `openUserProfile()` is enough if it stays a modal.                                                                                                                          |
| Must we pass `appearance` for theme?                                                      | **Not for dark mode itself** if `.dark { color-scheme: dark }` stays. **Yes** if we want copper/slate to match the PWA (`variables`).                                               |

---

## Recommended implementation plan (for a follow-up ticket)

1. **Keep** `localization={bgBG}` on `ClerkProvider`. Optionally switch import to `@clerk/localizations/bg-BG`.
2. **Add a small `clerkBgLocalization` module** that spreads `bgBG` and overrides Host-visible English/`undefined` keys (UserProfile MFA SMS, phone verify, password checkbox, Google reauthorize, passkeys, UserButton open/close). Do not translate Clerk Billing.
3. **Keep UserProfile as embedded modal**; never rely on Account Portal for Host account.
4. **Appearance:** keep default Clerk theme; ensure `:root { color-scheme: light }` + existing `.dark { color-scheme: dark }`. Optionally add `appearance.variables` mapped to CSS tokens. Do **not** wire `useTheme()` to `appearance.theme`.
5. **QA:** `/login` SignIn in light, dark, and system; `openUserProfile()` same three; Google connect + password + delete-account confirm string; confirm no Billing tab.
6. **Later (Paraglide):** swap pack with `enUS` per [`docs/specs/i18n-implementation.md`](../docs/specs/i18n-implementation.md). Still not Account Portal.

---

## Sources

### Clerk (primary)

- [Localization (`@clerk/localizations`, `bgBG`, custom keys, Account Portal English)](https://clerk.com/docs/guides/customizing-clerk/localization)
- [ClerkProvider — `localization` and `appearance` scope](https://clerk.com/docs/tanstack-react-start/reference/components/clerk-provider)
- [UserButton](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-button)
- [UserProfile](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)
- [Appearance overview (incl. `userProfileProps`)](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/overview)
- [Themes (`color-scheme`, `dark`, `shadcn`, `@clerk/ui`)](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/themes)
- [Variables (incl. CSS variables for light/dark)](https://clerk.com/docs/tanstack-react-start/guides/customizing-clerk/appearance-prop/variables)
- [Account Portal — no localization beyond Dashboard](https://clerk.com/docs/guides/account-portal/overview)
- [Core 2 localization key fallbacks](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2)
- [`bg-BG.ts` (community pack)](https://github.com/clerk/javascript/blob/main/packages/localizations/src/bg-BG.ts)
- [`@clerk/localizations` README — only `en-US` officially maintained](https://github.com/clerk/javascript/blob/main/packages/localizations/README.md)
- [Undefined keys fall back to English](https://github.com/clerk/javascript/commit/79eb5afd91d7b002faafd2980850d944acb37917)

### This repo

- [`package.json`](../package.json) — `@clerk/localizations@^4.13.9`, `@clerk/tanstack-react-start@^1.4.25`, `next-themes@^0.4.6`
- [`src/integrations/convex/provider.tsx`](../src/integrations/convex/provider.tsx)
- [`src/routes/__root.tsx`](../src/routes/__root.tsx), [`src/styles.css`](../src/styles.css)
- [`src/routes/login.tsx`](../src/routes/login.tsx), [`src/components/profile/profile-sheet.tsx`](../src/components/profile/profile-sheet.tsx)
- [`research/localization-approach.md`](./localization-approach.md)
- [ADR 0003 — Stripe Billing, not Clerk Billing](../docs/adr/0003-stripe-billing-beside-clerk.md)
