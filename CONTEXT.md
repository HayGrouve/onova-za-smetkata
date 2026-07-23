# Bill splitting

Shared language for how people and money show up on a bill.

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

**Outstanding**:
Money still to collect from guests toward their shares. The host never has outstanding.
_Avoid_: unpaid balance for the host

**Bill status**:
Whether a bill is still being prepared (**draft**, product UI **Чернова** / chip **Чернови**) or locked after the host finishes it (**final**, product chip **Приключени**).
_Avoid_: completed, closed, settled (settled is about collection, not bill status)

**Prepared bill**:
A first-onboarding milestone: the bill has a restaurant name, at least one Guest, at least one validly priced item, and every item Unit is assigned. A prepared bill may still have **draft** Bill status.
_Avoid_: completed bill, final bill
