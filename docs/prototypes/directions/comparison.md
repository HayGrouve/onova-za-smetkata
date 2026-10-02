# Three directions: comparison and recommendation

Live prototypes: `pnpm run dev`, then open `/prototype/directions?variant=A|B|C&view=host|guest`. A floating switcher at the bottom right flips between directions and between the host and guest phone, and resets the data. The ←/→ keys also switch directions.

All three run on the same in-memory bill, using the real money and claim rules in `shared/`. A guest claim or a „Платих“ shows up on the host screen of the same direction. Simulated phones (Явор, Деси, later Боби) claim and pay in the background.

The inputs behind these directions are:

- `brief.md`: design read, problems, the patterns that were borrowed.
- `visual.md`: the locked visual languages.
- The research and UX-audit findings summarised in the brief.

---

## A · Познато и бързо (Familiar / Efficient)

**Design philosophy.** "A user should immediately understand how to use this." It takes patterns people already use daily (banking balance header, grouped lists, segmented tabs, checkout) and fixes the hierarchy problems without asking anyone to learn a new model.

**Target experience.** Predictable and fast for repeat hosts. It is dense but calm. Nothing surprises you, and every object is always one tap away.

**Key differences.**

- **Bill structure:** the 4-step wizard becomes one bill screen with tabs Артикули · Хора · Плащания. There is no Назад/Напред, and the summary header is sticky (Общо, Остават, claimed meter, one live line).
- **One assignment model:** the host uses the guests' Claim-group rows and the same per-person stepper in a sheet.
- **Payments:** pending transfers come first with one-tap Потвърди. Rows are compact and lead with money. „Приключи с остатък“ is always available, and blockers are shown inline.
- **Guest:** the flow is a Sunday/HungryPay checkout. The list has steppers and a sticky „Вашият дял · Към плащане“ bar. The pay screen puts the total first, with the Revolut button pinned.
- **Wide screens:** a real desktop app. Two panes from 768 (bills | workspace), plus a Плащания rail from 1280.
- **Visual language:** Geist, cool zinc, one cobalt accent, iOS-style grouped lists with hairlines, no nested cards.

**Strengths.**

- Lowest learning curve and lowest delivery risk. It maps almost 1:1 onto the current data model and components.
- Best information density for the host who wants to see everything (a 15-item receipt fits without scrolling on desktop).
- The desktop/tablet layout is genuinely useful: tabletop review and accounting after the dinner.
- Every state is visible at once, so it is easy to debug at a noisy table ("why is Деси 15,90?").

**Trade-offs.**

- It is the least memorable. It reads as "a good fintech app", not as _Онова за сметката_, and brand expression is minimal.
- The host still has to choose where to go (three tabs). Nothing tells them "this is the thing to do now".
- The guest claim screen is busy at the top: identity, cover someone, table meter, filter, search.

**Best use case.** Hosts who split often (weekly dinners, office lunches, larger groups with 15+ lines) and need control and overview more than guidance. It is also the safest choice if the next release must ship quickly.

**Design references.**

- Revolut/Monzo balance header and „Напомни“ (Venmo Groups request).
- Splitwise-style list plus status pills.
- Sunday / HungryPay / Zeller pay-at-table: item list, stepper, sticky pay bar, "claim all remaining".
- Tricount "who are you" with „Няма ме в списъка“.
- Monzo Shared Tabs two-sided pay state.
- The checkout two-pane layout.

---

## B · Фокус (Modern / Focused)

**Design philosophy.** "Show the user only what they need at the moment they need it." Every screen is one question with one big number and one primary action. Everything else sits in a quiet „Детайли“ drawer.

**Target experience.** It is calm, guided and nearly impossible to get wrong. It feels personal, with sentences instead of labels ("Мила преведе 12,61 €. Пристигнаха ли?").

**Key differences.**

- **Home:** a single "next thing" card computed from state, in this order: confirm a transfer, then unclaimed Units, then remind, then all settled. Only a quiet list follows.
- **New bill:** a sequence of full-screen questions: Снимай бележката → Провери → Кой беше на масата? → Сподели линка.
- **After sharing:** the bill becomes a **live status screen**. It has one huge number (Неразпределени, then Остават, then Събрахте), one action panel, and people with one state word each.
- **Person-first assignment:** tap a person, then "Добави артикул към Явор". This replaces the host step-3 matrix entirely.
- **Guest:** one rolling „Вашият дял“ number. Rows are just name, price and a round +. „Сподели“ and − appear only after you take something. Pay is one enormous amount and one button, with a "Върнахте се от Revolut? Платих / Не още" check.
- **Visual language:** Sofia Sans, by a Bulgarian type designer, with native Bulgarian letterforms. Light display numerals, monochrome plus emerald (emerald means both "money moving" and "paid"). Pill shapes, almost no borders.

**Strengths.**

- **Best answer to the main hierarchy problems:** the guest sees the amount first, and the host sees what needs them now.
- **Best for first-time and tipsy users:** one decision per screen, big targets, no domain concepts until needed.
- **Person-first assignment** matches how hosts actually think at the table ("what did Явор have?").
- **The live "next thing" logic** turns the background activity of other phones into a single, actionable prompt.
- **Most "native Bulgarian" feel**, thanks to Sofia Sans.

**Trade-offs.**

- **Overview is hidden.** Power hosts must open „Детайли“ or a person to see the full receipt, which is slower for big bills and corrections.
- **Two jobs on one number:** the hero number changes meaning over time (unclaimed → outstanding → collected), so the label carries a lot of weight.
- **Sequential setup** is slower when you already know what to do; you can't jump straight to "add 3 people".
- **Desktop** is a centred column plus a dimmed context panel. It is intentional, but it uses wide screens less than A.

**Best use case.** First bills, occasional hosts, and the guest side generally. This is the strongest guest experience if most guests open the link once and never return.

**Design references.**

- Sunday / Qlub "10-second" pay flow (claim is home, pay is one screen).
- Monzo two-sided pay state.
- Venmo "all paid up".
- Plates "split the rest".
- Tricount join.
- Receipt-AI guidance for the OCR review sum check.
- Calm "one number" money apps.

---

## C · Живата сметка (Bold / Exploratory)

**Design philosophy.** "The live receipt is the product." There are no editor steps and no separate guest pages. Host and guests look at the same receipt object with different permissions. It moves through Сглобяване → На масата → Разплащане, and people are seats around the table.

**Target experience.** Social, tactile and memorable. It's fun to use at the table because you watch claims land live on the paper. Payments become stamps you want to see.

**Key differences.**

- **Home:** a shelf of receipts. The live one sits on top; older ones are stubs with stamps (ДЪЛЖАТ 25,60 €, ЧЕРНОВА, ПРИКЛЮЧЕНА).
- **Paint assignment:** pick a seat as the "brush", then tap lines. Avatars fly onto lines, with a 5-second undo. Unit slots are shown per line (dashed when free, an avatar when taken).
- **Phase timeline** instead of steps. A live ticker shows other phones' actions in mono.
- **Settlement:** per-person tear-off slips with stamps. One-tap Потвърди thuds a „ПЛАТЕНО“ stamp, and closing stamps the whole receipt „ПРИКЛЮЧЕНА“.
- **Guest:** the guest claims on the same receipt. Their running share lives on their own slip pinned at the bottom, and „Откъсни и плати“ tears the slip off into the pay screen.
- **Visual language:** Unbounded plus Martian Mono, thermal paper on an ink-slate table, vermilion stamp ink (an evolution of the current copper), dotted leaders, perforated CSS-mask edges, and seat colours that are always paired with initials.

**Strengths.**

- **The only direction with a brand.** Screenshots of it are shareable, which is valuable growth for a product spread by links in group chats.
- **One shared mental model for host and guest.** The "two assignment models for the same data" problem disappears structurally.
- **Real-time multiplayer becomes visible and legible** (who took what, live). That builds trust that the split is fair.
- **The paint mode is the fastest host assignment model** for "this person had these 5 things".
- **The slip metaphor** gives the guest a clear "my part" object and an unmistakable end state.

**Trade-offs.**

- **Highest implementation cost and risk.** It needs custom components, motion, and perforation and stamp art in CSS. It also needs careful accessibility work (the paint mode and the slots need keyboard and screen-reader equivalents).
- **The metaphor costs density.** Long receipts mean a long paper, and on phones the dock plus the bars compete with the receipt for space (iterated, but still the tightest of the three).
- **Novel interactions** (brush, tear) must be learned, so they need good affordances and an undo. Discoverability of the long-press and ⋯ unit popover is unproven.
- **The expressive type** (Unbounded) is loud. It works for totals and stamps, not for long text.

**Best use case.** When growth and word of mouth matter and the product wants a recognisable identity. It is also the strongest at the table, while everyone is still there and claiming simultaneously.

**Design references.**

- Tab (bring10): live multiplayer claiming.
- Plates by Splitwise: drag items to people. Here it is reframed as "paint", fixing Plates' colour-only identity with initials.
- Zeller per-unit stepper (in the unit popover).
- Monzo two-sided pay state, rendered as ЧАКА → ПЛАТЕНО stamps.
- Physical receipts and rubber stamps as the interaction metaphor.

---

## Side by side

|                      | A · Познато                           | B · Фокус                                  | C · Живата сметка                  |
| -------------------- | ------------------------------------- | ------------------------------------------ | ---------------------------------- |
| Host IA              | One bill, 3 tabs                      | Next-thing home, then a live status screen | One receipt, 3 phases              |
| Host assignment      | Item → sheet with per-person steppers | Person → add their items                   | Seat brush → paint lines           |
| Guest claim          | Checkout list with steppers           | Focus list, progressive disclosure         | Tap lines on the shared receipt    |
| Guest pay            | Total first, pinned Revolut           | One number, one button                     | Torn-off slip                      |
| Payment status       | Pills, Потвърди inline                | One state word plus a question card        | Stamps on slips                    |
| Density (1-10)       | 6                                     | 3                                          | 4                                  |
| Learning curve       | Lowest                                | Low                                        | Medium                             |
| Overview / control   | Highest                               | Lowest                                     | Medium                             |
| Brand expression     | Low                                   | Medium (local type)                        | Highest                            |
| Desktop              | 3 panes, a real tool                  | Focus column plus context                  | Receipt as object, feed plus slips |
| Build cost vs. today | Low                                   | Medium                                     | High                               |

---

## Recommendation (ideas, not a winner)

**Strongest ideas from A**

- One bill screen with tabs instead of a gated wizard. Hosts jump freely, and there is no Назад/Напред chrome.
- The host uses the _same_ Claim-group rows and per-person stepper as guests. One assignment model.
- Pending transfers on top with one-tap Потвърди, compact money-first rows, and „Приключи с остатък“ with inline blockers.
- The 2- and 3-pane desktop layout for after-dinner settling.

**Strongest ideas from B**

- A computed "next thing" for the host (confirm, then unclaimed, then remind, then done), worded as a sentence.
- The guest pay screen as one big number and one button, with a "Върнахте се от Revolut?" check before marking as paid.
- Progressive disclosure on claim rows („Сподели“ and − only after you take something).
- Person-first assignment ("Добави артикул към Явор").
- Sofia Sans with Bulgarian letterforms.

**Strongest ideas from C**

- Host and guest share one receipt model, with only the permissions differing.
- Live presence ("Деси взе Пилешка пържола", avatars landing on lines) as a trust signal.
- Paint mode for fast bulk assignment.
- The slip as the guest's "my part" object, and stamps as unmistakable payment states.
- Receipt-shelf history on home.

**Worth combining into a hybrid (a conceptual fourth direction, not built).**

- **Base:** B's focus logic and guest flow, implemented on A's information architecture and components. Use the "next thing" card and live status screen as the default bill view, with A's tabs one tap away for overview and editing.
- **From C:**
  - live presence (ticker plus avatars on rows)
  - paint mode as an optional power tool inside the Артикули tab
  - the „ПЛАТЕНО“ stamp moment as the single celebratory flourish
  - the shared host/guest receipt model as the underlying IA principle
- **Visual:** C's vermilion ink (an evolution of today's copper) and Sofia Sans, on A's calmer grouped-list surfaces. Restrict the paper and stamp metaphor to the pay slip, the stamps and the share card, where it pays off.

**Probably discard**

- The full sequential setup wizard from B for returning hosts. Keep it only for the first bill (it replaces today's Напътствия layer nicely); repeat hosts should land on A-style direct editing.
- C's full-height receipt as the only view on phones for long bills. It's too long; keep it as a "receipt view" toggle.
- Separate host-only assignment UIs (chip toggles, per-unit dialog) from today's product. All three directions show they aren't needed.
- Colour-only seat identity (C needed two-letter initials).

**Open questions to validate with users**

1. **Guests:** do they understand a shared receipt (C) faster than a checkout list (A)? Test with 5 people at a real table, after a drink, without instructions.
2. **Hosts:** do they prefer to assign by person (B), by item (A) or by painting (C)? Time each on a 12-line receipt with 5 people.
3. **„Платих“ before host confirmation:** does it create false "paid" signals, and is B's "Върнахте се от Revolut?" check enough?
4. **„Приключи с остатък“:** how do hosts expect leftover debts to behave after closing (stay on home as „Дължат ви“, reminders)?
5. **Tip:** should it stay equal per seat (current rule) or become proportional? All three prototypes surface an awkward 1,91 € for a guest who has claimed nothing yet.
6. **Brand:** does the receipt and stamp language (C) increase sharing and new-host sign-ups? Consider an A/B test on the guest pay slip alone.
7. **Desktop:** is it used at all by hosts, or is it only mobile? This decides how much to invest in A's 3-pane layout.
