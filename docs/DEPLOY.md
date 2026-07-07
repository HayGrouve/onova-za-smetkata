# Deploy Runbook

## Prerequisites (one-time)

- [ ] GitHub repo connected to Netlify
- [ ] Convex **production** deployment exists
- [ ] Netlify env: `VITE_CONVEX_URL` = prod Convex cloud URL
- [ ] Convex prod env: `GEMINI_API_KEY` (for receipt OCR)

## Environment variables

| Variable | Where | Required |
|----------|-------|----------|
| `VITE_CONVEX_URL` | Netlify | Yes |
| `GEMINI_API_KEY` | Convex Dashboard | Yes (for OCR) |
| `GEMINI_MODEL` | Convex Dashboard | No |
| `CONVEX_DEPLOYMENT` | Local `.env.local` | Yes (for CLI) |

Never put `GEMINI_API_KEY` in Netlify or the repo.

## Release steps

1. **Preflight locally**

   ```bash
   npm run preflight
   ```

   Requires `VITE_CONVEX_URL` in environment (or `.env.local`).

2. **Deploy Convex backend**

   ```bash
   npx convex deploy
   ```

   Ensure `CONVEX_DEPLOYMENT` in `.env.local` targets **production**.

3. **Deploy frontend**

   Push to `main`. Netlify runs `npm run build` and publishes `dist/client`.

4. **Smoke test** (production URL)

   - [ ] Home loads; bills list appears
   - [ ] Create bill → add participant → add item → assign
   - [ ] Summary page; finalize with restaurant name
   - [ ] Mark participant paid
   - [ ] Payment settings (Revolut/IBAN) persist after reload
   - [ ] Receipt OCR scan (if Gemini key set)
   - [ ] Add to Home Screen shows branded icon
   - [ ] No devtools panel visible
   - [ ] Summary bottom buttons not clipped on mobile

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Blank page / config message | Missing `VITE_CONVEX_URL` on Netlify | Set env var; redeploy |
| Build fails on Netlify | Same | Set `VITE_CONVEX_URL` in Netlify build env |
| OCR always fails | Missing `GEMINI_API_KEY` in Convex prod | Set in Convex Dashboard |
| Data from wrong environment | Dev Convex URL in Netlify | Point Netlify at prod URL |
