"""Fixtures for the end-to-end tests: settings, throwaway users, one browser page per user."""

from __future__ import annotations

import os
import re
import secrets
import time

import pytest
from playwright.sync_api import Browser, Page, expect, sync_playwright

from supa import Supabase, User

BASE_URL = os.environ.get("E2E_BASE_URL", "https://stocksense-phi-tan.vercel.app").rstrip("/")
expect.set_options(timeout=20_000)


@pytest.fixture(scope="session")
def supa() -> Supabase:
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SECRET_KEY", "")
    if not url or not key:
        pytest.exit("Set SUPABASE_URL and SUPABASE_SECRET_KEY (see e2e/README.md)", returncode=2)
    return Supabase(url, key)


@pytest.fixture(scope="session")
def run_id() -> str:
    return f"{time.strftime('%m%d%H%M')}{secrets.token_hex(2)}"


@pytest.fixture(scope="session")
def users(supa: Supabase, run_id: str):
    supa.sweep()  # leftovers from an earlier run that crashed before cleaning up
    made = {
        "owner": supa.create_user(f"e2e-owner-{run_id}@example.com", "E2E Owner"),
        "staff": supa.create_user(f"e2e-staff-{run_id}@example.com", "E2E Staff"),
    }
    yield made
    supa.sweep()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


def _page(browser: Browser) -> Page:
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 900}, locale="en-IN", timezone_id="Asia/Kolkata"
    )
    page = ctx.new_page()
    page.set_default_timeout(30_000)
    return page


@pytest.fixture(scope="session")
def owner_page(browser: Browser):
    page = _page(browser)
    yield page
    page.context.close()


@pytest.fixture(scope="session")
def staff_page(browser: Browser):
    page = _page(browser)
    yield page
    page.context.close()


@pytest.fixture
def fresh_page(browser: Browser):
    page = _page(browser)
    yield page
    page.context.close()


def login(page: Page, user: User) -> None:
    page.goto(f"{BASE_URL}/login")
    page.get_by_label("Email").fill(user.email)
    page.get_by_label("Password").fill(user.password)
    page.get_by_role("button", name="Log in", exact=True).click()
    expect(page).to_have_url(re.compile(r"/dashboard$"))
