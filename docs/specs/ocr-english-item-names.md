# OCR English item names — implementation spec

Wayfinder map [English item names from OCR](https://github.com/HayGrouve/onova-za-smetkata/issues/152). Hand-off only: do not ship this prompt change in the mapping session.

**Change:** prompt text in `scanReceiptImage` (`convex/lib/geminiReceipt.ts`). No schema change, no bilingual `item.name`, no UI language switch.

**Known limit:** Gemini `responseSchema` locks JSON shape, not English. A translate instruction is guidance. See [Gemini structured output and translation leakage](https://github.com/HayGrouve/onova-za-smetkata/issues/155).

---

## Rules

- Write English only into the existing `item.name`. No original in parentheses.
- Translate **item names only**. Leave `restaurantName` as printed.
- Source language is whatever is on the receipt, not Bulgarian-only. On mixed-language receipts, translate **per item**.
- Common English menu name when one exists; otherwise a short descriptive translation.
- Brands stay as printed.
- Host-typed manual items are out of scope (this prompt never sees them).
- Do not re-scan existing bills.

### Unreadable or uncertain

From [Unreadable or uncertain OCR item names](https://github.com/HayGrouve/onova-za-smetkata/issues/153):

- Unreadable print → `item.name` is exactly `Unknown item`, `confidence: low`. Emit the row only when a usable price already exists. Do not invent a price. Same placeholder on every such line.
- Readable line, shaky English (including a recognizable truncation) → short English guess, `confidence: low`. Never use `Unknown item` when the line is readable enough to name.
- `confidence: low` also when price or quantity is uncertain (as today).
- `confidence: high` only when the printed line is readable, the English name is confident, and price/quantity are not uncertain.

### Sizes, abbreviations, kitchen codes

From [Sizes, abbreviations, and kitchen codes in OCR names](https://github.com/HayGrouve/onova-za-smetkata/issues/154):

- `quantity` is the count of Units. Do not put order count (`2 x`, `бр.`) in `name`.
- Serving size and distinguishing size words stay in `name` (dish first, then size).
- Keep the size number as printed. Latinize metric units only (`л` → `l`, `мл` → `ml`, `гр`/`г` → `g`, `кг` → `kg`). Do not convert `0.5л` to `500ml` or to imperial.
- Drop generic `порц.` / `порция` when it only means “a serving”.
- Drop opaque kitchen / POS codes.
- Expand truncated or abbreviated dish words into the English name when recognizable; otherwise the uncertain/unreadable rules apply.

---

## Prompt

Keep the instruction in the existing **user** `text` part (same place as today). Do not add a schema field. `systemInstruction` is optional and not required.

**Replace** the current `text` string with:

```
Extract line items from this restaurant receipt. The receipt may be in any language printed on the paper; amounts in EUR. Return purchasable food/drink items only. EXCLUDE totals, tax (ДДС/VAT), tips (бакшиш), payment lines. Default quantity 1. Prices as EUR decimals in unitPriceEur. If a grand total is visible, set receiptTotalEur as EUR decimal (e.g. 328.21), not cents.

Write each item name in English only. Do not include the original wording in parentheses. Use the common English menu name when one exists; otherwise a short descriptive translation. Keep brand names as printed. Translate each line independently on mixed-language receipts. Leave restaurantName exactly as printed.

quantity is how many identical units were ordered. Do not put the order count in name. Keep serving size and distinguishing size words in name (dish first, then size). Keep the size number as printed; write metric units in Latin (л→l, мл→ml, гр/г→g, кг→kg). Do not convert 0.5л to 500ml or to imperial units. Drop generic portion marks (порц., порция) that do not distinguish the dish. Drop opaque kitchen or POS codes. Expand truncated or abbreviated dish words into the English name when recognizable.

If the printed line is unreadable and a usable price exists, set name to exactly "Unknown item" and confidence "low". Do not invent a price to keep a row. If the line is readable but the English name is a guess, write the short English guess and set confidence "low". Also mark confidence "low" when price or quantity is uncertain. Use confidence "high" only when the printed line is readable, the English name is confident, and price and quantity are not uncertain.
```

---

## Golden examples

From [Golden example pairs for OCR English names](https://github.com/HayGrouve/onova-za-smetkata/issues/156). `quantity` is `1` and `confidence` is `high` unless noted. A prompt is good if it would produce these `name` values (wording may vary slightly except `Unknown item`, which is exact).

| Printed line                    | `item.name`    | Also                                              |
| ------------------------------- | -------------- | ------------------------------------------------- |
| Шопска салата                   | Shopska salad  | Bulgarian dish → common English menu name         |
| Chicken burger                  | Chicken burger | Already English                                   |
| Salade niçoise                  | Nicoise salad  | Other language on a mixed receipt; that line only |
| Coca-Cola 0.5л                  | Coca-Cola 0.5l | Brand as printed; size kept; unit Latinized       |
| 2 x Капучино                    | Cappuccino     | `quantity: 2`                                     |
| порц. Свинско с ориз            | Pork with rice | Generic порц. dropped                             |
| ШОПСК (truncated, recognizable) | Shopska salad  | `confidence: low`                                 |
| Unreadable smear, price 12.00   | Unknown item   | `confidence: low`                                 |

---

## Out of scope

- A second language field or bilingual `item.name`
- Translating `restaurantName`
- Translating items the Host types by hand
- Changing Guest or Host UI language
- Re-scanning existing bills
- App-side language validation of `name` (prompt-only)
