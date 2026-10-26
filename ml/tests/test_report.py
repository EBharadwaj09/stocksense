"""The backtest report states honestly what kind of data its numbers come from."""

import pandas as pd

from stocksense_ml.cli import _fmt_table, closing_note


def test_default_report_keeps_synthetic_caveat():
    note = closing_note([True, True])
    assert note.startswith("Both datasets are synthetic")


def test_real_data_is_not_called_synthetic():
    note = closing_note([False])
    assert "synthetic" not in note.split(".")[0].lower().replace("not marked synthetic", "")
    assert "real sales history" in note


def test_missing_festive_days_shown_as_dash():
    m = pd.DataFrame(
        {"MAE": [1.0], "WAPE": [0.2], "Bias": [0.01], "WAPE festive days": [float("nan")]}, index=["LightGBM"]
    )
    table = _fmt_table(m, "LightGBM")
    assert "nan" not in table and "| — |" in table
