# StockSense forecasting (M3)

Predicts units sold per product for each of the next 14 days, so the app can warn before stock runs out.

```
make ml-install   # once
make train        # backtest -> reports/metrics.md (+ metrics.json)
make forecast     # next 14 days for the sample shop -> ml/forecast.csv
make ml-test
```

Results: [reports/metrics.md](reports/metrics.md) (written by `make train`, also shown in each CI run's summary).

## How it works

1. **Data** (`data.py`). Sales rows become a days x products table. Days without a sale count as 0 from a
   product's first sale onwards. Reads the app's import CSV, an export of the `daily_sales` view, a raw
   `sales` export (converted to India time), or Kaggle "Store Item Demand" (`--max-series` to limit).
2. **Features** (`features.py`). One row per product, forecast day (origin) and horizon 1–14:
   recent level (last day, 7/28/91-day means, spread, share of zero days, 7-vs-28 trend), the latest known
   same weekday, a 4-week same-weekday mean, last year's level around the target day, and the target day's
   calendar: weekday, day of month, month and festival distance/kind (`festivals.csv`).
   Every sales feature reads only days up to the origin; a test corrupts the future to prove it.
3. **Models** (`model.py`). Baselines: naive (last day), seasonal naive (same weekday), 7- and 28-day
   moving averages. Main model: one LightGBM regressor with a Poisson objective for all products and horizons.
4. **Backtest** (`backtest.py`). 8 weekly origins ending at the last day of data. At each origin the
   model is retrained on what was known that day and scored on the next 14 days.
   Metrics: MAE (units), WAPE (total error / total sales), bias, and WAPE on festival-window days.

## Data and honesty

Real shop history does not exist yet, so the report uses `samples/sample-sales-1-year.csv` and a
generated 3-year dataset (`synth.py`, seed 7). Both are synthetic: they prove the pipeline is correct and
beats simple rules on known patterns, not that it is accurate for a real shop. One year of history also
means each festival is seen only once, so festival lifts are learned best from the longer dataset.

To benchmark on public real data, download Kaggle's
[Store Item Demand Forecasting](https://www.kaggle.com/c/demand-forecasting-kernels-only/data) `train.csv` and run
`cd ml && python -m stocksense_ml backtest --data path/to/train.csv --label "Kaggle Store Item Demand" --out reports-kaggle`
(`--max-series 50` for a quick run). In GitHub: Actions → *Real-data benchmark* → Run workflow (needs the
`KAGGLE_JSON` secret, see `.github/workflows/benchmark.yml`); it pushes the report to the `m5-benchmark` branch.
The Kaggle data itself is never committed.

## Festivals

`stocksense_ml/festivals.csv` lists Gujarat-relevant festivals 2024–2027 (start, end, shopping lead days).
Add next year's dates each year; days after the last listed year are treated as "no festival nearby".

## Nightly forecasts (M4)

`.github/workflows/forecast.yml` runs `python -m stocksense_ml nightly` at about 02:11 IST (and on demand from
GitHub → Actions → Nightly forecast → Run workflow; tick "dry run" to test without writing). For each shop it reads
`daily_sales` up to yesterday, trains LightGBM (or uses a 28-day average with under 60 days of history), and writes
today + 13 days into `forecasts`, plus one `forecast_runs` row. The web app's Reorder page reads those tables.

Why GitHub Actions and not the Render API: a forecast run peaks at ~270 MB and the free Render instance has 512 MB,
sleeps when idle and has no persistent disk. Precomputing nightly costs nothing and keeps the dashboard fast.

The job needs the repository secret `SUPABASE_SECRET_KEY` (a Supabase secret key; it bypasses row-level security,
so it lives only in GitHub secrets, never in the web app or the repo).

## Demo account reset

`python -m stocksense_ml demo-reset [--dry-run]` (run first in the nightly workflow) resets the public demo account's
password, wipes its shops through the SQL function `demo_prepare()` and reloads `samples/sample-sales-1-year.csv`
shifted to end yesterday, with opening stock chosen so the Reorder page shows a mix of statuses. The account is the one
flagged `app_metadata.demo = true`; credentials come from `apps/web/src/lib/demo-account.json`. Tests: `tests/test_demo.py`.
