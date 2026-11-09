# Clerk production setup

> **Moved.** Сметката no longer has its own Clerk app. Host sign-in runs on the shared Акаунт, the Clerk app "онова за" on `clerk.onovaza.com`, set up once for every онова за project by the hub's production checklist: **[HayGrouve/onova-za#26](https://github.com/HayGrouve/onova-za/issues/26)**.

What Сметката itself still owns there (its `smetkata` secret key, the `user.deleted` webhook, the Convex issuer) is in [`DEPLOY.md`](./DEPLOY.md) → "Clerk (production): the shared Акаунт". Why: [ADR 0005](./adr/0005-sign-in-and-akaunt-on-the-hub.md).

The old step-by-step runbook for the retired Сметката Clerk app on `clerk.onova-za-smetkata.com` (verified 2026-08-11) is in git history; that app is deleted after the cutover (HayGrouve/onova-za-smetkata#213).
