"""Helpers that mint test tokens the same way Supabase does, with local keys."""

from __future__ import annotations

import time
from types import SimpleNamespace
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

ISSUER = "https://test-project.supabase.co/auth/v1"
HS_SECRET = "test-legacy-secret-at-least-32-characters-long"

_private_key = ec.generate_private_key(ec.SECP256R1())
_other_private_key = ec.generate_private_key(ec.SECP256R1())


class StaticJwkSource:
    """Stands in for PyJWKClient: returns our test public key."""

    def get_signing_key_from_jwt(self, token: str) -> Any:
        if jwt.get_unverified_header(token).get("kid") != "test-kid":
            raise jwt.PyJWKClientError("unknown kid")
        return SimpleNamespace(key=_private_key.public_key())


def claims(**overrides: Any) -> dict[str, Any]:
    now = int(time.time())
    base = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "email": "owner@example.com",
        "role": "authenticated",
        "aud": "authenticated",
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
    }
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not None}


def es256(payload: dict[str, Any], *, wrong_key: bool = False, kid: str = "test-kid") -> str:
    key = _other_private_key if wrong_key else _private_key
    return jwt.encode(payload, key, algorithm="ES256", headers={"kid": kid})


def hs256(payload: dict[str, Any], secret: str = HS_SECRET) -> str:
    return jwt.encode(payload, secret, algorithm="HS256")
