# End-to-end tests

Real Chromium against a running StockSense site (`E2E_BASE_URL`, default the live site), in this order:

1. Public pages: landing, `/dashboard` redirects to login, sign-up form validation (nothing is submitted, so no email is sent).
2. **Try the live demo** opens the demo shop with its banner.
3. Owner logs in, creates a shop, imports a year of sample sales (shifted to end yesterday; 10,896 rows, 3 skipped, 30 products created).
4. Stock in +50 and a sale of 2 → 48 in stock; a shelf count of 20 is saved as the difference.
5. The nightly forecast runs for that shop only (`python -m stocksense_ml nightly --shop <id>`), and the Reorder page shows the trained forecast with Sugar on *Order now*.
6. Owner invites staff; staff joins, has no Import/Team menu, is sent back from `/dashboard/import`, records a sale.
7. Sign-out returns to the home page and the dashboard needs a login again.

Users are created through the Supabase Auth admin API, already confirmed and flagged `app_metadata.e2e = true`. At the start and end of every run, all flagged users and the shops they created are deleted (leftovers from a crashed run included). Nothing else is touched.

```bash
pip install -r ml/requirements.txt -r e2e/requirements.txt
python -m playwright install chromium
cd e2e
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<secret key> python -m pytest
# E2E_BASE_URL=http://localhost:3000 to test a local `npm run dev`
```

In GitHub, `.github/workflows/e2e.yml` runs this after every production deploy and from Actions → *End-to-end tests* → Run workflow.
