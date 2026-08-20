# Bill splitting

Shared language for how people and money show up on a bill.

Bulgarian mobile web PWA: a **Host** creates a bill from a restaurant receipt, adds **Participants**, assigns **Units** of each item, and collects **Outstanding** amounts from **Guests** who join via share link.

## Flows

**Host journey** — sign in → create/open bill → add participants and items (manual or receipt OCR) → assign units → share join link → track guest payments → finalize bill (locks editing).

**Guest journey** — open share link → pick participant seat on join page → claim units on claim page → pay share (e.g. Revolut) → host sees payment status.

The host also has a participant seat on the bill but is never **Outstanding**.

## Language

**Host**:
The authenticated bill owner who creates and manages the bill.
_Avoid_: bill creator (except as plain description), owner (except for auth/data ownership)

**Host account**:
The Host's Clerk sign-in identity — Auth name, emails, password or passkeys, MFA, connected accounts, sessions, account deletion. Managed in Clerk's UserButton / UserProfile. There is no in-app **Профил** sheet.
_Avoid_: mixing this with Host Pro or Guest restaurant payments; calling Clerk UserProfile "Профил" in product copy; "user settings" as a name for this

**Host profile**:
Retired. Was the in-app `Профил` sheet (Username + Free/Pro usage). Name lives on Host account; Host Pro usage is not shown from that sheet.
_Avoid_: reviving an in-app Профил; treating Host account as Host profile

**Username**:
Retired as a product field. Was an optional in-app `Потребителско име` for the Host's participant seat. The Host appears as Auth name, else **домакин**.
_Avoid_: reintroducing Потребителско име for the Host seat; using this word for Auth name or Clerk's username identifier (which stays off)

**Auth name**:
The Host's name on the Host account (Clerk) — typically from the identity provider, editable in UserProfile. This is how the Host appears as a Participant on bills they create. If unset, the seat is **домакин**.
_Avoid_: username, Потребителско име, display name as a separate product field

**Participant**:
A named seat on a bill used for item claims, tip share, and payment tracking.
_Avoid_: guest (guest means a participant who joined without host auth), member

**Guest**:
A participant who is not the host; the people from whom money may still be collected.
_Avoid_: using “guest” for the host’s participant seat

**Share**:
A participant’s calculated food + tip amount on the bill (what they consumed / were allocated).
_Avoid_: owed (when talking about the host’s collection status — the host has a share but is not outstanding)

**Unit**:
One countable piece of a line item (`quantity` stacks units). Each unit can be claimed independently with its own participant set and even split.
_Avoid_: treating quantity > 1 as a single indivisible claim pool

**Unit membership**:
Which Participants are assigned to which Unit on an item line. Stored as rows linking `(itemId, unitIndex, participantId)`. Mutations are `joinUnit` / `leaveUnit`; bulk “everyone on every Unit” is `assignEven`.
_Avoid_: separate host vs guest assignment models; `toggle` (removed)

**Unit index**:
Zero-based position of a unit on an item line (`0 … quantity−1`). Item membership rows reference `(itemId, participantId, unitIndex)`.
_Avoid_: one-based indexing in storage; overloading “unit” to mean the whole line

**Unit share allocation**:
How a single unit's price (in cents) is split among the participants assigned to that unit. Assignees are ordered by participant `sortOrder`; cent remainders go to earlier seats in that order. Claim previews and final totals must use the same rule.
_Avoid_: lexicographic sort on participant IDs; splitting the whole line total when the model is per-unit

**Outstanding**:
Money still to collect from guests toward their shares. The host never has outstanding.
_Avoid_: unpaid balance for the host

**Bill status**:
Whether a bill is still being prepared (**draft**, product UI **Чернова** / chip **Чернови**) or locked after the host finishes it (**final**, product chip **Приключени**).
_Avoid_: completed, closed, settled (settled is about collection, not bill status)

**Prepared bill**:
A first-onboarding milestone: the bill has a restaurant name, at least one Guest, at least one validly priced item, and every item Unit is assigned. A prepared bill may still have **draft** Bill status. Predicates live in `shared/bill-readiness.ts` (`isPreparedBill`, `isAllocationReady`, step views).
_Avoid_: duplicating readiness checks in routes or components; completed bill, final bill

**Bill readiness**:
Layered views over one predicate set — Prepared bill milestone, editor step completion, allocation guidance, finalize validation. Module: `shared/bill-readiness.ts`.
_Avoid_: copy-pasted conditionals for restaurant / guests / priced items / unit coverage

**Напътствия**:
The contextual guidance a first-time Host receives while making their first bill (product UI `Спри напътствията`, `Помощ и напътствия`). Plural for the mode as a whole; singular (`напътствието`) for a single instruction. Orchestration module: `shared/guidance-controller.ts` (`computeGuidanceState`); DOM scroll/pop stays in `useGuidanceFocus`.
_Avoid_: съвети, помощник, тур, обучение (it is neither a standalone wizard nor a tour); duplicating `deriveHostOnboardingGuidance` at call sites

**Guidance controller**:
Pure module for Напътствия state — curriculum, active step, step-bar signal, focus plan, next-button pop plan. React executes scroll/pop at the DOM seam.
_Avoid_: planning guidance in route or provider ad hoc

**Participant Share view**:
Presentation model for one participant's Share — totals, breakdown lines with display strings, payment status label. Built from bill snapshot + participant id via `buildParticipantShareView` in `shared/participant-share-view.ts`.
_Avoid_: assembling snapshot + breakdown + labels separately in each UI consumer; duplicating `statusLabels` maps

**Bill-editing controller**:
Orchestration for the host bill editor — step clamp/redirect, metadata draft state, derived snapshot/totals/completion, OCR→guidance handoff, guidance input. Pure module: `shared/bill-editing-controller.ts`; React seam: `useBillEditorController`.
_Avoid_: wiring OCR, guidance, and step completion ad hoc in the route file

**Guest claim session**:
Orchestration for the guest/host claim page — tab filter (`Остават` / `Мои`), search, per-item claim state, share drawer inputs. Pure module: `shared/guest-claim-session.ts` (item filters in `shared/guest-claim-items.ts`); React seam: `useGuestClaimSession`.
_Avoid_: wiring tab semantics, item filters, and share breakdown separately in the claim route

**Guest flow session**:
Orchestration for the Guest journey — join resume, seat pick, claim redirects, session-lost recovery, doc mapping to Guest claim session input. Pure module: `shared/guest-flow-session.ts`; React seams: `useGuestJoinFlow`, `useGuestClaimFlow` (the latter composes `useGuestClaimSession`).
_Avoid_: duplicating redirect/resume logic in routes; conflating with Guest claim session

**Host Pro**:
The paid SaaS tier that lifts Free-tier limits (bills per month, OCR scans, friend groups). The Host pays the product, not the restaurant.
_Avoid_: mixing this with Outstanding / Guest restaurant payments; calling Guest Revolut “billing”

**Free tier**:
The default Host SaaS level with monthly bill and OCR limits. Existing bills stay editable at quota; only new creates/scans are blocked.
_Avoid_: treating quota as a hard lock on the current bill

## Related docs

- `docs/agents/guidelines.md` — architecture, testing, and implementation conventions for agents
- `.cursor/rules/context-core.mdc` — always-on summary of core terms above (for Cursor agents)
- `README.md` — local development and scripts
- `docs/DEPLOY.md` — production deploy, env vars, security
- `docs/adr/0002-clerk-auth-billing.md` — Clerk for Host sign-in
- `docs/adr/0003-stripe-billing-beside-clerk.md` — Stripe Billing for Host Pro
- `docs/specs/kebab-chrome-after-clerk.md` — kebab chrome and Auth name after Clerk
