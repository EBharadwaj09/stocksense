"""Accessibility and phone layout, on every page, at desktop and phone size.

- axe-core (WCAG 2.0/2.1/2.2 A and AA rules) must find no serious or critical problems.
- On a 390 px wide phone, no page may scroll sideways.
- Keyboard: the first Tab reaches "Skip to content", which jumps past the header to the form.

Dashboard pages are checked as the demo owner (read-only here), so every owner page is covered.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from playwright.sync_api import Browser, Page, expect

from conftest import BASE_URL

AXE = Path(__file__).resolve().parent / "node_modules" / "axe-core" / "axe.min.js"
PUBLIC = ["/", "/login", "/signup", "/forgot-password"]
DASHBOARD = [
    "/dashboard",
    "/dashboard/sales",
    "/dashboard/stock",
    "/dashboard/stock/count",
    "/dashboard/reorder",
    "/dashboard/products",
    "/dashboard/products/new",
    "/dashboard/import",
    "/dashboard/team",
]
SIZES = {
    "desktop": {"viewport": {"width": 1280, "height": 900}},
    "phone": {
        "viewport": {"width": 390, "height": 844},
        "is_mobile": True,
        "has_touch": True,
        "device_scale_factor": 2,
    },
}
RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
AXE_RUN = """async (tags) => {
  const r = await axe.run(document, { runOnly: { type: "tag", values: tags } });
  return r.violations.map(v => ({
    id: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
    where: v.nodes.slice(0, 3).map(n => n.target.join(" ")),
  }));
}"""


def audit(page: Page, path: str) -> tuple[list[dict], int]:
    page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    page.add_script_tag(path=str(AXE))
    violations = page.evaluate(AXE_RUN, RULES)
    overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    return violations, overflow


@pytest.mark.parametrize("size", list(SIZES))
def test_pages_are_accessible_and_fit(browser: Browser, size: str):
    if not AXE.exists():
        pytest.fail(f"axe-core missing: npm install --no-save --prefix e2e axe-core (looked for {AXE})")
    ctx = browser.new_context(**SIZES[size], locale="en-IN", timezone_id="Asia/Kolkata")
    page = ctx.new_page()
    page.set_default_timeout(30_000)
    problems: list[str] = []
    try:
        results = {p: audit(page, p) for p in PUBLIC}
        page.goto(f"{BASE_URL}/login")
        page.get_by_role("button", name="Try the live demo").click()
        expect(page).to_have_url(re.compile(r"/dashboard$"))
        results |= {p: audit(page, p) for p in DASHBOARD}
    finally:
        ctx.close()

    for path, (violations, overflow) in results.items():
        for v in violations:
            where = "; ".join(v["where"])
            line = f"[a11y] {size} {path}: {v['impact']} {v['id']} x{v['count']} - {v['help']} @ {where}"
            print(line)
            if v["impact"] in {"serious", "critical"}:
                problems.append(line)
        if size == "phone" and overflow > 1:
            line = f"[a11y] {size} {path}: page scrolls sideways by {overflow}px"
            print(line)
            problems.append(line)
    print(f"[a11y] {size}: {len(results)} pages checked, {len(problems)} blocking problems")
    assert not problems, "\n".join(problems)


def test_skip_link_reaches_the_form(fresh_page: Page):
    page = fresh_page
    page.goto(f"{BASE_URL}/login")
    page.keyboard.press("Tab")
    expect(page.get_by_role("link", name="Skip to content")).to_be_focused()
    page.keyboard.press("Enter")
    page.keyboard.press("Tab")
    expect(page.get_by_label("Email")).to_be_focused()
