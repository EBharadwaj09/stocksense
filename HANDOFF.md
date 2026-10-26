# Handoff

Read this first in any new chat or tool session, then update it at the end.

## Current milestone

**P1 StockSense · M1 Template** — monorepo, CI, deploy pipeline, auth.

Acceptance criteria:

- [x] Sign-up and email confirmation work on the deployed Vercel URL (verified by owner 2026-10-26); sign-out/login re-check pending
- [x] CI green on `main` (web: lint, 3 unit-test files, build, typecheck; API: ruff, 19 pytest cases)
- [x] API live on Render (deploy status live). `/me` end-to-end from the web app gets exercised in M3 when the dashboard first calls the API
- [ ] README setup reproduced on a clean machine (or Codespace) — deferred; CI covers install/build/test from scratch

## Deployments

- Supabase project `stocksense` (ref `jhiaiqhnidyqgagchzbp`, region ap-south-1, Free plan); new asymmetric JWT signing keys.
- Vercel project `stocksense` (root `apps/web`, Hobby plan); auto-deploys `main`.
- Render web service `stocksense-api` (Singapore, Free plan): https://stocksense-api-416u.onrender.com; auto-deploys `main`.

## Done

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

- The build environment that writes code here has no package registry access, so CI is the verification gate for every change.
- No lockfile yet; CI generates one with `npm install`. Commit `apps/web/package-lock.json` after the first green run.

## Next task

M2 Core app: `shops` and `shop_members` (owner/staff) with row-level security, shop creation after sign-up, staff invites, products and stock movements. Supabase schema changes go through migrations applied with the Supabase connector and also committed under `supabase/migrations/`.

Gotcha: a page left open across a deploy can fail a form submit (stale Server Action). The error page now offers a reload, which fixes it.
