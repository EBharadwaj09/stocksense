"""Direct multi-horizon design matrix.

One row = (product, forecast origin ``o``, horizon ``h``) predicting sales on day ``t = o + h``.
Every sales-derived feature only reads days ``<= o``, so a row never sees its own future.
``tests/test_features.py`` checks this by corrupting all days after the origin.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .calendar import calendar_features, festival_kinds
from .data import Panel

HORIZON = 14
MIN_HISTORY = 28  # first usable origin index

ORIGIN_FEATURES = ["y_last", "mean_7", "mean_28", "mean_91", "std_28", "zero_28", "trend_7_28"]
TARGET_FEATURES = ["snaive", "same_dow_4w", "last_year_7"]
CALENDAR_FEATURES = ["dow", "dom", "month", "is_weekend", "fest_days_to", "fest_days_since", "fest_kind"]
FEATURES = ["product", "h", *ORIGIN_FEATURES, *TARGET_FEATURES, *CALENDAR_FEATURES]
CATEGORICAL = ["product", "fest_kind"]


def _rolling(y: pd.DataFrame, window: int, how: str) -> np.ndarray:
    r = y.rolling(window, min_periods=1)
    return getattr(r, how)().to_numpy()


def origin_stats(panel: Panel) -> dict[str, np.ndarray]:
    """(days x products) arrays of statistics known at the end of each day."""
    y = pd.DataFrame(panel.y)
    zero = y.eq(0).astype(float).where(y.notna())
    m7 = _rolling(y, 7, "mean")
    m28 = _rolling(y, 28, "mean")
    # mean of the same weekday over the last 4 weeks ending on each day (d, d-7, d-14, d-21)
    same_dow = sum(y.shift(7 * k) for k in range(4)) / 4
    return {
        "y": panel.y,
        "y_last": panel.y,
        "mean_7": m7,
        "mean_28": m28,
        "mean_91": _rolling(y, 91, "mean"),
        "std_28": y.rolling(28, min_periods=2).std().to_numpy(),
        "zero_28": _rolling(zero, 28, "mean"),
        "trend_7_28": m7 / (m28 + 0.1),
        "same_dow_4w": same_dow.to_numpy(),
        "trailing_7": m7,
    }


def _take(arr: np.ndarray, rows: np.ndarray) -> np.ndarray:
    """arr[rows] with NaN for negative or out-of-range rows."""
    out = np.full((len(rows), arr.shape[1]), np.nan)
    ok = (rows >= 0) & (rows < arr.shape[0])
    out[ok] = arr[rows[ok]]
    return out


def design(
    panel: Panel,
    origins: np.ndarray,
    horizon: int = HORIZON,
    stats: dict[str, np.ndarray] | None = None,
) -> pd.DataFrame:
    """Rows for every listed product at each origin index and horizon 1..``horizon``.

    ``y`` is the target (NaN when the target day is beyond the data), ``festive`` marks target days
    in a festival shopping window (used for scoring, not as a feature).
    """
    stats = stats or origin_stats(panel)
    origins = np.asarray(origins, dtype=int)
    n_prod = panel.n_products
    ext_dates = pd.date_range(panel.dates[0], periods=panel.n_days + horizon, freq="D")
    cal = calendar_features(ext_dates)
    kinds = len(festival_kinds())

    frames = []
    for h in range(1, horizon + 1):
        t = origins + h
        k0 = -(-h // 7)  # latest same weekday that is known at the origin: t - 7*k0 <= o
        cols: dict[str, np.ndarray] = {
            "origin": np.repeat(origins, n_prod),
            "target": np.repeat(t, n_prod),
            "product": np.tile(np.arange(n_prod), len(origins)),
            "h": np.full(len(origins) * n_prod, h),
        }
        for name in ORIGIN_FEATURES:
            cols[name] = _take(stats[name], origins).ravel()
        cols["snaive"] = _take(stats["y"], t - 7 * k0).ravel()
        cols["same_dow_4w"] = _take(stats["same_dow_4w"], t - 7 * k0).ravel()
        cols["last_year_7"] = _take(stats["trailing_7"], t - 361).ravel()  # mean of days t-367..t-361
        cols["y"] = _take(stats["y"], t).ravel()
        c = cal.iloc[t]
        for name in [*CALENDAR_FEATURES, "festive"]:
            cols[name] = np.repeat(c[name].to_numpy(), n_prod)
        frames.append(pd.DataFrame(cols))

    df = pd.concat(frames, ignore_index=True)
    df = df[df["y_last"].notna()].reset_index(drop=True)  # product not yet listed at the origin
    df["product"] = pd.Categorical(df["product"], categories=range(n_prod))
    df["fest_kind"] = pd.Categorical(df["fest_kind"], categories=range(kinds + 1))
    df["target_date"] = ext_dates[df["target"].to_numpy()]
    return df


def usable_origins(panel: Panel) -> np.ndarray:
    return np.arange(MIN_HISTORY - 1, panel.n_days)
