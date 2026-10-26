"""Verification of Supabase Auth access tokens (JWTs).

Supports both Supabase signing modes:
- asymmetric signing keys (ES256 / RS256), verified against the project's JWKS
- the legacy shared secret (HS256), when SUPABASE_JWT_SECRET is set
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import jwt

ASYMMETRIC_ALGORITHMS = frozenset({"ES256", "RS256"})
REQUIRED_CLAIMS = ["exp", "iat", "sub"]


class InvalidToken(Exception):
    """Raised for any token that must not be trusted. The message is safe to log."""


class SigningKeySource(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> Any: ...


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    role: str | None


class TokenVerifier:
    def __init__(
        self,
        *,
        issuer: str,
        audience: str = "authenticated",
        jwk_source: SigningKeySource | None = None,
        hs256_secret: str | None = None,
        leeway_seconds: int = 10,
    ) -> None:
        if not issuer:
            raise ValueError("issuer is required")
        self._issuer = issuer
        self._audience = audience
        self._jwk_source = jwk_source
        self._hs256_secret = hs256_secret or None
        self._leeway = leeway_seconds

    def verify(self, token: str) -> AuthUser:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise InvalidToken("malformed token") from exc

        alg = header.get("alg")
        if alg in ASYMMETRIC_ALGORITHMS:
            if self._jwk_source is None:
                raise InvalidToken("asymmetric tokens are not configured")
            try:
                key = self._jwk_source.get_signing_key_from_jwt(token).key
            except jwt.PyJWTError as exc:
                raise InvalidToken("signing key not found") from exc
        elif alg == "HS256":
            if self._hs256_secret is None:
                raise InvalidToken("HS256 tokens are not accepted")
            key = self._hs256_secret
        else:
            # Rejects "none" and anything unexpected; prevents algorithm-confusion attacks.
            raise InvalidToken("unsupported algorithm")

        try:
            claims = jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience=self._audience,
                issuer=self._issuer,
                leeway=self._leeway,
                options={"require": REQUIRED_CLAIMS},
            )
        except jwt.ExpiredSignatureError as exc:
            raise InvalidToken("token expired") from exc
        except jwt.PyJWTError as exc:
            raise InvalidToken("token rejected") from exc

        return AuthUser(id=str(claims["sub"]), email=claims.get("email"), role=claims.get("role"))
