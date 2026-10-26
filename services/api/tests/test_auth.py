import time

import jwt
import pytest

from app.auth import InvalidToken, TokenVerifier
from tests.tokens import HS_SECRET, ISSUER, StaticJwkSource, claims, es256, hs256

OTHER_SECRET = "a-different-secret-that-is-also-long-enough"


@pytest.fixture
def verifier() -> TokenVerifier:
    return TokenVerifier(issuer=ISSUER, jwk_source=StaticJwkSource(), hs256_secret=HS_SECRET)


def test_accepts_valid_es256_token(verifier):
    user = verifier.verify(es256(claims()))
    assert user.id == "11111111-2222-3333-4444-555555555555"
    assert user.email == "owner@example.com"


def test_accepts_valid_legacy_hs256_token(verifier):
    assert verifier.verify(hs256(claims())).email == "owner@example.com"


@pytest.mark.parametrize(
    "token_factory",
    [
        pytest.param(lambda: es256(claims(exp=int(time.time()) - 3600)), id="expired"),
        pytest.param(lambda: es256(claims(aud="anon")), id="wrong-audience"),
        pytest.param(lambda: es256(claims(iss="https://evil.example/auth/v1")), id="wrong-issuer"),
        pytest.param(lambda: es256(claims(sub=None)), id="missing-sub"),
        pytest.param(lambda: es256(claims(), wrong_key=True), id="forged-signature"),
        pytest.param(lambda: es256(claims(), kid="unknown"), id="unknown-key-id"),
        pytest.param(lambda: hs256(claims(), secret=OTHER_SECRET), id="wrong-secret"),
        pytest.param(lambda: jwt.encode(claims(), None, algorithm="none"), id="alg-none"),
        pytest.param(lambda: "not-a-jwt", id="garbage"),
    ],
)
def test_rejects_untrustworthy_tokens(verifier, token_factory):
    with pytest.raises(InvalidToken):
        verifier.verify(token_factory())


def test_hs256_rejected_when_no_secret_configured():
    strict = TokenVerifier(issuer=ISSUER, jwk_source=StaticJwkSource())
    with pytest.raises(InvalidToken):
        strict.verify(hs256(claims()))


def test_issuer_is_required():
    with pytest.raises(ValueError):
        TokenVerifier(issuer="")
