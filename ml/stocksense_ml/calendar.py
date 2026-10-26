"""Calendar and festival features for target dates.

Festival dates live in ``festivals.csv`` (one row per festival per year). Each festival has a
window ``[start, end]`` and ``lead_days`` of pre-festival shopping. Update the file once a year;
dates past the last listed year simply get "no festival nearby" values.
"""

from __future__ import annotations

from functools import lru_cache
from importlib import resources

import numpy as np
import pandas as pd

CAP_DAYS = 30  # distances beyond this carry no extra signal
KIND_LOOKAHEAD = 21  # name the upcoming festival this many days ahead


@lru_cache(maxsize=1)
def festivals() -> pd.DataFrame:
    with resources.files("stocksense_ml").joinpath("festivals.csv").open() as fh:
        df = pd.read_csv(fh, parse_dates=["start", "end"])
    if (df["end"] < df["start"]).any():
        raise ValueError("festivals.csv: end before start")
    return df.sort_values("start").reset_index(drop=True)


def festival_kinds() -> list[str]:
    """Stable festival names; code 0 is reserved for 'none'."""
    return sorted(festivals()["name"].unique())


def calendar_features(dates: pd.DatetimeIndex) -> pd.DataFrame:
    """Per-date features: weekday, month, festival distance and kind, festive-window flag."""
    fest = festivals()
    kinds = {name: i + 1 for i, name in enumerate(festival_kinds())}
    d = dates.values.astype("datetime64[D]")
    starts = fest["start"].values.astype("datetime64[D]")
    ends = fest["end"].values.astype("datetime64[D]")
    leads = fest["lead_days"].to_numpy()
    codes = fest["name"].map(kinds).to_numpy()

    days_to = np.full(len(d), CAP_DAYS, dtype=float)
    days_since = np.full(len(d), CAP_DAYS, dtype=float)
    kind = np.zeros(len(d), dtype=int)
    festive = np.zeros(len(d), dtype=bool)
    for s, e, lead, code in zip(starts, ends, leads, codes, strict=True):
        to = (s - d).astype(int)  # days until the window starts
        since = (d - e).astype(int)  # days since the window ended
        inside = (to <= 0) & (since <= 0)
        ahead = to > 0
        days_to = np.where(inside, 0, np.where(ahead, np.minimum(days_to, to), days_to))
        days_since = np.where(since >= 0, np.minimum(days_since, since), days_since)
        near = inside | (ahead & (to <= KIND_LOOKAHEAD) & (to <= days_to))
        kind = np.where(near & ((kind == 0) | inside), code, kind)
        festive |= inside | (ahead & (to <= lead))

    return pd.DataFrame(
        {
            "dow": dates.dayofweek.to_numpy(),
            "dom": dates.day.to_numpy(),
            "month": dates.month.to_numpy(),
            "is_weekend": (dates.dayofweek >= 5).astype(int),
            "fest_days_to": np.minimum(days_to, CAP_DAYS),
            "fest_days_since": np.minimum(days_since, CAP_DAYS),
            "fest_kind": kind,
            "festive": festive.astype(int),
        },
        index=dates,
    )
