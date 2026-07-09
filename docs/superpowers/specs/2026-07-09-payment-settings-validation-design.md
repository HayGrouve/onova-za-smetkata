# Payment Settings Validation (Scoped Design)

**Date:** 2026-07-09  
**Status:** Implemented  
**Scope:** Revolut username + IBAN validation with Zod 4

---

## Rules

- **Revolut:** strip `@`, trim; pattern `^[a-zA-Z0-9._-]{3,30}$`; store normalized without `@`
- **IBAN:** strip spaces, uppercase; BG = 22 chars + mod-97 checksum; other countries = ISO format/length only
- Both fields optional; non-empty values must validate
- Shared schema in `shared/payment-settings-schema.ts`; enforced client + Convex `save`
