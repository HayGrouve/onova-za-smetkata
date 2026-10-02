# Живата сметка (live receipt) design

The product UI follows direction C from `docs/prototypes/directions/` (PR #169): one shared, living receipt is the product. Host and guests look at the same paper with different permissions. People are seats around the table, and payments are stamps.

## Decisions

- **One branch:** the redesign ships in one go (`feat/live-receipt`).
- **Literal everywhere:** every surface is paper on the table, including home, login, legal pages, sheets and dialogs.
- **Finalize rule unchanged:** a bill closes only when every guest has paid. The receipt lists the blockers inline instead of hiding them behind a disabled button.
- **Data layer unchanged:** Convex functions, `shared/` rules and the hooks in `src/hooks/` stay. This redesign is presentation only.

## Visual system

- **Fonts:** self-hosted variable fonts with Cyrillic, from `@fontsource-variable`.
  - Unbounded is the display face: totals, stamps, titles and buttons.
  - Martian Mono (width 87.5) is the body face: receipt lines, labels and UI text.
- **Two surfaces:**
  - **Table:** `--background`. Cool grey in light mode, ink slate in dark mode.
  - **Paper:** `.paper`. Cool thermal white, and it stays light in dark mode because it is a physical object.
  - Inside `.paper`, the shadcn tokens (`--foreground`, `--muted-foreground`, `--border` and others) switch to ink values. Card, sheet, dialog, popover and menu content are paper automatically through their `data-slot`.
- **Accent:** vermilion stamp ink (`--primary`). It is the only accent. Seat colours (`--seat-0` to `--seat-4`) are the one exception, and are always paired with initials.
- **Objects:**
  - zig-zag paper edges (`.paper-edge`, `.paper-top`, `.paper-end`)
  - notched stubs (`.stub`) and slips (`.slip`)
  - dotted leaders (`.leader`) and perforations (`.perf`)
  - stamps (`.stamp`, `.stamp-wait`)
- **Motion** (`motion/react`, honouring reduced motion):
  - a receipt prints in
  - a claim avatar flies onto its line
  - a stamp thuds
  - a slip tears off
  - the activity ticker slides

## Information architecture

| Surface                | Was                                                     | Now                                                                                                          |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Home `/`               | Owed card, open bills list, history                     | Receipt shelf: "Навън са общо", live receipts on top, older bills as stamped stubs, debtors with „Напомни“   |
| Host bill `/bills/$id` | Four steps (Сметка, Участници, Разпределение, Плащания) | One receipt moving through three phases: Сглобяване (steps 1 and 2), На масата (step 3), Разплащане (step 4) |
| Guest join             | Seat list                                               | "Кой сте вие?" seats around the table                                                                        |
| Guest claim            | Claim groups list and pay bar                           | The same receipt with tap-to-claim lines. Your slip is pinned at the bottom with „Откъсни и плати“.          |
| Guest pay              | Breakdown cards, then Revolut                           | The torn-off slip: amount first, then Revolut or IBAN, then „Платих“                                         |
| Summary                | Breakdown                                               | Receipt stamped „ПРИКЛЮЧЕНА“ with each person's slip                                                         |

The `?step=1..4` search param stays, so host onboarding guidance (`shared/guidance-controller.ts`) keeps working. The phase timeline maps phases onto steps.

## Live activity

The ticker ("Деси взе Пилешка пържола") is derived on the client by diffing successive reactive snapshots of assignments, payments and guest sessions (`src/lib/bill-activity.ts`). There is no server-side activity log. You see what happens while you are watching.
