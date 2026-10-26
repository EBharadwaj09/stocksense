"""FastAPI dependencies. Tests override `get_verifier` with a local key."""

from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import AuthUser, InvalidToken, TokenVerifier
from app.config import get_settings
from app.log import logger

_bearer = HTTPBearer(auto_error=False)


@lru_cache
def get_verifier() -> TokenVerifier:
    settings = get_settings()
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not set")
    return TokenVerifier(
        issuer=settings.issuer,
        jwk_source=jwt.PyJWKClient(settings.jwks_url, cache_keys=True, lifespan=3600),
        hs256_secret=settings.supabase_jwt_secret or None,
    )


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not signed in or session expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    verifier: TokenVerifier = Depends(get_verifier),
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    try:
        return verifier.verify(credentials.credentials)
    except InvalidToken as exc:
        logger.info("auth.token_rejected", extra={"reason": str(exc)})
        raise _unauthorized() from exc
