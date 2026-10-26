"""Rolling-origin backtest and error metrics.

For each origin ``O`` the model is trained only on rows whose target day is ``<= O`` and then
forecasts days ``O+1 .. O+horizon`` for every product. Origins step back weekly from the end
of the data, so the last window ends on the last day of history.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .data import Panel
from .features import HORIZON, design, origin_stats, usable_origins
from .model import BASELINES, GBMForecaster, baseline_predictions


def mae(y: np.ndarray, p: np.ndarray) -> float:
    return float(np.mean(np.abs(p - y)))


def wape(y: np.ndarray, p: np.ndarray) -> float:
    """Weighted absolute percentage error: total absolute error / total actual sales."""
    total = np.sum(y)
    return float(np.sum(np.abs(p - y)) / total) if total > 0 else float("nan")


def bias(y: np.ndarray, p: np.ndarray) -> float:
    """Signed: +0.05 means 5% over-forecast in total."""
    total = np.sum(y)
    return float(np.sum(p - y) / total) if total > 0 else float("nan")


@dataclass
class BacktestResult:
    predictions: pd.DataFrame  # one row per (origin, product, horizon) with actual and every model
    models: list[str]
    origins: list[pd.Timestamp]
    horizon: int
    engine: str
    feature_importance: pd.Series | None

    def metrics(self) -> pd.DataFrame:
        y = self.predictions["y"].to_numpy()
        fest = self.predictions["festive"].to_numpy() == 1
        rows = []
        for m in self.models:
            p = self.predictions[m].to_numpy()
            rows.append(
                {
                    "model": m,
                    "MAE": mae(y, p),
                    "WAPE": wape(y, p),
                    "Bias": bias(y, p),
                    "WAPE festive days": wape(y[fest], p[fest]) if fest.any() else float("nan"),
                }
            )
        return pd.DataFrame(rows).set_index("model")


def backtest_origins(panel: Panel, n_origins: int, step: int, horizon: int) -> np.ndarray:
    last = panel.n_days - 1 - horizon
    origins = np.array([last - step * i for i in range(n_origins)][::-1])
    first_ok = usable_origins(panel)[0] + 56  # leave at least ~3 months to learn from
    origins = origins[origins >= first_ok]
    if len(origins) == 0:
        raise ValueError("Not enough history for a backtest (need ~3 months plus the horizon)")
    return origins


def run_backtest(
    panel: Panel, n_origins: int = 8, step: int = 7, horizon: int = HORIZON, engine: str = "auto"
) -> BacktestResult:
    stats = origin_stats(panel)
    rows = design(panel, usable_origins(panel), horizon=horizon, stats=stats)
    origins = backtest_origins(panel, n_origins, step, horizon)

    parts = []
    model = GBMForecaster(engine)
    for o in origins:
        train = rows[(rows["target"] <= o) & rows["y"].notna()]
        test = rows[(rows["origin"] == o) & rows["y"].notna()].copy()
        model.fit(train)
        test[model.label] = model.predict(test)
        for name, pred in baseline_predictions(test).items():
            test[name] = pred
        parts.append(test)

    preds = pd.concat(parts, ignore_index=True)
    preds["origin_date"] = panel.dates[preds["origin"].to_numpy()]
    preds["product_key"] = [panel.products[i] for i in preds["product"].cat.codes]
    keep = ["origin_date", "target_date", "product_key", "h", "festive", "y", model.label, *BASELINES]
    return BacktestResult(
        predictions=preds[keep],
        models=[*BASELINES, model.label],
        origins=list(panel.dates[origins]),
        horizon=horizon,
        engine=model.engine,
        feature_importance=model.feature_importance(),
    )


def forecast(panel: Panel, horizon: int = HORIZON, engine: str = "auto") -> pd.DataFrame:
    """Train on all history and forecast the next ``horizon`` days for every product."""
    stats = origin_stats(panel)
    rows = design(panel, usable_origins(panel), horizon=horizon, stats=stats)
    last = panel.n_days - 1
    model = GBMForecaster(engine).fit(rows[rows["y"].notna()])
    future = rows[rows["origin"] == last].copy()
    future["forecast"] = model.predict(future)
    return pd.DataFrame(
        {
            "date": future["target_date"].dt.strftime("%Y-%m-%d").to_numpy(),
            "product": [panel.products[i] for i in future["product"].cat.codes],
            "name": [panel.names.get(panel.products[i], "") for i in future["product"].cat.codes],
            "forecast": future["forecast"].round(2).to_numpy(),
        }
    ).sort_values(["product", "date"], ignore_index=True)
