"""Resets the public demo account: same password, one fresh shop, a year of sample history ending yesterday.

Runs in the nightly workflow just before forecasting, so the demo shop always has current data
and fresh forecasts, and anything visitors changed during the day is undone.

    SUPABASE_URL=... SUPABASE_SECRET_KEY=... python -m stocksense_ml demo-reset [--dry-run]

Steps:
1. Auth admin API: find the demo user (``app_metadata.demo = true``, else by email); create it or
   reset its email, password and name. ``app_metadata`` can only be set with the secret key, which is
   what ``demo_prepare()`` checks, so the job can never reset a real account.
2. ``demo_prepare()`` (SQL, service_role only): delete the demo account's shops, create an empty one.
3. Insert the 30 sample products, the sample sales shifted to end yesterday (shop time), and opening
   stock chosen so the Reorder page shows a realistic mix of "Order now", "Order soon" and "Enough stock".
"""

from __future__ import annotations

import csv
import json
import logging
import math
import os
import urllib.error
import urllib.request
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[2]
ACCOUNT_FILE = REPO / "apps" / "web" / "src" / "lib" / "demo-account.json"
SAMPLE_FILE = REPO / "samples" / "sample-sales-1-year.csv"
SHOP_TZ = ZoneInfo("Asia/Kolkata")
BATCH = 1000
log = logging.getLogger("stocksense.demo")

# (method, path under the project URL, body, extra headers) -> parsed JSON (or None)
Http = Callable[[str, str, object | None, dict[str, str]], object]

# Supplier lead times (days): fresh dairy comes daily, staples weekly.
LEAD_TIME = {"MILK500": 1, "CURD400": 1, "BUTTER100": 2}
DEFAULT_LEAD = 5
# Days of stock on hand, cycled across products (sorted by SKU) for a believable mix of statuses.
COVER_DAYS = [3, 25, 9, 40, 14, 6, 30, 11, 60, 18]


def http_transport(url: str, key: str, timeout: float = 60) -> Http:
    base = url.rstrip("/") + "/"
    if not base.startswith("https://"):
        raise ValueError("SUPABASE_URL must be an https:// URL")
    headers = {"apikey": key, "Content-Type": "application/json"}
    if key.count(".") == 2:  # legacy service_role JWT also goes in Authorization
        headers["Authorization"] = f"Bearer {key}"

    def call(method: str, path: str, body: object | None, extra: dict[str, str]) -> object:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(  # noqa: S310 (https enforced above)
            base + path, data=data, headers={**headers, **extra}, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
                raw = resp.read()
        except urllib.error.HTTPError as e:  # surface Supabase's message, never the key
            detail = e.read().decode(errors="replace")[:500]
            raise RuntimeError(f"{method} {path.split('?')[0]} failed: HTTP {e.code} {detail}") from None
        return json.loads(raw) if raw else None

    return call


@dataclass(frozen=True)
class Account:
    email: str
    password: str
    shop_name: str
    full_name: str


def load_account(path: Path = ACCOUNT_FILE) -> Account:
    raw = json.loads(path.read_text())
    return Account(raw["email"].lower(), raw["password"], raw["shopName"], raw["fullName"])


def load_sample(path: Path = SAMPLE_FILE) -> list[dict]:
    """Valid rows of the sample CSV as dicts: day (date), sku, name, quantity, price."""
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            try:
                day = date.fromisoformat(r["date"])
                qty = float(r["quantity"])
            except ValueError:
                continue
            if qty <= 0 or not (r.get("product") or "").strip():
                continue
            price = float(r["price"]) if r.get("price") else None
            rows.append({"day": day, "sku": r["sku"].strip() or None, "name": r["product"].strip(),
                         "quantity": qty, "price": price})
    return rows


def shift_days(rows: list[dict], last_day: date) -> list[dict]:
    """Moves all rows by the same number of days so the newest one lands on ``last_day``."""
    offset = last_day - max(r["day"] for r in rows)
    return [{**r, "day": r["day"] + offset} for r in rows]


def plan_products(rows: list[dict]) -> list[dict]:
    """One entry per product: price, lead time, reorder point and opening stock."""
    last = max(r["day"] for r in rows)
    recent = defaultdict(float)
    info: dict[str, dict] = {}
    for r in rows:
        key = r["sku"] or r["name"]
        info[key] = {"sku": r["sku"], "name": r["name"], "price": r["price"]}  # latest price wins (rows are dated)
        if r["day"] > last - timedelta(days=28):
            recent[key] += r["quantity"]
    plan = []
    for i, key in enumerate(sorted(info)):
        daily = recent[key] / 28
        lead = LEAD_TIME.get(info[key]["sku"] or "", DEFAULT_LEAD)
        plan.append({
            **info[key],
            "lead_time_days": lead,
            "reorder_point": math.ceil(daily),  # about one day of safety stock
            "opening": max(1, math.ceil(daily * COVER_DAYS[i % len(COVER_DAYS)])),
        })
    return plan


def find_or_reset_user(http: Http, account: Account) -> str:
    users = http("GET", "auth/v1/admin/users?per_page=1000&page=1", None, {})
    users = users.get("users", []) if isinstance(users, dict) else []
    match = [u for u in users if (u.get("app_metadata") or {}).get("demo") is True] or [
        u for u in users if (u.get("email") or "").lower() == account.email
    ]
    attrs = {
        "email": account.email,
        "password": account.password,
        "email_confirm": True,
        "user_metadata": {"full_name": account.full_name},
        "app_metadata": {"demo": True},
    }
    if match:
        uid = match[0]["id"]
        http("PUT", f"auth/v1/admin/users/{uid}", attrs, {})
        log.info("demo user reset: %s", uid)
        return uid
    created = http("POST", "auth/v1/admin/users", attrs, {})
    if not isinstance(created, dict) or "id" not in created:
        raise RuntimeError("Could not create the demo user")
    log.info("demo user created: %s", created["id"])
    return created["id"]


def run(http: Http, account: Account, sample: list[dict], now: datetime | None = None,
        dry_run: bool = False) -> dict:
    now = now or datetime.now(UTC)
    yesterday = now.astimezone(SHOP_TZ).date() - timedelta(days=1)
    rows = shift_days(sample, yesterday)
    plan = plan_products(rows)
    summary = {"products": len(plan), "sales": len(rows), "first_day": min(r["day"] for r in rows).isoformat(),
               "last_day": yesterday.isoformat()}
    if dry_run:
        log.info("dry run: %s", summary)
        return summary

    uid = find_or_reset_user(http, account)
    shop = http("POST", "rest/v1/rpc/demo_prepare", {"p_user": uid, "p_shop_name": account.shop_name}, {})
    if not isinstance(shop, str):
        raise RuntimeError("demo_prepare did not return a shop id")

    created = http(
        "POST", "rest/v1/products?select=id,sku,name",
        [{"shop_id": shop, "sku": p["sku"], "name": p["name"], "price": p["price"],
          "reorder_point": p["reorder_point"], "lead_time_days": p["lead_time_days"]} for p in plan],
        {"Prefer": "return=representation"},
    )
    ids = {(p["sku"] or p["name"]): p["id"] for p in created or []}
    if len(ids) != len(plan):
        raise RuntimeError(f"Expected {len(plan)} products, got {len(ids)}")

    sales = [{"shop_id": shop, "product_id": ids[r["sku"] or r["name"]], "quantity": r["quantity"],
              "unit_price": r["price"], "sold_at": f"{r['day'].isoformat()}T12:00:00+05:30", "source": "import"}
             for r in rows]
    for i in range(0, len(sales), BATCH):
        http("POST", "rest/v1/sales", sales[i : i + BATCH], {"Prefer": "return=minimal"})

    opened = (now - timedelta(minutes=5)).isoformat()
    http("POST", "rest/v1/stock_movements",
         [{"shop_id": shop, "product_id": ids[p["sku"] or p["name"]], "quantity": p["opening"],
           "reason": "opening", "note": "Demo opening stock", "occurred_at": opened} for p in plan],
         {"Prefer": "return=minimal"})
    summary["shop_id"] = shop
    log.info("demo shop ready: %s", summary)
    return summary


def main(dry_run: bool = False) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SECRET_KEY", "")
    if not dry_run and (not url or not key):
        log.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY")
        return 2
    http: Http = http_transport(url, key) if not dry_run else (lambda *_: None)
    run(http, load_account(), load_sample(), dry_run=dry_run)
    return 0
