"""Demo reset with a fake Supabase: nothing leaves the machine."""

from datetime import UTC, date, datetime

import pytest

from stocksense_ml import demo

NOW = datetime(2026, 10, 26, 20, 41, tzinfo=UTC)  # 02:11 IST on the 27th
ACCOUNT = demo.Account("demo@example.com", "demo-pass-1", "Demo Kirana Store", "Demo Owner")


class FakeSupabase:
    def __init__(self, users=None):
        self.users = users or []
        self.calls: list[tuple[str, str, object]] = []
        self.inserted: dict[str, list] = {"sales": [], "stock_movements": []}

    def __call__(self, method, path, body, extra):
        self.calls.append((method, path, body))
        route = path.split("?")[0]
        if route == "auth/v1/admin/users" and method == "GET":
            return {"users": self.users}
        if route == "auth/v1/admin/users" and method == "POST":
            return {"id": "new-user", **body}
        if route.startswith("auth/v1/admin/users/") and method == "PUT":
            return {"id": route.rsplit("/", 1)[1], **body}
        if route == "rest/v1/rpc/demo_prepare":
            return "shop-1"
        if route == "rest/v1/products":
            assert extra.get("Prefer") == "return=representation"
            return [{"id": f"p{i}", "sku": p["sku"], "name": p["name"]} for i, p in enumerate(body)]
        if route in ("rest/v1/sales", "rest/v1/stock_movements"):
            self.inserted[route.rsplit("/", 1)[1]].extend(body)
            return None
        raise AssertionError(f"unexpected call {method} {path}")


@pytest.fixture(scope="module")
def sample():
    return demo.load_sample()


def test_sample_skips_invalid_rows(sample):
    assert len(sample) == 10_896  # the 3 deliberately broken rows are left out
    assert all(r["quantity"] > 0 and r["name"] for r in sample)


def test_history_ends_yesterday_in_shop_time(sample):
    fake = FakeSupabase()
    summary = demo.run(fake, ACCOUNT, sample, now=NOW)
    assert summary["last_day"] == "2026-10-26"  # IST date is the 27th, so yesterday is the 26th
    days = {s["sold_at"][:10] for s in fake.inserted["sales"]}
    assert max(days) == "2026-10-26"
    assert len(fake.inserted["sales"]) == 10_896
    assert all(s["shop_id"] == "shop-1" and s["source"] == "import" for s in fake.inserted["sales"])


def test_sales_sent_in_batches(sample):
    fake = FakeSupabase()
    demo.run(fake, ACCOUNT, sample, now=NOW)
    batches = [b for m, p, b in fake.calls if p == "rest/v1/sales"]
    assert len(batches) == 11 and max(len(b) for b in batches) == demo.BATCH


def test_creates_user_with_demo_flag_when_missing(sample):
    fake = FakeSupabase(users=[{"id": "owner", "email": "real@shop.in", "app_metadata": {}}])
    demo.run(fake, ACCOUNT, sample, now=NOW)
    created = [b for m, p, b in fake.calls if m == "POST" and p == "auth/v1/admin/users"]
    assert created and created[0]["app_metadata"] == {"demo": True} and created[0]["email_confirm"] is True
    assert not any(m == "PUT" for m, p, b in fake.calls)  # the real owner is never touched
    prepare = [b for m, p, b in fake.calls if p == "rest/v1/rpc/demo_prepare"]
    assert prepare == [{"p_user": "new-user", "p_shop_name": "Demo Kirana Store"}]


def test_resets_flagged_user_even_if_email_was_changed(sample):
    fake = FakeSupabase(users=[
        {"id": "owner", "email": "real@shop.in", "app_metadata": {}},
        {"id": "demo-1", "email": "hijacked@evil.test", "app_metadata": {"demo": True}},
    ])
    demo.run(fake, ACCOUNT, sample, now=NOW)
    puts = [(p, b) for m, p, b in fake.calls if m == "PUT"]
    assert puts == [("auth/v1/admin/users/demo-1", puts[0][1])]
    assert puts[0][1]["email"] == "demo@example.com" and puts[0][1]["password"] == "demo-pass-1"  # noqa: S105


def test_stock_mix_gives_every_reorder_status(sample):
    plan = demo.plan_products(demo.shift_days(sample, date(2026, 10, 26)))
    assert len(plan) == 30

    def status(p):  # the web app's rule (apps/web/src/lib/reorder.ts), with demand = recent daily average
        daily = p["reorder_point"]  # reorder point is ceil(daily average)
        if p["opening"] <= daily * p["lead_time_days"] + p["reorder_point"]:
            return "now"
        if p["opening"] <= daily * (p["lead_time_days"] + 7) + p["reorder_point"]:
            return "soon"
        return "enough"

    counts = {s: sum(status(p) == s for p in plan) for s in ("now", "soon", "enough")}
    assert all(c >= 3 for c in counts.values()), counts


def test_dry_run_calls_nothing(sample):
    fake = FakeSupabase()
    summary = demo.run(fake, ACCOUNT, sample, now=NOW, dry_run=True)
    assert fake.calls == [] and summary["sales"] == 10_896


def test_account_file_matches_web_app():
    account = demo.load_account()
    assert account.email == account.email.lower() and "@" in account.email
    assert len(account.password) >= 8
