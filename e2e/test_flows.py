"""End-to-end: the main flows on a running StockSense site, in order, with real browsers.

Owner: log in -> create shop -> import a year of sales -> receive stock -> sell -> count -> forecast -> reorder.
Staff: invited -> joins -> limited menu -> records a sale. Plus public pages, the demo button and sign-out.
Tests share state and must run in file order (pytest's default).
"""

from __future__ import annotations

import csv
import os
import re
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import Page, expect

from conftest import BASE_URL, login

REPO = Path(__file__).resolve().parents[1]
SAMPLE = REPO / "samples" / "sample-sales-1-year.csv"
state: dict = {}


def shifted_sample(out: Path) -> Path:
    """The sample CSV moved so its last day is yesterday (India time), like a shop importing fresh history.
    The 3 deliberately broken rows are kept as they are."""
    with SAMPLE.open(newline="") as f:
        rows = list(csv.reader(f))
    header, body = rows[0], rows[1:]

    def iso(s: str) -> date | None:
        try:
            return date.fromisoformat(s)
        except ValueError:
            return None

    last = max(d for r in body if (d := iso(r[0])))
    offset = datetime.now(ZoneInfo("Asia/Kolkata")).date() - timedelta(days=1) - last
    for r in body:
        if d := iso(r[0]):
            r[0] = (d + offset).isoformat()
    with out.open("w", newline="") as f:
        csv.writer(f).writerows([header, *body])
    return out


def nav(page: Page):
    return page.get_by_role("navigation", name="Dashboard")


def test_public_pages_and_protection(fresh_page: Page):
    page = fresh_page
    page.goto(f"{BASE_URL}/")
    expect(page.get_by_role("heading", level=1)).to_contain_text("Stop running out")
    expect(page.get_by_role("button", name="Try the live demo")).to_be_visible()

    page.goto(f"{BASE_URL}/dashboard")
    expect(page).to_have_url(re.compile(r"/login"))

    page.goto(f"{BASE_URL}/signup")
    page.get_by_label("Your name").fill("E2E")
    page.get_by_label("Email").fill("not-an-email")
    page.get_by_label("Password").fill("short")
    page.get_by_role("button", name="Create account").click()
    expect(page.get_by_text("Enter a valid email address.")).to_be_visible()
    expect(page.get_by_text("Password must be at least 8 characters.")).to_be_visible()


def test_demo_button_opens_demo_shop(fresh_page: Page):
    page = fresh_page
    page.goto(f"{BASE_URL}/login")
    page.get_by_role("button", name="Try the live demo").click()
    expect(page).to_have_url(re.compile(r"/dashboard$"))
    expect(page.get_by_role("note")).to_contain_text("public demo")
    expect(page.get_by_role("heading", name="Overview")).to_be_visible()


def test_owner_creates_shop(owner_page: Page, users, supa, run_id):
    page = owner_page
    login(page, users["owner"])
    expect(page.get_by_role("heading", name="Set up your shop")).to_be_visible()
    page.get_by_label("Shop name").fill(f"E2E Shop {run_id}")
    page.get_by_role("button", name="Create shop").click()
    expect(nav(page).get_by_role("link", name="Import")).to_be_visible()
    expect(page.get_by_role("note")).to_have_count(0)  # no demo banner for normal accounts

    shops = supa.select("shops", created_by=f"eq.{users['owner'].id}", select="id,name")
    assert [s["name"] for s in shops] == [f"E2E Shop {run_id}"]
    state["shop"] = shops[0]["id"]


def test_owner_imports_a_year_of_sales(owner_page: Page, supa, tmp_path):
    assert "shop" in state, "needs test_owner_creates_shop"
    page = owner_page
    page.goto(f"{BASE_URL}/dashboard/import")
    page.get_by_label("Sales file (.csv, up to 50,000 rows)").set_input_files(shifted_sample(tmp_path / "sales.csv"))
    expect(page.get_by_text(re.compile(r"3 with problems"))).to_be_visible()
    page.get_by_role("button", name="Import 10,896 rows").click()
    expect(page.get_by_text(re.compile(r"Imported 10,896 sales in"))).to_be_visible(timeout=180_000)
    expect(page.get_by_text("Created 30 new products.", exact=False)).to_be_visible()
    expect(page.get_by_text("3 rows skipped:")).to_be_visible()

    assert supa.count("sales", shop_id=f"eq.{state['shop']}") == 10_896
    products = supa.select("products", shop_id=f"eq.{state['shop']}", select="id,name")
    state["pid"] = {p["name"]: p["id"] for p in products}
    assert len(state["pid"]) == 30

    page.goto(f"{BASE_URL}/dashboard/products")
    expect(page.get_by_role("row").filter(has_text="Sugar 1kg")).to_have_count(1)


def test_stock_in_and_sale_update_stock(owner_page: Page, supa):
    page, sugar = owner_page, state["pid"]["Sugar 1kg"]

    page.goto(f"{BASE_URL}/dashboard/stock")
    page.get_by_label("Product", exact=True).select_option(sugar)
    page.get_by_label("What happened?").select_option("purchase")
    page.get_by_label("Quantity").fill("50")
    page.get_by_role("button", name="Update stock").click()
    expect(page.get_by_text("Stock updated.")).to_be_visible()

    page.goto(f"{BASE_URL}/dashboard/sales")
    page.get_by_label("Product", exact=True).select_option(sugar)
    page.get_by_label("Quantity").fill("2")
    page.get_by_role("button", name="Record sale").click()
    expect(page.get_by_text("Sale recorded.")).to_be_visible()

    assert supa.on_hand(sugar) == 48


def test_stock_count_saves_the_difference(owner_page: Page, supa):
    page, salt = owner_page, state["pid"]["Tata Salt 1kg"]
    page.goto(f"{BASE_URL}/dashboard/stock/count")
    page.get_by_label("Tata Salt 1kg", exact=True).fill("20")
    page.get_by_role("button", name="Save counts").click()
    expect(page.get_by_text(re.compile(r"Saved\. Stock updated for 1 product"))).to_be_visible()
    assert supa.on_hand(salt) == 20


def test_forecast_drives_the_reorder_list(owner_page: Page, supa):
    shop = state["shop"]
    subprocess.run(  # noqa: S603 (fixed command, our own module)
        [sys.executable, "-m", "stocksense_ml", "nightly", "--engine", os.environ.get("E2E_ENGINE", "auto"),
         "--shop", shop],
        cwd=REPO / "ml",
        check=True,
        timeout=600,
    )
    runs = supa.select("forecast_runs", shop_id=f"eq.{shop}", select="model,products")
    assert runs and runs[0]["model"] in {"lightgbm", "sklearn"} and runs[0]["products"] == 30

    page = owner_page
    page.goto(f"{BASE_URL}/dashboard/reorder")
    expect(page.get_by_text("using the trained model", exact=False)).to_be_visible()
    expect(page.get_by_text("No forecast yet")).to_have_count(0)
    # 48 bags against ~40 a day and a 7-day lead time: must reorder now
    expect(page.get_by_role("row").filter(has_text="Sugar 1kg")).to_contain_text("Order now")

    page.goto(f"{BASE_URL}/dashboard")
    expect(page.get_by_role("link", name="Full reorder list")).to_be_visible()


def test_staff_joins_with_limited_access(owner_page: Page, staff_page: Page, users, supa):
    staff = users["staff"]
    owner_page.goto(f"{BASE_URL}/dashboard/team")
    owner_page.get_by_label("Staff email").fill(staff.email)
    owner_page.get_by_role("button", name="Invite staff").click()
    expect(owner_page.get_by_text(f"Invite created for {staff.email}.")).to_be_visible()

    page = staff_page
    login(page, staff)
    page.get_by_role("button", name="Join shop").click()
    expect(nav(page).get_by_role("link", name="Reorder")).to_be_visible()
    expect(nav(page).get_by_role("link", name="Import")).to_have_count(0)
    expect(nav(page).get_by_role("link", name="Team")).to_have_count(0)

    page.goto(f"{BASE_URL}/dashboard/import")  # owner-only page sends staff back
    expect(page).to_have_url(re.compile(r"/dashboard$"))

    sugar = state["pid"]["Sugar 1kg"]
    page.goto(f"{BASE_URL}/dashboard/sales")
    page.get_by_label("Product", exact=True).select_option(sugar)
    page.get_by_label("Quantity").fill("1")
    page.get_by_role("button", name="Record sale").click()
    expect(page.get_by_text("Sale recorded.")).to_be_visible()
    assert supa.on_hand(sugar) == 47


def test_sign_out_ends_the_session(owner_page: Page):
    page = owner_page
    page.goto(f"{BASE_URL}/dashboard")
    page.get_by_role("button", name="Sign out").click()
    expect(page).to_have_url(f"{BASE_URL}/")
    page.goto(f"{BASE_URL}/dashboard")
    expect(page).to_have_url(re.compile(r"/login"))

