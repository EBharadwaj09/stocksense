from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from stocksense_ml.backtest import bias, forecast, mae, run_backtest, wape
from stocksense_ml.calendar import calendar_features, festival_kinds
from stocksense_ml.data import build_panel, load_panel, read_sales
from stocksense_ml.features import HORIZON, design, usable_origins
from stocksense_ml.synth import generate

SAMPLE = Path(__file__).resolve().parents[2] / "samples" / "sample-sales-1-year.csv"


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "sales.csv"
    path.write_text(text)
    return path


# ------------------------------------------------------------------ data


def test_sample_loads_with_three_invalid_rows():
    panel = load_panel(SAMPLE)
    assert panel.n_products == 30
    assert panel.skipped_rows == 3
    assert panel.dates.is_monotonic_increasing and panel.dates.freq == "D"
    assert np.nanmin(panel.y) == 0  # missing days are zero-filled


def test_gaps_are_zero_and_days_before_first_sale_are_missing(tmp_path):
    path = write(
        tmp_path,
        "date,sku,product,quantity\n2026-01-01,A,Apple,2\n2026-01-01,A,Apple,3\n2026-01-03,A,Apple,1\n"
        "2026-01-02,B,Bun,4\n",
    )
    panel = load_panel(path)
    a, b = panel.products.index("a"), panel.products.index("b")
    assert panel.y[:, a].tolist() == [5, 0, 1]  # same-day rows are summed, the gap is 0
    assert np.isnan(panel.y[0, b]) and panel.y[1:, b].tolist() == [4, 0]


def test_sales_export_uses_shop_time(tmp_path):
    # 20:00 UTC is 01:30 next day in India
    path = write(tmp_path, "sold_at,product_id,quantity\n2026-01-01T20:00:00Z,p1,2\n2026-01-01T10:00:00Z,p1,1\n")
    rows, _ = read_sales(path)
    assert sorted(rows["date"].dt.strftime("%Y-%m-%d")) == ["2026-01-01", "2026-01-02"]


def test_kaggle_format_keeps_zero_days(tmp_path):
    path = write(tmp_path, "date,store,item,sales\n2017-01-01,1,1,3\n2017-01-02,1,1,0\n2017-01-03,1,1,2\n")
    panel = load_panel(path)
    assert panel.skipped_rows == 0
    assert panel.y[:, 0].tolist() == [3, 0, 2]


def test_unknown_format_is_rejected(tmp_path):
    with pytest.raises(ValueError, match="Unrecognised"):
        read_sales(write(tmp_path, "a,b\n1,2\n"))


# ------------------------------------------------------------------ calendar


def test_festival_features():
    dates = pd.date_range("2026-10-06", "2026-10-22")  # Navratri 11 Oct to Dussehra 20 Oct 2026, 3 lead days
    cal = calendar_features(dates)
    kind = festival_kinds().index("navratri_dussehra") + 1
    assert cal.loc["2026-10-10", "fest_days_to"] == 1
    assert cal.loc["2026-10-15", "fest_days_to"] == 0
    assert cal.loc["2026-10-15", "fest_kind"] == kind
    assert cal.loc["2026-10-07", "festive"] == 0 and cal.loc["2026-10-08", "festive"] == 1
    assert cal.loc["2026-10-21", "fest_days_since"] == 1
    assert cal.loc["2026-10-22", "fest_kind"] == festival_kinds().index("diwali") + 1  # Diwali window next


# ------------------------------------------------------------------ features


def test_features_never_read_the_future():
    panel = build_panel(*read_sales(SAMPLE))
    origin = 200
    clean = design(panel, np.array([origin]))
    poisoned_y = panel.y.copy()
    poisoned_y[origin + 1 :] = 1e6
    poisoned = design(type(panel)(panel.dates, panel.products, panel.names, poisoned_y), np.array([origin]))
    features = [c for c in clean.columns if c not in {"y"}]
    pd.testing.assert_frame_equal(clean[features], poisoned[features])
    assert (poisoned["y"] == 1e6).all()  # only the target changed


def test_seasonal_naive_uses_latest_known_same_weekday():
    dates = pd.date_range("2026-01-01", periods=70)
    rows = pd.DataFrame({"date": dates, "key": "a", "name": "A", "quantity": np.arange(1, 71, dtype=float)})
    panel = build_panel(rows)
    d = design(panel, np.array([60]))
    by_h = d.set_index("h")
    assert by_h.loc[1, "snaive"] == panel.y[61 - 7, 0]
    assert by_h.loc[7, "snaive"] == panel.y[67 - 7, 0]
    assert by_h.loc[8, "snaive"] == panel.y[68 - 14, 0]
    assert by_h.loc[1, "y_last"] == panel.y[60, 0]
    assert len(d) == HORIZON


# ------------------------------------------------------------------ metrics and model


def test_metrics():
    y, p = np.array([10.0, 0.0, 10.0]), np.array([8.0, 1.0, 12.0])
    assert mae(y, p) == pytest.approx(5 / 3)
    assert wape(y, p) == pytest.approx(5 / 20)
    assert bias(y, p) == pytest.approx(1 / 20)


@pytest.fixture(scope="module")
def small_synthetic(tmp_path_factory):
    path = tmp_path_factory.mktemp("synth") / "s.csv"
    generate(start="2024-06-01", end="2026-06-30", n_products=8, seed=3).to_csv(path, index=False)
    return load_panel(path)


def test_backtest_beats_baselines_on_synthetic(small_synthetic):
    res = run_backtest(small_synthetic, n_origins=3)
    m = res.metrics()
    gbm = res.models[-1]
    assert len(res.predictions) == 3 * HORIZON * small_synthetic.n_products
    assert m.loc[gbm, "WAPE"] < m.drop(index=gbm)["WAPE"].min()
    assert abs(m.loc[gbm, "Bias"]) < 0.1


def test_forecast_shape(small_synthetic):
    fc = forecast(small_synthetic)
    assert len(fc) == HORIZON * small_synthetic.n_products
    assert (fc["forecast"] >= 0).all()
    assert fc["date"].min() == (small_synthetic.dates[-1] + pd.Timedelta(days=1)).strftime("%Y-%m-%d")


def test_usable_origins_leave_four_weeks_of_history(small_synthetic):
    assert usable_origins(small_synthetic)[0] == 27
