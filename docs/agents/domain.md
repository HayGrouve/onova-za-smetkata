# Domain Docs

How agent skills should consume this repo's domain documentation.

## This repo

- **Product domain**: bill splitting for restaurants — glossary in root **`CONTEXT.md`** (core terms also in `.cursor/rules/context-core.mdc`).
- **Engineering conventions**: **`docs/agents/guidelines.md`**.
- **ADRs**: **`docs/adr/`**. Host auth = Clerk ([0002](../adr/0002-clerk-auth-billing.md)); Host Pro = Stripe Billing ([0003](../adr/0003-stripe-billing-beside-clerk.md)).

## Before exploring

1. Read **`CONTEXT.md`** for vocabulary and module pointers.
2. Check **`docs/adr/`** for decisions that touch your area. Host auth/billing: Clerk vs Stripe is already decided (0002 / 0003).

## Use the glossary's vocabulary

When naming domain concepts (issue titles, refactors, tests), use terms as defined in **`CONTEXT.md`**. Do not drift to synonyms the glossary explicitly avoids.

If a concept is missing from the glossary, either reconsider the term or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (…) — but worth reopening because…_
