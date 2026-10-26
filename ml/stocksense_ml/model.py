"""Forecasters: simple baselines and the gradient-boosted model."""

from __future__ import annotations

import importlib.util

import numpy as np
import pandas as pd

from .features import FEATURES

# Baselines read one column of the design matrix (all computed from days <= origin).
BASELINES = {
    "Naive (last day)": "y_last",
    "Seasonal naive (same weekday)": "snaive",
    "Moving average 7d": "mean_7",
    "Moving average 28d": "mean_28",
}

LGBM_PARAMS = {
    "objective": "poisson",  # counts: non-negative, variance grows with the mean
    "n_estimators": 400,
    "learning_rate": 0.05,
    "num_leaves": 31,
    "min_child_samples": 50,
    "subsample": 0.8,
    "subsample_freq": 1,
    "colsample_bytree": 0.8,
    "reg_lambda": 1.0,
    "random_state": 42,
    "deterministic": True,
    "force_row_wise": True,
    "n_jobs": 1,
    "verbose": -1,
}


def baseline_predictions(rows: pd.DataFrame) -> dict[str, np.ndarray]:
    out = {}
    for name, col in BASELINES.items():
        pred = rows[col].to_numpy(dtype=float)
        # fall back to the 28-day mean where a baseline has no history (e.g. new product)
        out[name] = np.where(np.isnan(pred), rows["mean_28"].to_numpy(dtype=float), pred)
    return out


def resolve_engine(engine: str = "auto") -> str:
    if engine == "auto":
        return "lightgbm" if importlib.util.find_spec("lightgbm") else "sklearn"
    if engine not in {"lightgbm", "sklearn"}:
        raise ValueError(f"Unknown engine {engine!r}")
    return engine


class GBMForecaster:
    """LightGBM with a Poisson objective. ``engine="sklearn"`` uses scikit-learn's
    HistGradientBoostingRegressor (same algorithm family) where LightGBM is not installed."""

    def __init__(self, engine: str = "auto"):
        self.engine = resolve_engine(engine)
        self.model = None
        self._all_nan: list[str] = []

    @property
    def label(self) -> str:
        return "LightGBM" if self.engine == "lightgbm" else "Gradient boosting (sklearn fallback)"

    def _x(self, rows: pd.DataFrame) -> pd.DataFrame:
        x = rows[FEATURES]
        if self.engine == "sklearn":
            if len(x["product"].cat.categories) > 250:
                x = x.assign(product=x["product"].cat.codes)  # HistGradientBoosting caps categories at 255
            # HistGradientBoosting cannot bin an all-missing column (e.g. last_year_7 with < 1 year history)
            x = x.assign(**{c: x[c].fillna(-1.0) for c in self._all_nan})
        return x

    def fit(self, rows: pd.DataFrame) -> GBMForecaster:
        numeric = rows[FEATURES].select_dtypes("number")
        self._all_nan = [c for c in numeric if numeric[c].isna().all()]
        x, y = self._x(rows), rows["y"].to_numpy(dtype=float)
        if self.engine == "lightgbm":
            import lightgbm as lgb

            self.model = lgb.LGBMRegressor(**LGBM_PARAMS).fit(x, y)
        else:
            from sklearn.ensemble import HistGradientBoostingRegressor

            self.model = HistGradientBoostingRegressor(
                loss="poisson",
                max_iter=400,
                learning_rate=0.05,
                max_leaf_nodes=31,
                min_samples_leaf=50,
                l2_regularization=1.0,
                categorical_features="from_dtype",
                random_state=42,
            ).fit(x, y)
        return self

    def predict(self, rows: pd.DataFrame) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("fit() first")
        return np.clip(self.model.predict(self._x(rows)), 0, None)

    def feature_importance(self) -> pd.Series | None:
        if self.engine != "lightgbm" or self.model is None:
            return None
        gain = self.model.booster_.feature_importance(importance_type="gain")
        return pd.Series(gain / gain.sum(), index=FEATURES).sort_values(ascending=False)
