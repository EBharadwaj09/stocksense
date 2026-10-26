# Handoff

Read this first in any new chat or tool session, then update it at the end.

## Current milestone

**P1 StockSense · M5 Release** — done 2026-10-26 (PRs #5–#13). All five milestones complete.

M5 plan:

- [x] Overview uses the same reorder rule as the Reorder page ("Order now" / "Order soon"; reorder point only when there is no forecast)
- [x] Stock count page (`/dashboard/stock/count`): type shelf counts for any products, difference saved as opening/adjustment movements; Reorder page points to it when no stock is recorded. Rules tested in `apps/web/src/lib/stock-count.ts`
- [x] Forgot password: `/forgot-password` (same message whether or not the email exists; rate limit shown) → email link → `/auth/callback?next=/reset-password` → `/reset-password` (new password twice). Login page links "Forgot password or email?" with guidance for a forgotten email (no usernames; staff ask the owner). Supabase's built-in email sender allows only a few emails per hour — set up custom SMTP before real users.
- [x] Public demo account (PR #7): "Try the live demo" on landing + login, banner, `demo@example.com` / `stocksense-demo-2026` (public on purpose, in `apps/web/src/lib/demo-account.json`, shared with the nightly job). Reset nightly by `python -m stocksense_ml demo-reset` (runs first in `forecast.yml`, failure doesn't block real shops) via SQL `demo_prepare()` (service_role only; refuses non-demo users; `supabase/tests/demo_test.sql` passes on the live project). The demo password can't be changed and no reset email is sent to it.
- [x] Screenshots: `screenshots.yml` (manual) logs in as the demo user on the live site and pushes desktop + mobile PNGs to branch `m5-screenshots`; copy `docs/screenshots` from it (the build sandbox can't reach the live site or download artifacts). Re-run after UI changes.
- [x] README showcase: live demo + credentials, screenshots, Mermaid architecture, forecast results, demo account, limitations
- [x] Kaggle benchmark (PR #9 workflow, results PR #12): `benchmark.yml` (manual) downloads `train.csv` with repository secret `KAGGLE_JSON` (owner's kaggle.json, added 2026-10-26) and pushes only the report to branch `m5-benchmark`; committed copy in `ml/reports-kaggle/`. All 500 series, 56,000 forecasts, 37 min: LightGBM WAPE 11.1% vs 18.3% (7-day avg), 39.2% lower, bias +0.4%. Described as a public benchmark (cleaner than a real shop), not "real shop data".
- [x] End-to-end tests (`e2e/`, Playwright Python + pytest, `.github/workflows/e2e.yml`): run on the live site after each production deploy and on demand; throwaway users flagged `app_metadata.e2e` are swept at start and end. `nightly --shop <id>` forecasts one shop. Covers sign-out/login re-check.
- [x] Mobile + accessibility pass (PR #11): Reorder and Products use cards on phones, tabs keep the current one in view, shop name on phones, two contrast fixes. `e2e/test_accessibility.py`: axe-core WCAG 2.2 A/AA on 13 pages × desktop/phone, no sideways scroll at 390 px, skip link. First run: 0 violations of any level, 12/12 tests pass.
- [x] Owner checked the live site on a real phone (demo + own shop) 2026-10-26: both open fine
- [x] Sign-out/login on the live site: covered by E2E after every deploy
- [x] Render auto-deploy: cause was the Render GitHub App not installed on the owner's GitHub account (service had only manual/API deploys). Owner installed it 2026-10-26; the merge of this change is the first push-triggered deploy

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

- GitHub pauses scheduled workflows after 60 days without repository activity; re-enable from the Actions tab if that happens.

- LightGBM cannot be installed in the build sandbox; locally the pipeline runs with `--engine sklearn` (HistGradientBoosting). CI is the source of truth for LightGBM metrics.
- kaggle.com and the live site are not reachable from the build sandbox; anything that needs them runs in GitHub Actions and reports through annotations or a pushed branch.
- The web app does not call the FastAPI service yet (`NEXT_PUBLIC_API_URL` is unused); the README says so.
- `gh pr create` and other GraphQL calls are blocked in the build sandbox; use `gh api repos/EBharadwaj09/stocksense/pulls` (REST). Workflow annotations are the way to read job output.

- The build environment that writes code here has no package registry access, so CI is the verification gate for every change.
- No lockfile yet; CI generates one with `npm install`. Commit `apps/web/package-lock.json` after the first green run.

## Next task

P1 StockSense is complete. Next: pick the next portfolio project (P2), or optional StockSense polish (custom SMTP before real users, real shop data for a true accuracy number). Sign-out/login on the live site is covered by the E2E run after every deploy.

E2E runs automatically on Vercel's success status for `main` (`e2e.yml`, `status` event: Vercel sets commit statuses, not GitHub deployments). Re-run Screenshots after UI changes and copy `docs/screenshots` from `m5-screenshots`.

Workflow: schema changes = new file in `supabase/migrations/` + apply with the Supabase connector + regenerate `apps/web/src/lib/database.types.ts`. Feature work on a branch → PR → CI green → merge (Vercel deploys main).

Gotcha: a page left open across a deploy can fail a form submit (stale Server Action). The error page now offers a reload, which fixes it.
