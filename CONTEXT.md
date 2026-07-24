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
A first-onboarding milestone: the bill has a restaurant name, at least one Guest, at least one validly priced item, and every item Unit is assigned. A prepared bill may still have **draft** Bill status.
_Avoid_: completed bill, final bill

## Related docs

- `docs/agents/guidelines.md` — architecture, testing, and implementation conventions for agents
- `README.md` — local development and scripts
- `docs/DEPLOY.md` — production deploy, env vars, security
