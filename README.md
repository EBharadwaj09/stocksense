# StockSense

Inventory tracking and demand forecasting for small shops. Shop owners and staff record stock and sales; StockSense forecasts the next 14 days of demand per product and lists what to reorder before it runs out.

> **Status:** Milestone 2 of 5 — shops, staff roles, products, stock, sales and CSV import. See [Roadmap](#roadmap).

## Architecture

```
Browser ──► Next.js web app (Vercel) ──► Supabase Auth + Postgres
                    │
                    └──► FastAPI service (Render) ──► forecasting (from M3)
```

| Part | Tech | Folder |
| --- | --- | --- |
| Web app | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | `apps/web` |
| Auth and database | Supabase (Auth, Postgres) | — |
| API service | Python 3.12, FastAPI, PyJWT | `services/api` |
| CI | GitHub Actions: lint, unit tests, build, typecheck | `.github/workflows/ci.yml` |

**Security notes**

- Sessions use Supabase's HTTP-only cookies, refreshed on every request by `src/proxy.ts`; protected pages are checked on the server.
- The API verifies Supabase access tokens itself (JWKS for ES256/RS256, optional legacy HS256), checking signature, issuer, audience and expiry. `alg: none` and unknown algorithms are rejected.
- Login redirects only accept same-site paths (no open redirects). Sign-up shows the same message whether or not an email is already registered.
- All input is validated on the server with Zod; users see plain-language errors, never internal ones.
- JSON logs with a request ID on every API response (`X-Request-ID`).

## Data model and access rules

| Table | Holds | Who can write |
| --- | --- | --- |
| `shops` | One row per shop | Created via `create_shop()`; owners update |
| `shop_members` | User ↔ shop, role `owner` or `staff` | Via `create_shop()` / `accept_invite()`; owners remove staff |
| `shop_invites` | Pending staff invites by email | Owners |
| `products` | Catalogue, reorder point, supplier lead time | Owners |
| `sales` | Sales ledger (manual and imported history) | Members; owners delete |
| `stock_movements` | Stock ledger (opening, purchase, sale, correction) | Members; owners delete |
| `product_stock` (view) | Current stock = sum of movements | Read-only |

Every table has row-level security, so a user can only ever read or write data for shops they belong to. Sales and stock are append-only ledgers: corrections are new rows, never edits. `record_sale()` writes the sale and its stock decrease in one transaction. `import_sales()` (owners only) adds history for forecasting without changing current stock.

Migrations live in `supabase/migrations/`. `supabase/tests/rls_test.sql` checks the access rules with simulated owners, staff and outsiders inside a rolled-back transaction; run it in the Supabase SQL editor and expect `ALL_RLS_TESTS_PASSED`.

## Run locally

Requires Node.js 20.9+ and Python 3.12+.

```bash
# Web app
cd apps/web
cp .env.example .env.local      # then fill in your Supabase values
npm install
npm run dev                     # http://localhost:3000

# API (second terminal)
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # then fill in SUPABASE_URL
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

## Tests

```bash
cd apps/web && npm run lint && npm test && npm run build && npm run typecheck
cd services/api && ruff check . && pytest
```

CI runs all of these on every push and pull request.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel | Supabase publishable (or legacy anon) key — safe in the browser |
| `NEXT_PUBLIC_API_URL` | Vercel | URL of the Render API (used from M3) |
| `SUPABASE_URL` | Render | Same Supabase project URL, used to verify tokens |
| `ALLOWED_ORIGINS` | Render | Comma-separated web origins allowed to call the API |
| `SUPABASE_JWT_SECRET` | Render | Only for projects on the legacy JWT secret; otherwise leave empty |

Templates: `apps/web/.env.example`, `services/api/.env.example`. Never commit real values.

## Deploy

1. **Supabase:** create a project. Under *Authentication → URL Configuration*, set *Site URL* to your Vercel URL and add `https://<your-vercel-domain>/auth/callback` to *Redirect URLs*.
2. **Vercel:** import this repo, set *Root Directory* to `apps/web`, add the `NEXT_PUBLIC_*` variables, deploy.
3. **Render:** *New → Blueprint*, pick this repo (uses `render.yaml`), fill in `SUPABASE_URL` and `ALLOWED_ORIGINS`.
4. Check: sign up on the Vercel URL, confirm the email, land on the dashboard; `https://<render-url>/health` returns `{"status":"ok"}`.

The free Render plan sleeps when idle, so the first API request after a pause can take up to a minute.

## Roadmap

| Milestone | Scope | Status |
| --- | --- | --- |
| M1 Template | Monorepo, CI, deploy pipeline, auth | Done |
| M2 Core app | Shops, roles, products, stock, sales, CSV import | Done |
| M3 Model | Baselines + LightGBM, backtests, reproducible training | — |
| M4 Serving | Forecast API, nightly retraining, reorder list | — |
| M5 Release | Dashboard, accessibility pass, end-to-end tests, docs | — |

## License

MIT — see [LICENSE](LICENSE).
