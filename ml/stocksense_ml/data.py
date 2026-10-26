"""Load sales history and turn it into a daily product panel.

Supported input formats (detected from the CSV header):

* StockSense import CSV: ``date, sku, product, quantity[, price]`` (the sample file)
* ``daily_sales`` view export: ``day, product_id, quantity``
* raw ``sales`` table export: ``sold_at, product_id, quantity`` (timestamps converted to shop time)
* Kaggle "Store Item Demand": ``date, store, item, sales`` (each store-item pair is one series)

Days with no sale are filled with 0 from a product's first sale onwards. Before the first sale the
product did not exist yet, so those days are NaN and never used for training or scoring.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

SHOP_TIMEZONE = "Asia/Kolkata"


@dataclass(frozen=True)
class Panel:
    dates: pd.DatetimeIndex  # continuous daily index
    products: list[str]  # series keys, column order of ``y``
    names: dict[str, str]  # key -> display name
    y: np.ndarray  # shape (days, products); NaN before a product's first sale
    skipped_rows: int = 0

    @property
    def n_days(self) -> int:
        return len(self.dates)

    @property
    def n_products(self) -> int:
        return len(self.products)


def _clean(
    df: pd.DataFrame, date_col: str, key_col: str, name_col: str, qty_col: str, allow_zero: bool = False
) -> tuple[pd.DataFrame, int]:
    out = pd.DataFrame(
        {
            "date": pd.to_datetime(df[date_col], errors="coerce", format="mixed"),
            "key": df[key_col].astype("string").str.strip(),
            "name": df[name_col].astype("string").str.strip(),
            "quantity": pd.to_numeric(df[qty_col], errors="coerce"),
        }
    )
    valid = out["date"].notna() & out["key"].fillna("").ne("")
    valid &= out["quantity"].ge(0) if allow_zero else out["quantity"].gt(0)
    keep = valid & out["quantity"].gt(0)  # zero days are re-created by the panel
    return out[keep].reset_index(drop=True), int((~valid).sum())


def read_sales(path: str | Path, max_series: int | None = None) -> tuple[pd.DataFrame, int]:
    """Read a sales CSV into long format ``date, key, name, quantity``. Returns (rows, skipped)."""
    raw = pd.read_csv(path, dtype=str, keep_default_na=False)
    cols = {c.strip().lower() for c in raw.columns}
    raw.columns = [c.strip().lower() for c in raw.columns]

    if {"date", "store", "item", "sales"} <= cols:  # Kaggle Store Item Demand
        raw["key"] = "s" + raw["store"].str.strip() + "-i" + raw["item"].str.strip()
        df, skipped = _clean(raw, "date", "key", "key", "sales", allow_zero=True)
    elif {"date", "quantity"} <= cols and ({"sku", "product"} & cols):  # StockSense import CSV
        if "sku" not in raw:
            raw["sku"] = ""
        if "product" not in raw:
            raw["product"] = raw["sku"]
        raw["key"] = raw["sku"].where(raw["sku"].str.strip().ne(""), raw["product"]).str.strip().str.lower()
        df, skipped = _clean(raw, "date", "key", "product", "quantity")
    elif {"day", "product_id", "quantity"} <= cols:  # daily_sales view export
        df, skipped = _clean(raw, "day", "product_id", "product_id", "quantity")
    elif {"sold_at", "product_id", "quantity"} <= cols:  # sales table export (timestamptz)
        ts = pd.to_datetime(raw["sold_at"], errors="coerce", utc=True, format="mixed")
        raw["sold_day"] = ts.dt.tz_convert(SHOP_TIMEZONE).dt.strftime("%Y-%m-%d")
        df, skipped = _clean(raw, "sold_day", "product_id", "product_id", "quantity")
    else:
        raise ValueError(f"Unrecognised sales CSV columns: {sorted(cols)}")

    df["date"] = df["date"].dt.normalize()
    if max_series is not None:
        keep = sorted(df["key"].unique())[:max_series]
        df = df[df["key"].isin(keep)]
    return df, skipped


def build_panel(rows: pd.DataFrame, skipped: int = 0, end: str | pd.Timestamp | None = None) -> Panel:
    """Aggregate long rows to a (days x products) matrix with zero-filled gaps.

    ``end`` extends (with zeros) or cuts the history at that day, e.g. yesterday for a nightly run.
    """
    if end is not None:
        rows = rows[rows["date"] <= pd.Timestamp(end)]
    if rows.empty:
        raise ValueError("No valid sales rows")
    wide = rows.pivot_table(index="date", columns="key", values="quantity", aggfunc="sum")
    last = pd.Timestamp(end) if end is not None else wide.index.max()
    dates = pd.date_range(wide.index.min(), last, freq="D")
    wide = wide.reindex(dates).fillna(0.0)
    first = rows.groupby("key")["date"].min()
    y = np.array(wide.to_numpy(dtype=float), copy=True)
    for j, key in enumerate(wide.columns):
        y[dates < first[key], j] = np.nan
    names = rows.drop_duplicates("key").set_index("key")["name"].astype(str).to_dict()
    return Panel(dates=dates, products=[str(k) for k in wide.columns], names=names, y=y, skipped_rows=skipped)


def load_panel(path: str | Path, max_series: int | None = None) -> Panel:
    rows, skipped = read_sales(path, max_series=max_series)
    return build_panel(rows, skipped)
