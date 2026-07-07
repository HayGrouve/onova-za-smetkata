# Онова за сметката

Mobile web PWA for splitting restaurant bills in Bulgarian. Create bills, assign items to participants, scan receipts with OCR, track payments, and share totals.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Convex values
npx convex dev               # terminal 1
npm run dev                  # terminal 2 — http://localhost:3000
```

## Testing

```bash
npm test
```

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full release checklist.

Quick release:

```bash
npm run preflight
npx convex deploy             # with CONVEX_DEPLOYMENT pointing at prod
git push origin main          # triggers Netlify build
```

## Tech stack

- [TanStack Start](https://tanstack.com/start) + React
- [Convex](https://convex.dev) backend
- [Netlify](https://netlify.com) hosting
- [Shadcn UI](https://ui.shadcn.com) + Tailwind CSS
