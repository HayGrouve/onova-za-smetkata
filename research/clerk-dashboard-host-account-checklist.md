# Research: Clerk Dashboard Host account feature checklist

> **Planning only.** Do not change the Clerk instance, app code, or git from this note.
> Ticket: [#141](https://github.com/HayGrouve/onova-za-smetkata/issues/141) (wayfinder #138).
> Retrieved Clerk docs: **2026-08-17**.

## Question

Which **Clerk Dashboard** instance settings must be **on or off** so prebuilt `<UserProfile />` / `openUserProfile()` is a full **Host account** surface:

- Keep **Google + email** sign-in as today
- Add **password and/or passkeys**, **MFA**, **active sessions**, **account deletion**
- **Without** Organizations, phone, or **Clerk Billing** Plans

This is a spec checklist for instance configuration, not a custom UserProfile UI.

## Verdict

Drive Host account from **Dashboard auth strategies + User model + Multi-factor**, not from composing `@clerk/ui/experimental` panels. Clerk documents that `<UserProfile />` is the prebuilt account UI whose **available sections follow instance settings** ([sign-up and sign-in options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options); [TanStack Start `<UserProfile />`](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)).

**Target UserProfile (Account + Security only):**

| Page         | Should appear                                                                              | Should not appear                                     |
| ------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **Account**  | Profile (optional names), email addresses, connected Google                                | Phone numbers, Clerk username, Organizations switcher |
| **Security** | Password and/or passkeys, TOTP MFA + backup codes, active devices/sessions, delete account | SMS MFA (needs phone)                                 |
| **Billing**  | —                                                                                          | Plans, payments, statements                           |
| **API Keys** | —                                                                                          | User API keys tab                                     |

**Must stay off (product decisions already locked):** Organizations ([configure Organizations](https://clerk.com/docs/guides/organizations/configure) — disabled by default), phone identifier, Clerk Billing / Plans for Users ([ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md), [B2C Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c)).

**Must stay on (today’s Host sign-in):** Email + Google ([`docs/clerk-production-setup.md`](../docs/clerk-production-setup.md) §1.2 / §1.8; [Google social connection](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)).

---

## Instance intent (this repo)

| Source                                                                                              | Intent                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ADR 0002](../docs/adr/0002-clerk-auth-billing.md)                                                  | Clerk = Host sign-in (Google + email) and user profile. Not checkout.                                                                                                                 |
| [ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md)                                         | Host Pro = Stripe Billing. Do **not** enable Clerk Billing.                                                                                                                           |
| [`docs/clerk-production-setup.md`](../docs/clerk-production-setup.md)                               | Prod: Google + email; **do not** turn on Billing → Plans for Users; skip connecting Stripe inside Clerk.                                                                              |
| [`research/clerk-auth-non-clerk-payments-coupling.md`](./clerk-auth-non-clerk-payments-coupling.md) | If Billing is on, user Plans appear in `UserProfile`. Disable / never enable so Host account is not a Clerk checkout.                                                                 |
| [`CONTEXT.md`](../CONTEXT.md)                                                                       | **Host account** = emails, password or passkeys, MFA, connected accounts, sessions, deletion in UserButton / UserProfile. **Username** in product `Профил` is **not** Clerk username. |

`docs/clerk-production-setup.md` “Architecture reminder” still says Clerk owns checkout/subscriptions; that line is **stale**. Treat ADR 0003 as authoritative.

---

## How UserProfile is gated

Clerk does **not** publish a single “UserProfile pages” Dashboard screen. Sections show up when the matching instance feature is enabled:

| UserProfile surface                     | Dashboard control                                                                          | If left off                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email addresses / email sign-in methods | **User & authentication → Email**                                                          | Hosts cannot use email OTP/link; Account email management is empty/disabled vs today.                                                                                                                                                                                                                       |
| Connected Google                        | **SSO connections → Google**, **Enable for sign-up and sign-in**                           | Sign-in loses Google; Account has no Google connected-account row (or cannot connect).                                                                                                                                                                                                                      |
| Password set/change                     | **User & authentication → Password**                                                       | Security has no password UI. Existing passwords still work until those users change ([Password](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#password)).                                                                                                                 |
| Passkeys enroll/manage                  | **User & authentication → Passkeys** (`user_auth_tab=passkeys`)                            | No passkey section. Users cannot create passkeys after sign-up ([Passkeys](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#passkeys)).                                                                                                                                      |
| MFA (authenticator / backup codes)      | **Multi-factor** page                                                                      | Security has no two-step setup. Optional MFA in “account settings” only exists if strategies are on and **Require MFA** is off ([MFA](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#multi-factor-authentication)).                                                        |
| SMS MFA                                 | Multi-factor **SMS** **and** phone sign-up/sign-in                                         | If SMS MFA is on without wanting phone: Clerk requires **Sign-up with phone** and **Sign-in with phone** for SMS second factor ([custom MFA flow](https://clerk.com/docs/guides/development/custom-flows/authentication/multi-factor-authentication)). **Keep SMS MFA off.**                                |
| Active devices / revoke session         | Built into UserProfile **Security** — **no feature toggle**                                | Always present on the prebuilt component ([UserProfile product page](https://clerk.com/components/user-profile); [how-we-roll: UserProfile](https://clerk.com/blog/how-we-roll-user-profile)). Dashboard **Sessions** only sets lifetime / multi-account-in-one-browser, not the device list.               |
| Delete account                          | **User model → Allow users to delete their accounts**                                      | No self-delete in UserProfile. `User.deleteSelfEnabled` is false ([User object](https://clerk.com/docs/react/reference/objects/user)).                                                                                                                                                                      |
| Phone numbers                           | **User & authentication → Phone** (sign-up/sign-in with phone)                             | Phone section appears once phone is an identifier ([add phone](https://clerk.com/docs/guides/development/custom-flows/account-updates/add-phone)). **Keep off.** Restrict-changes only hides edit if phone is already enabled.                                                                              |
| Clerk username                          | **User & authentication → Username**                                                       | Clerk username field on Account. Collides with in-app Host profile **Username**. **Keep off.**                                                                                                                                                                                                              |
| Organizations                           | **Organizations Settings → Enable Organizations**                                          | Org switcher / org profile / membership tasks. Default is **disabled** ([configure Organizations](https://clerk.com/docs/guides/organizations/configure)). **Do not enable.**                                                                                                                               |
| Billing / Plans                         | **Billing Settings** + **Plans for Users** (`npx clerk@latest enable billing --for users`) | User Plans appear in `<UserProfile />` when Billing is on ([B2C Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c); UserProfile copy includes “Billing settings”). Marketing: Billing tab **when billing is enabled** ([UserProfile](https://clerk.com/components/user-profile)). |
| API Keys tab                            | **Platform → API keys → Enable User API keys**                                             | Tab appears automatically ([API keys](https://clerk.com/docs/guides/development/machine-auth/api-keys)). **Keep disabled.** Hiding via `apiKeysProps={{ hide: true }}` is app code, not this spec.                                                                                                          |

---

## Checklist (spec target)

Apply independently on **dev** and **prod** Clerk applications. Prod Google still needs custom OAuth credentials ([Google](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)).

### Keep as today — ON

Dashboard: [User & authentication](https://dashboard.clerk.com/~/user-authentication/user-and-authentication), [SSO connections](https://dashboard.clerk.com/~/user-authentication/sso-connections).

| Setting                                          | State                           | Docs                                                                                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up with email                               | **ON**                          | [Email](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#email)                                                                                                                              |
| Require email address                            | **ON**                          | Same                                                                                                                                                                                                                        |
| Verify at sign-up (email code and/or email link) | **ON** (match current instance) | Same; 10-minute link expiry documented                                                                                                                                                                                      |
| Sign-in with email                               | **ON**                          | Same                                                                                                                                                                                                                        |
| Google SSO, **Enable for sign-up and sign-in**   | **ON**                          | [Social connections](https://clerk.com/docs/tanstack-react-start/guides/configure/auth-strategies/social-connections/overview); [Google](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) |
| Production Google **Use custom credentials**     | **ON** (prod only)              | Google guide; [`docs/clerk-production-setup.md`](../docs/clerk-production-setup.md) §1.8                                                                                                                                    |

**If email off:** SignIn loses magic link / OTP; UserProfile cannot manage emails. **If Google off:** SignIn loses “Вход с Google”; connected-accounts empty.

### Host account Security — ON

| Setting                                                             | State                                                           | Docs                                                                                                                                                                                                                | If left off                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Password** (enable password; need not be the only sign-in factor) | **ON**                                                          | [Password](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#password)                                                                                                                | No password UI on Security. Google/email-only remains.                                                                                                                                                                                                                         |
| **Passkeys** (Sign-in with passkey)                                 | **ON if Clerk production plan includes passkeys**; else **OFF** | [Passkeys](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#passkeys) — **paid plan for production**; enroll **after** sign-up only                                                  | No passkey management. Password (or email/Google) still works. Domain-tied: create passkeys on `onova-za-smetkata.com`, not Account Portal `accounts.dev`, in development ([custom passkeys](https://clerk.com/docs/guides/development/custom-flows/authentication/passkeys)). |
| **Authenticator application (TOTP)**                                | **ON**                                                          | [MFA](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#multi-factor-authentication); [manage MFA](https://clerk.com/docs/guides/development/custom-flows/account-updates/manage-mfa) | No authenticator setup in UserProfile.                                                                                                                                                                                                                                         |
| **Backup codes**                                                    | **ON** (with TOTP)                                              | Same                                                                                                                                                                                                                | MFA without recovery codes.                                                                                                                                                                                                                                                    |
| **Require multi-factor authentication**                             | **OFF**                                                         | MFA docs: if ON, every sign-in hits `setup-mfa` session task until enrolled                                                                                                                                         | Forced MFA for all Hosts (including Google-only) — not requested. Leave off so Hosts **opt in** via UserProfile.                                                                                                                                                               |
| **Allow users to delete their accounts**                            | **ON**                                                          | [User model](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#user-model)                                                                                                            | No delete control in UserProfile.                                                                                                                                                                                                                                              |

Ticket wording is **password and/or passkeys**. Spec default: **password ON**; **passkeys ON when the Clerk plan allows production use**. Either one yields a Security credential section; both is the full Host account surface in [`CONTEXT.md`](../CONTEXT.md).

### Must stay OFF

| Setting                                 | State                                                                        | Docs                                                                                                                                                                                | If left **on**                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up / sign-in with **phone**        | **OFF**                                                                      | [Phone](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#phone) (paid in production)                                                                 | UserProfile **Phone number** section; SMS cost; SMS allowlist (default US/CA only).                                                |
| MFA **SMS verification code**           | **OFF**                                                                      | MFA + [multi-factor custom flow](https://clerk.com/docs/guides/development/custom-flows/authentication/multi-factor-authentication) (SMS second factor needs phone sign-up/sign-in) | Phone identifier leaks in; SMS MFA in Security.                                                                                    |
| **Username** (Clerk)                    | **OFF**                                                                      | [Username](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#username)                                                                                | Second “username” next to in-app `Потребителско име`.                                                                              |
| Other OAuth (GitHub, Apple, …)          | **OFF**                                                                      | [SSO connections](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/overview)                                                                              | Extra “Connect account” rows.                                                                                                      |
| **Web3**                                | **OFF**                                                                      | [Web3](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#web3-authentication)                                                                         | Wallet sign-in on SignIn / profile.                                                                                                |
| **Enable Organizations**                | **OFF** (default)                                                            | [Configure Organizations](https://clerk.com/docs/guides/organizations/configure)                                                                                                    | Org create/join session tasks; `OrganizationSwitcher`; B2B Billing path. Do not use `npx clerk@latest enable orgs`.                |
| **Clerk Billing** / **Plans for Users** | **OFF** — never enable; do not `npx clerk@latest enable billing --for users` | [Enable Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c); [Billing overview](https://clerk.com/docs/guides/billing/overview); ADR 0003                  | **Billing** nav + publicly available **user Plans** in UserProfile. Connecting Stripe inside Clerk is Clerk Billing, not Host Pro. |
| **User API keys**                       | **OFF**                                                                      | [API keys](https://clerk.com/docs/guides/development/machine-auth/api-keys)                                                                                                         | **API Keys** tab on UserProfile.                                                                                                   |
| **Multi-session handling**              | **OFF** (recommended)                                                        | [Session options](https://clerk.com/docs/guides/secure/session-options)                                                                                                             | Several Host Clerk users signed in in one browser (`/choose` on sign-out). **Not** the same as listing/revoking devices.           |

Clerk public docs describe **enabling** Billing, not a dedicated disable recipe. If a leftover enable exists from the withdrawn Billing experiment: turn Billing off in [Billing Settings](https://dashboard.clerk.com/~/billing/settings) and do not leave **Publicly available** user Plans — hiding a Plan is not enough while Billing is on; UserProfile still advertises Billing.

### Optional / unchanged (not required for the ticket)

| Setting                                                        | Recommendation                          | Notes                                                                                                                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First and last name                                            | Leave **ON** (typical default)          | [User model](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#user-model). Google fills **Auth name**. Off → no name fields on Account.                                       |
| Allow users to change their email                              | Leave **ON**                            | [Restrict changes](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#restrict-changes). Off → emails visible but not add/remove; also blocks OAuth that would add a new email. |
| Sessions: Maximum lifetime / Inactivity timeout                | Keep Clerk defaults unless product asks | [Session options](https://clerk.com/docs/guides/secure/session-options). Does not hide active devices. At least one lifetime control must stay on.                                                           |
| Device Trust                                                   | Optional                                | [Device Trust](https://clerk.com/docs/guides/secure/device-trust). Needs **password** sign-in; does not add a UserProfile tab.                                                                               |
| Passkeys satisfy MFA (instances created **before** 2026-07-08) | Optional                                | [Passkeys and MFA](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#passkeys-and-multi-factor-authentication). Newer instances default ON and cannot disable.                 |

---

## Active sessions (no ON switch)

Prebuilt UserProfile **Security** includes **active devices and session revocation** as a built-in control ([UserProfile](https://clerk.com/components/user-profile)). There is no Dashboard checkbox “show sessions in UserProfile.”

Do not confuse with:

- **Sessions** page → inactivity / max lifetime / **Multi-session handling** ([session options](https://clerk.com/docs/guides/secure/session-options))
- `User.getSessions()` for custom UIs ([User object](https://clerk.com/docs/react/reference/objects/user#get-sessions))

Spec: keep prebuilt UserProfile; do not build a custom session list.

---

## Password vs passkeys vs email (sign-in matrix)

Enabling password or passkeys **does not require turning off** email or Google. Clerk treats them as additional factors on the same User & authentication page.

| Factor          | Sign-in                            | UserProfile                   |
| --------------- | ---------------------------------- | ----------------------------- |
| Email code/link | First factor (today)               | Manage emails                 |
| Google          | OAuth (today)                      | Connected accounts            |
| Password        | Additional first factor            | Set/update password           |
| Passkey         | After enroll; not a sign-up method | Create/rename/delete passkeys |

Disabling password **only affects new users**; existing passwords remain ([Password](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#password)).

---

## What this is not

- Not app work (`appearance`, `customPages`, experimental `UserProfilePhoneSection`).
- Not Stripe Customer Portal (Host Pro).
- Not in-app Host profile Username / usage.
- Not changing the live Clerk instance from this research.

---

## Sources (Clerk, current as of 2026-08-17)

- [Sign-up and sign-in options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options) — email, phone, username, password, passkeys, user model, delete account, restrict changes, MFA
- [TanStack Start `<UserProfile />`](https://clerk.com/docs/tanstack-react-start/reference/components/user/user-profile)
- [UserProfile (framework-agnostic)](https://clerk.com/docs/reference/components/user/user-profile)
- [UserProfile product surface](https://clerk.com/components/user-profile) — Account / Security / Billing-when-enabled / API Keys-when-enabled / active devices
- [Account Portal](https://clerk.com/docs/guides/account-portal/overview) — hosted profile is the same prebuilt component
- [Social connections](https://clerk.com/docs/tanstack-react-start/guides/configure/auth-strategies/social-connections/overview)
- [Add Google](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)
- [Passkeys custom flow](https://clerk.com/docs/guides/development/custom-flows/authentication/passkeys) — Dashboard passkeys tab
- [Manage MFA](https://clerk.com/docs/guides/development/custom-flows/account-updates/manage-mfa)
- [MFA sign-in (SMS requires phone)](https://clerk.com/docs/guides/development/custom-flows/authentication/multi-factor-authentication)
- [Session options](https://clerk.com/docs/guides/secure/session-options)
- [Configure Organizations](https://clerk.com/docs/guides/organizations/configure)
- [Clerk Billing overview](https://clerk.com/docs/guides/billing/overview)
- [Billing for B2C (TanStack Start)](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c) — Plans for Users in `UserProfile`
- [API keys](https://clerk.com/docs/guides/development/machine-auth/api-keys)
- [User resource](https://clerk.com/docs/react/reference/objects/user) — `deleteSelfEnabled`, `getSessions()`
- Repo: [ADR 0002](../docs/adr/0002-clerk-auth-billing.md), [ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md), [`docs/clerk-production-setup.md`](../docs/clerk-production-setup.md), [`research/clerk-auth-non-clerk-payments-coupling.md`](./clerk-auth-non-clerk-payments-coupling.md)
