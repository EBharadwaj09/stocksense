import pytest
from fastapi.testclient import TestClient

from app.auth import TokenVerifier
from app.deps import get_verifier
from app.main import app
from tests.tokens import ISSUER, StaticJwkSource, claims, es256


@pytest.fixture
def client():
    verifier = TokenVerifier(issuer=ISSUER, jwk_source=StaticJwkSource())
    app.dependency_overrides[get_verifier] = lambda: verifier
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.headers["X-Request-ID"]


def test_request_id_is_echoed(client):
    res = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert res.headers["X-Request-ID"] == "abc123"


def test_me_requires_token(client):
    res = client.get("/me")
    assert res.status_code == 401
    assert res.headers["WWW-Authenticate"] == "Bearer"


def test_me_rejects_bad_token(client):
    res = client.get("/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401
    assert "not-a-jwt" not in res.text


def test_me_returns_user_for_valid_token(client):
    res = client.get("/me", headers={"Authorization": f"Bearer {es256(claims())}"})
    assert res.status_code == 200
    assert res.json() == {"id": "11111111-2222-3333-4444-555555555555", "email": "owner@example.com"}


def test_unhandled_errors_return_safe_500(client):
    def boom():
        raise RuntimeError("secret internal detail")

    app.add_api_route("/__test_boom", boom)
    try:
        res = client.get("/__test_boom")
    finally:
        app.router.routes = [r for r in app.router.routes if getattr(r, "path", "") != "/__test_boom"]
    assert res.status_code == 500
    assert "secret internal detail" not in res.text
    assert res.json()["request_id"] == res.headers["X-Request-ID"]
