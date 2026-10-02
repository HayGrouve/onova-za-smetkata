# Design brief: three directions for Онова за сметката

Prototype branch: `prototype/three-directions`. Route: `/prototype/directions?variant=A|B|C&view=host|guest`.

## Design read (Taste §0.B)

Reading this as: **a mobile-first transactional product UI for Bulgarian friend groups splitting a restaurant bill at the table**. The language should be fast, trustworthy and warm. The foundation is the existing Tailwind v4 + shadcn stack, with direction-scoped tokens and a much stronger typographic treatment of money.

Mode: **redesign, overhaul (exploratory)**.

- **Keep:** product name, Bulgarian copy voice, domain vocabulary (CONTEXT.md), core flows and the rules in `shared/`.
- **Free to change:** visuals, information architecture and interaction model.

Taste is a landing-page skill (§13 says dense multi-step product UI is out of scope). We apply the parts that transfer:

- brief inference, dials and anti-default discipline
- typography, color and shape locks
- full interactive states and motivated motion
- dark-mode parity and the pre-flight checks

We do not apply the landing-only rules (hero, logo wall, stock photography).

## Core user, job, and the moment

- **Host** (signed in, usually the one who paid the restaurant): "Get my money back from everyone without being the annoying accountant." The host creates the bill from the receipt, puts people on it, lets them claim, and chases and confirms payments.
- **Guest** (no account, opened a link in the group chat, at the table, maybe after drinks): "Pay exactly my part, in under a minute, and be done."
- **Context:** a phone held in one hand, 3 to 10 people, a noisy table, Revolut is everyone's payment app, EUR.

## Most important information

- **Guest:** my total right now, what I still haven't marked, the Pay button.
- **Host:** how much is still out there (€), who has said they paid and is waiting for my confirmation, and what is still unclaimed.

## Main UX problems today (from the code audit and screenshots)

1. **Guest Pay buries the amount and the Revolut button** below breakdown cards. It has three titles, and the button is not sticky.
2. **Join is a dead end** if the host didn't type your name. There is no "Няма ме в списъка" path.
3. **Host step 4 counts people, not money.**
   - Every guest gets a huge card with a full-width „Платено“ button and a partial-amount input.
   - Pending guest transfers need 2 taps to confirm and are only visible on step 4.
4. **Two assignment models for the same data.**
   - The host step 3 shows raw lines (10 × Бира means 10 rows). Its chips, steppers and a per-unit dialog all live side by side.
   - Guests get Claim groups and a counter.
   - Share-vs-assign order is contradictory: the guidance says "assign first, then share" while the card says guests claim themselves.
5. **Finalize is a trap.** It is gated on every guest being paid and explained only in a tooltip on a disabled button. There is no "close with remainder".
6. **Chrome stacks up.** Header, step bar and guidance bar on top, and Общо plus Назад/Напред at the bottom, leave a small content window. Cards are nested in cards. Home is a wall of identical „Без име / Продължи“ rows.
7. **Visuals are default shadcn.** Every block is a Card with an icon and a title, money is set in a typewriter mono, and copper does brand, CTA and alert all at once.

## Preserve (works well)

- Server-chosen `takeUnit` and solo-only `releaseUnit` (no races).
- Claim groups.
- Explicit-only Shared Units with a price preview.
- Seat locking and Covered seats.
- Revolut deep link with the amount and note, plus the IBAN fallback.
- The live share amount on the claim bar.
- Home "next action" grouping and the „Напомни“ share.

## Research patterns that should show up (from the research report)

1. Quantity stepper on multi-unit lines plus a "claim all remaining" shortcut (Zeller pay-at-table).
2. A live tap-to-claim list where taken Units show the owner and a pinned "left to claim" total (Tab, HungryPay).
3. "Кой сте вие?" with a „Няма ме в списъка“ path and a taken-seat message (Tricount).
4. A two-sided payment state: guest „Платих“ → host confirms in one tap (Monzo Shared Tabs, Venmo "mark as paid").
5. OCR review: a receipt thumbnail beside parsed lines, a sum-of-lines vs total check, tap to edit (Expensify, receipt-AI guidance).
6. Claim is home for the guest. Pay is a sticky bar, with a sheet or step for "pay for someone too" (Sunday, Qlub 10-second flow).
7. One-tap „Напомни“ per debtor, and an "all paid up" celebration (Venmo Groups).
8. Tabular numerals on every amount that updates.
9. „Раздели остатъка поравно“ for leftovers, with confirmation (Plates "split the rest").
10. Two panes on wide screens: receipt beside people/assignment, with a collapsing summary on phones (checkout pattern).

## Shared constraints for all three prototypes

- **Data:** all three use `mock/store.tsx` (`useProto()`), which runs the real `shared/` money and claim rules. Host and guest views share one store per direction, so a guest claim shows up on the host screen. `mock/live.ts` (`useLiveTable`) simulates other phones.
- **Coverage:** each prototype must cover the following:
  - **Host:** home, new bill (scan simulation + manual), people, assignment, sharing the link, collecting and confirming payments, finishing.
  - **Guest:** join (pick seat, or „Няма ме в списъка“), claim (take / release / share a unit), cover someone, pay (Revolut/IBAN mock, „Платих“), done state.
- **Responsive:**
  - Mobile at 360 to 430 px is primary.
  - Tablet at 768 px and desktop at 1280 px or wider need a deliberate layout, not a stretched phone.
  - The guest flow may stay a centred column on desktop, but must look intentional.
- **Modes:** light and dark.
  - Respect `.dark` on `<html>` (next-themes). Tokens are scoped under each direction's wrapper class.
  - Radix portals render into `body`, so give sheet and dialog content the wrapper class too.
- **Stack:**
  - Icons: lucide-react, already a dependency (one family per project).
  - Motion: `motion/react` (now installed). Honor `useReducedMotion`.
  - Fonts: `useGoogleFont()` in prototypes only. Every font must have Cyrillic.
- **Copy:** Bulgarian only. No em or en dashes anywhere (Taste §9.G); use a hyphen, a comma or a period. No emoji.
- **States:** empty, loading (skeletons in the shape of the content), error (inline), offline is optional, plus final/locked.
- **Code:**
  - Files under `src/components/prototype/directions/<a|b|c>/`. Do not touch production components.
  - Start every file with a `/** PROTOTYPE … */` header.
  - Keep exports minimal (knip).
  - Prettier style: no semicolons, single quotes.
  - Run `pnpm exec tsc --noEmit` before you report back.

## The three hypotheses

### A. Познато и бързо (Familiar / Efficient)

> "A user should immediately understand how to use this."

Dials: VARIANCE 3 · MOTION 3 · DENSITY 6.

**IA: tabs, not a wizard.** The bill is one screen with a segmented control: **Артикули · Хора · Плащания**. A persistent summary header shows Общо, Остават € and claimed progress. Any tab is reachable at any time; there are no Назад/Напред steps.

**Host**

- **Home:** a Revolut/Splitwise-style balance header ("Дължат ви 25,60 €" with an avatar strip and Напомни), then one list of bills with status chips (Чернова · Събиране · Приключена). Drafts are collapsed when there are many.
- **Assignment:** the same Claim-group rows the guests see, with seat avatars. Tapping a row opens a bottom sheet with per-person steppers ("who had how many") and a „Сподели бройка“ secondary action. This gives the host one assignment model, identical to the guest's.
- **Payments:** compact rows (name, remaining €, status pill). Pending transfers appear first as „Чака потвърждение“ with an inline ✓ Потвърди. „Отбележи платено“ lives in a row menu.
- **Finish:** blockers are listed inline, and „Приключи с остатък“ is available.

**Guest**

- **Flow:** Sunday/HungryPay checkout. The list of items has steppers, a sticky bottom bar shows "Вашият дял 14,20 € · Плати", and pay is a full screen with the total first and the Revolut button pinned.

**Desktop and visuals**

- **Desktop:** a two-pane master/detail layout. The bill list sits on the left, the bill workspace on the right, and Плащания becomes a right rail at 1280 px or wider.
- **Visuals:** light-first, a neutral system feel and a single confident accent. Dense, calm lists divided by hairlines, not cards.

### B. Фокус (Modern / Focused)

> "Show the user only what they need at the moment they need it."

Dials: VARIANCE 5 · MOTION 5 · DENSITY 3.

**IA: the bill has one current task**, and the screen is that task. Everything else is one tap away in a quiet „Детайли“ drawer.

**Host**

- **Home:** a single "next thing" card in large type ("Деси каза, че е превела 11,40 €. Потвърди?"). Below it sits a quiet list.
- **Setup:** creating a bill is a focused sequence of full-screen questions: Снимай бележката → Провери (review) → Кой беше? → Сподели. One big primary action each, progress as a thin line.
- **After the link is shared**, the bill becomes a calm live **status screen**. It shows one huge number (Остават 47,30 €) and a short list of people with one state word each, and it surfaces only the action that matters now (confirm, remind, close). Assignment is person-first: pick a person, then tap their items.

**Guest**

- **Flow:** the guest is guided one decision at a time. A huge "Кой сте вие?" with big name tiles. Then claiming as a focused list with progressive disclosure: the row is just name, price and a big round +. "Сподели" appears only after you have taken a unit.
- **Pay:** a single full-bleed screen with one enormous amount and one button.

**Desktop and visuals**

- **Desktop:** a centred focus column with generous margins. On wide screens a quiet context panel (receipt or people) can sit beside it, dimmed.
- **Visuals:** huge display numerals, lots of air, almost no borders, strong type contrast, restrained motion that animates state changes (number roll, sheet morph).

### C. Живата сметка (Bold / Exploratory)

> "If we weren't constrained by the current UI, what could this product become?"

Dials: VARIANCE 8 · MOTION 7 · DENSITY 4.

**IA: one shared, living receipt is the whole product.** There are no host editor steps and no separate guest pages. Host and guests look at the same receipt object with different permissions. It moves through three phases on a timeline: **Сглобяване → На масата → Разплащане**.

**The table**

- The people are **seats around the table**: an avatar dock/rail with presence (joined, claiming, paid).
- The host **paints**: select a seat avatar as the brush, then tap receipt lines to give Units to that person. Long-press a line for a unit-level split.
- Guests tap lines to claim. Other phones' claims appear **live**: an avatar flies onto the line, and a live activity ticker runs (`useLiveTable`).

**Payments**

- Payments are **stamps on the receipt**: a rotated „ПЛАТЕНО“ stamp on that person's tear-off slip. Pending shows as „ЧАКА“.
- Each person's share is a perforated tear-off slip at the bottom of the receipt. The guest "tears" their slip off to pay (a drag or button), and the slip becomes the payment screen.

**Desktop and visuals**

- **Desktop:** the receipt sits centred like an object on a table surface, with seats around it, the activity feed on one side and the payment slips on the other.
- **Visuals:** a paper receipt on a tinted table surface, dotted leaders, perforated edges via CSS masks, a mono receipt face for line items paired with an expressive display sans for totals, and one saturated accent. Motion carries meaning: claims fly to lines, stamps thud, slips tear.

## Visual languages

Filled in from the visual direction research (see `visual.md`).
