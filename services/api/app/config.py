"""Settings read from environment variables (see services/api/.env.example)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _split(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    environment: str = "development"
    supabase_url: str = ""
    # Only for projects still on the legacy shared JWT secret (HS256).
    supabase_jwt_secret: str = ""
    allowed_origins: list[str] = field(default_factory=list)

    @property
    def issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings(
        environment=os.getenv("ENVIRONMENT", "development"),
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_jwt_secret=os.getenv("SUPABASE_JWT_SECRET", ""),
        allowed_origins=_split(os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")),
    )
