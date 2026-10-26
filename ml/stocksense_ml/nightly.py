"""Nightly forecast job: for every shop, train on its sales and store the next 14 days.

Runs in GitHub Actions (``.github/workflows/forecast.yml``). It talks to Supabase's REST API
with a secret key (bypasses row-level security), so it must never run in a browser.

    SUPABASE_URL=... SUPABASE_SECRET_KEY=... python -m stocksense_ml nightly [--dry-run]

Per shop: read ``daily_sales`` up to yesterday (shop time), train LightGBM, forecast today..today+13,
upsert into ``forecasts``, delete that shop's older rows, record a ``forecast_runs`` row.
Shops with less than ``MIN_MODEL_DAYS`` of history get a 28-day moving average instead.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from .backtest import forecast
from .data import Panel, build_panel
from .features import HORIZON
from .model import resolve_engine

MIN_MODEL_DAYS = 60  # below this, a moving average is more trustworthy than a trained model
PAGE = 1000  # Supabase REST returns at most 1000 rows per request by default
log = logging.getLogger("stocksense.nightly")

# (method, path, query, body) -> parsed JSON (or None)
Transport = Callable[[str, str, dict[str, str], object | None], object]


def rest_transport(url: str, key: str, timeout: float = 60) -> Transport:
    base = url.rstrip("/") + "/rest/v1/"
    headers = {"apikey": key, "Content-Type": "application/json"}
    if key.count(".") == 2:  # legacy service_role JWT also goes in Authorization
        headers["Authorization"] = f"Bearer {key}"
    if not base.startswith("https://"):
        raise ValueError("SUPABASE_URL must be an https:// URL")

    def call(method: str, path: str, query: dict[str, str], body: object | None) -> object:
        h = dict(headers)
        if method == "POST":
            h["Prefer"] = "resolution=merge-duplicates,return=minimal"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(  # noqa: S310 (https enforced above)
            base + path + "?" + urllib.parse.urlencode(query), data=data, headers=h, method=method
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            raw = resp.read()
        return json.loads(raw) if raw else None

    return call


@dataclass
class ShopResult:
    shop_id: str
    model: str
    products: int
    history_days: int
    rows_written: int
    note: str = ""


def _select_all(t: Transport, path: str, query: dict[str, str]) -> list[dict]:
    out: list[dict] = []
    while True:
        page = t("GET", path, {**query, "limit": str(PAGE), "offset": str(len(out))}, None)
        if not isinstance(page, list):
            raise RuntimeError(f"Unexpected response from {path}")
        out.extend(page)
        if len(page) < PAGE:
            return out


def moving_average_forecast(panel: Panel, horizon: int, first_day: date) -> pd.DataFrame:
    """Flat forecast: each product's mean over its last 28 days (or fewer, if newer)."""
    recent = panel.y[-28:]
    listed = ~np.isnan(recent)
    level = np.where(listed, recent, 0.0).sum(axis=0) / np.maximum(listed.sum(axis=0), 1)
    days = [first_day + timedelta(days=h) for h in range(horizon)]
    return pd.DataFrame(
        [
            {"date": d.isoformat(), "product": p, "forecast": round(float(level[j]), 2)}
            for j, p in enumerate(panel.products)
            for d in days
        ]
    )


def forecast_shop(
    sales: pd.DataFrame, today: date, horizon: int = HORIZON, engine: str = "auto"
) -> tuple[pd.DataFrame, str, int]:
    """Returns (rows ``date, product, forecast``, model name, history days). ``sales``: day, product_id, quantity."""
    rows = pd.DataFrame(
        {
            "date": pd.to_datetime(sales["day"]),
            "key": sales["product_id"].astype(str),
            "name": sales["product_id"].astype(str),
            "quantity": pd.to_numeric(sales["quantity"]),
        }
    )
    rows = rows[rows["quantity"] > 0]
    yesterday = pd.Timestamp(today - timedelta(days=1))
    if rows.empty or rows["date"].min() > yesterday:
        return pd.DataFrame(columns=["date", "product", "forecast"]), "none", 0
    panel = build_panel(rows, end=yesterday)
    if panel.n_days < MIN_MODEL_DAYS:
        return moving_average_forecast(panel, horizon, today), "moving_average_28d", panel.n_days
    fc = forecast(panel, horizon=horizon, engine=engine)
    return fc[["date", "product", "forecast"]], resolve_engine(engine), panel.n_days


def run(t: Transport, now: datetime | None = None, dry_run: bool = False, engine: str = "auto") -> list[ShopResult]:
    now = now or datetime.now(UTC)
    results = []
    for shop in _select_all(t, "shops", {"select": "id,timezone", "order": "created_at"}):
        sid = shop["id"]
        try:
            today = now.astimezone(ZoneInfo(shop.get("timezone") or "Asia/Kolkata")).date()
        except (KeyError, ValueError):
            today = now.astimezone(ZoneInfo("Asia/Kolkata")).date()
        sales = pd.DataFrame(
            _select_all(
                t,
                "daily_sales",
                {"select": "product_id,day,quantity", "shop_id": f"eq.{sid}", "day": f"lt.{today}", "order": "day"},
            ),
            columns=["product_id", "day", "quantity"],
        )
        active = {
            p["id"] for p in _select_all(t, "products", {"select": "id", "shop_id": f"eq.{sid}", "active": "is.true"})
        }
        fc, model, history = forecast_shop(sales, today, engine=engine)
        fc = fc[fc["product"].isin(active)]
        generated = now.isoformat()
        payload = [
            {"shop_id": sid, "product_id": r.product, "day": r.date, "quantity": max(0.0, float(r.forecast)),
             "generated_at": generated}
            for r in fc.itertuples(index=False)
        ]
        note = "" if model != "none" else "no sales history yet"
        result = ShopResult(sid, model, fc["product"].nunique(), history, len(payload), note)
        log.info("shop %s: model=%s products=%d history=%dd rows=%d",
                 sid, model, result.products, history, len(payload))
        results.append(result)
        if dry_run:
            continue
        for i in range(0, len(payload), PAGE):
            t("POST", "forecasts", {"on_conflict": "product_id,day"}, payload[i : i + PAGE])
        # drop this shop's rows from earlier runs (past days, removed or inactive products)
        t("DELETE", "forecasts", {"shop_id": f"eq.{sid}", "generated_at": f"lt.{generated}"}, None)
        t(
            "POST",
            "forecast_runs",
            {"on_conflict": "shop_id"},
            [{"shop_id": sid, "generated_at": generated, "first_day": today.isoformat(), "horizon_days": HORIZON,
              "model": model, "products": result.products, "history_days": history, "note": note or None}],
        )
    return results


def main(dry_run: bool = False, engine: str = "auto") -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SECRET_KEY", "")
    if not url or not key:
        log.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY")
        return 2
    results = run(rest_transport(url, key), dry_run=dry_run, engine=engine)
    log.info("done: %d shops, %d forecast rows%s", len(results), sum(r.rows_written for r in results),
             " (dry run, nothing written)" if dry_run else "")
    return 0
