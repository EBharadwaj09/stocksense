# Handoff

Read this first in any new chat or tool session, then update it at the end.

## Current milestone

**P1 StockSense · M5 Release** — in progress on branch `m5-release`. M4 merged (PR #4) and verified by the owner 2026-10-26.

M5 plan:

- [x] Overview uses the same reorder rule as the Reorder page ("Order now" / "Order soon"; reorder point only when there is no forecast)
- [ ] Bulk opening stock (enter today's count for every product on one page) — imported shops start at 0 stock, so everything shows "Order now"
- [ ] Mobile + accessibility pass (keyboard, contrast, screen-reader labels)
- [ ] End-to-end tests of the main flows (sign-up → shop → import → stock → reorder)
- [ ] Final docs: README walkthrough, screenshots, limitations
- [ ] Re-check sign-out/login on the live site; fix Render auto-deploy before any API change

## Deployments

- Supabase project `stocksense` (ref `jhiaiqhnidyqgagchzbp`, region ap-south-1, Free plan); new asymmetric JWT signing keys.
- Vercel project `stocksense` (root `apps/web`, Hobby plan); auto-deploys `main`.
- Render web service `stocksense-api` (Singapore, Free plan): https://stocksense-api-416u.onrender.com; auto-deploys `main`.

## M4 done (2026-10-26, PR #4)

- No model on Render (a run peaks ~270 MB; free Render = 512 MB, sleeps, no disk). Forecasts are precomputed nightly by GitHub Actions (`.github/workflows/forecast.yml`, ~02:11 IST, manual + dry-run) and stored in Supabase.
- Tables `forecasts` (product × day, 14 days) and `forecast_runs` (one row per shop); members read, only the job's secret key writes. RLS test extended; passes on the live project.
- Job `ml/stocksense_ml/nightly.py`: per shop, `daily_sales` up to yesterday (shop time) → LightGBM (28-day average under 60 days of history) → upsert, then delete that shop's older rows. 5 tests with a fake Supabase.
- Secret: GitHub repository secret `SUPABASE_SECRET_KEY` = Supabase secret key `github_nightly` (added by owner). Rotate in Supabase → API Keys if it ever leaks, then update the GitHub secret.
- First run 2026-10-26: 1 shop, 30 products, 420 rows, LightGBM on 364 days; next-7-day total 2,848 vs recent pace 2,857.
- Web: Reorder page (status, stock, next 7 days, days left, lead time, suggested order) + rules in `apps/web/src/lib/reorder.ts` (10 tests). Owner verified live: Amul Ghee 100 → Enough stock, 27 days; Sugar 48 → Order now, 1 day, 535.
- Reorder rule: order now if stock ≤ demand over lead time + reorder point; order soon if ≤ demand over lead time + 7 days + reorder point; suggestion tops up to the latter.

## M3 done (2026-10-26, PR #3)

- `ml/` package (`ml/README.md` explains it): loader (import CSV, `daily_sales`/`sales` exports, Kaggle), zero-filled daily panel, festival calendar (`ml/stocksense_ml/festivals.csv`, 2024–2027 — add 2028 dates next year), direct multi-horizon features (14 days), 4 baselines, LightGBM Poisson model, 8-origin weekly rolling backtest (MAE, WAPE, bias, festive-day WAPE).
- `make train` → `ml/reports/metrics.md` + `metrics.json` (committed copy is from CI, LightGBM 4.7.0). `make forecast` → next 14 days CSV.
- Results (LightGBM vs best baseline, WAPE): sample 1-year 24.5% vs 26.5% (7.6% lower); synthetic 3-year 21.0% vs 25.3% (17.1% lower; festive days 20.9% vs 27.4%+). Both datasets synthetic — real accuracy unknown until real shop history.
- 12 pytest cases incl. a no-leakage test (future values corrupted, features unchanged).
- Supabase: `daily_sales` view (security_invoker, anon revoked) applied to the live project; totals match `sales` exactly; `rls_test.sql` extended and passes on the live project; types regenerated.
- CI: new `ML (lint, test, backtest)` job; failure output and metrics are published as annotations (the build sandbox cannot download CI logs/artifacts).

## M2 done (2026-10-26)

- Database (`supabase/migrations/`): shops, shop_members (owner/staff), shop_invites, products, sales, stock_movements, product_stock view; RLS on every table; RPCs `create_shop`, `accept_invite`, `record_sale`, `import_sales`. Applied to the live project with the Supabase connector.
- `supabase/tests/rls_test.sql` passes on the live project (cross-shop isolation, staff limits, import rules, anon blocked).
- App: onboarding (create shop / join via invite), Overview, Sales, Stock, Products (owner edits), Import (owner), Team (owner).
- Invites: owner adds an email; staff signs up with that email and taps "Join shop". No emails sent by us (no secret keys needed).
- CSV import: parsed and validated in the browser, sent in 1,000-row batches, re-validated by the server action and again in SQL. 10k rows validate in ~50 ms locally; the database imports 10k rows (10 batches) in 0.9 s after the hash-join rewrite (was 16.9 s).
- Sample data: `samples/sample-sales-1-year.csv` (10,896 valid rows + 3 broken). Owner UI test passed 2026-10-26: shop created, sample imported in 7.8 s end-to-end (browser → Vercel → Supabase), 30 products auto-created, reorder point edit, stock in (+50), sale (−2) → stock 48, Overview correct.
- Supabase advisor: two expected warnings (create_shop, accept_invite are SECURITY DEFINER by design and check the caller). Leaked-password protection is a dashboard setting, off.

## M1 done


- Next.js web app: landing, sign-up, login, email-confirmation callback, protected dashboard, sign-out (POST), error and 404 pages, security headers.
- Validation (Zod), safe redirects, friendly auth errors — unit tests with Vitest.
- FastAPI service: `/health`, `/me` with Supabase JWT verification (ES256/RS256 via JWKS, optional HS256), request IDs, JSON logs — pytest suite.
- GitHub Actions CI, `render.yaml` blueprint, `.env.example` files, README.

## Decisions

- Next.js 16 `proxy.ts` (replaces middleware) refreshes the Supabase session.
- `getUser()` (server-verified) is used for access checks, never the cookie alone.
- The API verifies tokens locally instead of calling Supabase on every request.
- Full name is stored in Supabase user metadata for now; a `profiles` table arrives with shops in M2.

## Open issues

- Render auto-deploy is not firing: last deploy 2026-10-26 10:29 (API commit 6b84efa) although later commits hit `main`. Harmless while the API is unchanged; reconnect Render's GitHub app (or deploy manually) before the next API change.
- GitHub pauses scheduled workflows after 60 days without repository activity; re-enable from the Actions tab if that happens.

- LightGBM cannot be installed in the build sandbox; locally the pipeline runs with `--engine sklearn` (HistGradientBoosting). CI is the source of truth for LightGBM metrics.
- Kaggle real-data benchmark not run (needs a Kaggle login to download); command is in `ml/README.md`.

- The build environment that writes code here has no package registry access, so CI is the verification gate for every change.
- No lockfile yet; CI generates one with `npm install`. Commit `apps/web/package-lock.json` after the first green run.

## Next task

M5: bulk opening stock page next (see plan above).

Workflow: schema changes = new file in `supabase/migrations/` + apply with the Supabase connector + regenerate `apps/web/src/lib/database.types.ts`. Feature work on a branch → PR → CI green → merge (Vercel deploys main).

Gotcha: a page left open across a deploy can fail a form submit (stale Server Action). The error page now offers a reload, which fixes it.
