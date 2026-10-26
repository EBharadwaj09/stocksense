# Handoff

Read this first in any new chat or tool session, then update it at the end.

## Current milestone

**P1 StockSense · M1 Template** — monorepo, CI, deploy pipeline, auth.

Acceptance criteria:

- [ ] Sign-up, email confirmation and login work on the deployed Vercel URL
- [ ] CI green on `main`
- [ ] API `/health` live on Render; `/me` returns the user for a valid Supabase token
- [ ] README setup reproduced on a clean machine (or Codespace)

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

- First CI run not yet done: the build environment that wrote M1 had no package registry access, so web lint/build and API pytest are verified in CI. Token verification logic was checked locally.
- No lockfile yet; CI generates one with `npm install`. Commit `apps/web/package-lock.json` after the first green run.

## Next task

Deploy (Supabase → Vercel → Render), then start M2: shops, owner/staff roles with row-level security, products and stock movements.
