"""Tiny Supabase admin client for the end-to-end tests (secret key: bypasses row-level security).

Creates throwaway users flagged ``app_metadata.e2e = true`` and deletes them, and everything they
created, afterwards. Only flagged users are ever deleted.
"""

from __future__ import annotations

import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: str
    email: str
    password: str


class Supabase:
    def __init__(self, url: str, key: str, timeout: float = 60):
        if not url.startswith("https://"):
            raise ValueError("SUPABASE_URL must be an https:// URL")
        self.base = url.rstrip("/") + "/"
        self.headers = {"apikey": key, "Content-Type": "application/json"}
        if key.count(".") == 2:  # legacy service_role JWT
            self.headers["Authorization"] = f"Bearer {key}"
        self.timeout = timeout

    def call(self, method: str, path: str, body: object | None = None, headers: dict | None = None):
        req = urllib.request.Request(  # noqa: S310 (https enforced above)
            self.base + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={**self.headers, **(headers or {})},
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310
                raw, rng = resp.read(), resp.headers.get("Content-Range")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path.split('?')[0]}: HTTP {e.code} {e.read().decode()[:300]}") from None
        return (json.loads(raw) if raw else None), rng

    # --- REST ---
    def select(self, table: str, **query: str) -> list[dict]:
        rows, _ = self.call("GET", f"rest/v1/{table}?{urllib.parse.urlencode(query)}")
        return rows

    def count(self, table: str, **query: str) -> int:
        _, rng = self.call(
            "GET",
            f"rest/v1/{table}?{urllib.parse.urlencode({'select': 'shop_id', **query})}",
            headers={"Prefer": "count=exact", "Range": "0-0"},
        )
        return int(rng.split("/")[-1])

    def delete(self, table: str, **query: str) -> None:
        self.call("DELETE", f"rest/v1/{table}?{urllib.parse.urlencode(query)}")

    def on_hand(self, product_id: str) -> float:
        rows = self.select("product_stock", product_id=f"eq.{product_id}", select="on_hand")
        return float(rows[0]["on_hand"])

    # --- Auth admin ---
    def create_user(self, email: str, name: str) -> User:
        password = f"E2e-{secrets.token_hex(8)}-1"
        created, _ = self.call(
            "POST",
            "auth/v1/admin/users",
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": name},
                "app_metadata": {"e2e": True},
            },
        )
        return User(created["id"], email, password)

    def e2e_users(self) -> list[dict]:
        data, _ = self.call("GET", "auth/v1/admin/users?per_page=1000&page=1")
        return [u for u in data.get("users", []) if (u.get("app_metadata") or {}).get("e2e") is True]

    def sweep(self) -> int:
        """Deletes every e2e-flagged user and the shops they created. Returns how many users were removed."""
        users = self.e2e_users()
        for u in users:
            for shop in self.select("shops", created_by=f"eq.{u['id']}", select="id"):
                sid = f"eq.{shop['id']}"
                # children first: sales -> products is ON DELETE RESTRICT
                for table in ("stock_movements", "sales", "forecasts", "products"):
                    self.delete(table, shop_id=sid)
                self.delete("shops", id=sid)  # cascades members, invites, forecast_runs
        for u in users:
            self.call("DELETE", f"auth/v1/admin/users/{u['id']}")
        return len(users)
