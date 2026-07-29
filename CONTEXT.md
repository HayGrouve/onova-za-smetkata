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

**Username**:
An optional name the host saves on their profile (`Потребителско име`) for how they appear as a participant on bills they create.
_Avoid_: display name, hostDisplayName, account username

**Auth name**:
The name on the authenticated user from the identity provider (e.g. Google).
_Avoid_: username (that term is reserved for the profile field above)

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

## Related docs

- `docs/agents/guidelines.md` — architecture, testing, and implementation conventions for agents
- `.cursor/rules/context-core.mdc` — always-on summary of core terms above (for Cursor agents)
- `README.md` — local development and scripts
- `docs/DEPLOY.md` — production deploy, env vars, security
