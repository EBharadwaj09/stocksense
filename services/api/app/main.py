"""StockSense API: forecasting and data services for the web app."""

from __future__ import annotations

import time
import uuid

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.auth import AuthUser
from app.config import get_settings
from app.deps import current_user
from app.log import configure_logging, logger, request_id_var

configure_logging()
settings = get_settings()

app = FastAPI(
    title="StockSense API",
    version=__version__,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    incoming = request.headers.get("x-request-id", "")
    request_id = incoming if 0 < len(incoming) <= 64 else uuid.uuid4().hex
    token = request_id_var.set(request_id)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request.unhandled_error", extra={"path": request.url.path})
        response = JSONResponse(
            status_code=500,
            content={"detail": "Something went wrong. Please try again.", "request_id": request_id},
        )
    duration_ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request.completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    request_id_var.reset(token)
    return response


@app.get("/health", tags=["ops"])
def health() -> dict[str, str]:
    """Liveness check used by Render and uptime monitors."""
    return {"status": "ok", "version": __version__}


@app.get("/me", tags=["auth"])
def me(user: AuthUser = Depends(current_user)) -> dict[str, str | None]:
    """Returns the signed-in user, proving the web app's session works against the API."""
    return {"id": user.id, "email": user.email}
