# PWA Install Footer Implementation Plan

**Goal:** Fix install prompt timing and add persistent host-only footer with install affordance.

**Architecture:** Module-level `beforeinstallprompt` capture + `PwaInstallProvider` context; `AppFooter` in `AppShell` gated by `isHostShellRoute` and auth.

- [x] Prompt singleton + provider
- [x] `isHostShellRoute` helper + tests
- [x] `AppFooter` component
- [x] Refactor banner (no visit gate, separate dismiss key)
- [x] Wire into `AppShell`
- [x] `pnpm run test`
