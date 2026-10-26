# Sample data

`sample-sales-1-year.csv` is synthetic: one year (2025-10-27 to 2026-10-25) of daily sales for 30 typical kirana products. Demand follows a Poisson process with a weekend lift, a mild yearly cycle and festival spikes (Uttarayan, Holi, Navratri/Dussehra) on festive items such as sugar, ghee and besan. It is generated, not real shop data.

The last 3 rows are deliberately invalid (zero quantity, impossible date, missing product) to demonstrate the import error report. Expected result: 10,896 rows imported, 3 skipped.

Use it to test the CSV import (Dashboard → Import) and, in M3, to develop the forecasting model until real shop history is available.
