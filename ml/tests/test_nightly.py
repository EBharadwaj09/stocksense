from datetime import UTC, date, datetime

import pandas as pd
import pytest

from stocksense_ml.features import HORIZON
from stocksense_ml.nightly import PAGE, forecast_shop, run
from stocksense_ml.synth import generate

NOW = datetime(2026, 6, 30, 21, 0, tzinfo=UTC)  # 02:30 on 1 July in India
TODAY = date(2026, 7, 1)


class FakeSupabase:
    """Just enough of PostgREST for the nightly job: eq/lt/is filters, limit/offset, upserts, deletes."""

    def __init__(self, tables):
        self.tables = tables
        self.calls = []

    @staticmethod
    def _match(row, query):
        for col, cond in query.items():
            if col in {"select", "order", "limit", "offset", "on_conflict"}:
                continue
            op, _, value = cond.partition(".")
            cell = str(row.get(col)).lower()
            if op == "eq" and cell != value.lower():
                return False
            if op == "is" and cell != value:
                return False
            if op == "lt" and not str(row.get(col)) < value:
                return False
            if op == "in" and str(row.get(col)) not in value.strip("()").split(","):
                return False
        return True

    def __call__(self, method, path, query, body):
        self.calls.append((method, path, dict(query)))
        rows = self.tables.setdefault(path, [])
        if method == "GET":
            hits = [r for r in rows if self._match(r, query)]
            start = int(query.get("offset", 0))
            return hits[start : start + int(query.get("limit", PAGE))]
        if method == "POST":
            keys = query["on_conflict"].split(",")
            for new in body:
                rows[:] = [r for r in rows if any(r.get(k) != new[k] for k in keys)]
                rows.append(dict(new))
            return None
        if method == "DELETE":
            self.tables[path] = [r for r in rows if not self._match(r, query)]
            return None
        raise AssertionError(method)


def daily_rows(shop, start, end, n_products, seed=1):
    df = generate(start=start, end=end, n_products=n_products, seed=seed)
    return [
        {"shop_id": shop, "product_id": f"{shop}-{r.sku}", "day": r.date, "quantity": float(r.quantity)}
        for r in df.itertuples()
    ]


@pytest.fixture
def db():
    long_rows = daily_rows("long", "2025-06-01", "2026-07-01", 4)  # includes today's partial day
    short_rows = daily_rows("short", "2026-06-10", "2026-06-30", 2)
    products = [{"id": pid, "shop_id": s, "active": "true"} for s, pid in {(r["shop_id"], r["product_id"]) for r in
                                                                          long_rows + short_rows}]
    products.append({"id": "long-NEVER", "shop_id": "long", "active": "true"})
    products[0]["active"] = "false"
    stale = {"shop_id": "long", "product_id": "long-OLD", "day": "2026-06-01", "quantity": 1, "generated_at": "2026"}
    return FakeSupabase(
        {
            "shops": [
                {"id": "long", "timezone": "Asia/Kolkata"},
                {"id": "short", "timezone": "Asia/Kolkata"},
                {"id": "empty", "timezone": "Asia/Kolkata"},
            ],
            "daily_sales": long_rows + short_rows,
            "products": products,
            "forecasts": [stale],
        }
    )


def test_nightly_writes_forecasts_per_shop(db):
    results = {r.shop_id: r for r in run(db, now=NOW)}
    inactive = next(p["id"] for p in db.tables["products"] if p["active"] == "false")

    long = results["long"]
    assert long.model in {"lightgbm", "sklearn"} and long.history_days > 300
    assert results["short"].model == "moving_average_28d" and results["short"].history_days == 21
    assert results["empty"].model == "none" and results["empty"].rows_written == 0

    rows = pd.DataFrame(db.tables["forecasts"])
    assert set(rows["shop_id"]) == {"long", "short"}  # the stale row from an earlier run is gone
    assert rows["day"].min() == "2026-07-01" and rows["day"].max() == "2026-07-14"
    assert inactive not in set(rows["product_id"]) and "long-NEVER" not in set(rows["product_id"])
    assert (rows.groupby("product_id").size() == HORIZON).all()
    assert (rows["quantity"] >= 0).all()

    runs = {r["shop_id"]: r for r in db.tables["forecast_runs"]}
    assert runs["long"]["first_day"] == "2026-07-01" and runs["empty"]["note"] == "no sales history yet"


def test_nightly_ignores_todays_partial_sales(db):
    run(db, now=NOW, dry_run=True)
    sales_queries = [q for m, p, q in db.calls if p == "daily_sales"]
    assert sales_queries and all(q["day"] == "lt.2026-07-01" for q in sales_queries)


def test_only_selected_shops(db):
    results = run(db, now=NOW, shop_ids=["short"])
    assert [r.shop_id for r in results] == ["short"]
    new = [r for r in db.tables["forecasts"] if r["generated_at"] != "2026"]  # skip the stale seed row
    assert new and {r["shop_id"] for r in new} == {"short"}
    assert any(r["product_id"] == "long-OLD" for r in db.tables["forecasts"])  # other shops untouched


def test_dry_run_writes_nothing(db):
    before = list(db.tables["forecasts"])
    run(db, now=NOW, dry_run=True)
    assert db.tables["forecasts"] == before
    assert not [c for c in db.calls if c[0] != "GET"]


def test_rerun_replaces_instead_of_duplicating(db):
    run(db, now=NOW)
    first = len(db.tables["forecasts"])
    run(db, now=NOW.replace(minute=30))
    assert len(db.tables["forecasts"]) == first


def test_moving_average_level():
    sales = pd.DataFrame({"day": ["2026-06-28", "2026-06-29", "2026-06-30"], "product_id": "p", "quantity": [3, 0, 6]})
    sales = sales[sales["quantity"] > 0]  # zero days are not stored in daily_sales
    fc, model, history = forecast_shop(sales, TODAY)
    assert model == "moving_average_28d" and history == 3
    assert fc["forecast"].tolist() == [3.0] * HORIZON  # (3 + 0 + 6) / 3
