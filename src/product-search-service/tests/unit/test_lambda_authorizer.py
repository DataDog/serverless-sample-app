from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any
from unittest.mock import MagicMock, patch

SECRET = "test-secret-access-key"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_token(
    secret: str = SECRET,
    claims: dict[str, Any] | None = None,
    alg: str = "HS256",
    expires_in: int = 3600,
    now: int | None = None,
) -> str:
    """Build a signed JWT for tests, mirroring the repo's HS256 token scheme."""
    now = now if now is not None else int(time.time())
    payload = {"sub": "user-1", "user_type": "customer", "exp": now + expires_in, "iat": now}
    payload.update(claims or {})
    header = {"alg": alg, "typ": "JWT"}
    header_b64 = _b64url(json.dumps(header).encode())
    payload_b64 = _b64url(json.dumps(payload).encode())
    signature = hmac.new(secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(signature)}"


def make_event(token: str | None = None) -> dict:
    headers: dict[str, str] = {}
    if token is not None:
        headers["authorization"] = f"Bearer {token}"
    return {"headers": headers, "requestContext": {}}


def _patched_secret():
    return patch(
        "product_search_service.handlers.lambda_authorizer._get_jwt_secret",
        return_value=SECRET,
    )


def test_valid_token_is_authorized():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    with _patched_secret():
        result = lambda_handler(make_event(make_token()), MagicMock())

    assert result["isAuthorized"] is True
    assert result["context"]["user_id"] == "user-1"
    assert result["context"]["user_type"] == "customer"


def test_missing_authorization_header_is_denied():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    result = lambda_handler(make_event(None), MagicMock())
    assert result == {"isAuthorized": False, "context": {}}


def test_non_bearer_header_is_denied():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    with _patched_secret():
        result = lambda_handler(make_event("Basic dXNlcjpwYXNz"), MagicMock())

    assert result == {"isAuthorized": False, "context": {}}


def test_tampered_signature_is_denied():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    token = make_token()
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")

    with _patched_secret():
        result = lambda_handler(make_event(tampered), MagicMock())

    assert result == {"isAuthorized": False, "context": {}}


def test_expired_token_is_denied():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    token = make_token(expires_in=-10)

    with _patched_secret():
        result = lambda_handler(make_event(token), MagicMock())

    assert result == {"isAuthorized": False, "context": {}}


def test_unexpected_signing_method_is_denied():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    header = {"alg": "none", "typ": "JWT"}
    payload = {"sub": "user-1", "exp": int(time.time()) + 3600}
    header_b64 = _b64url(json.dumps(header).encode())
    payload_b64 = _b64url(json.dumps(payload).encode())
    unsigned = f"{header_b64}.{payload_b64}."

    with _patched_secret():
        result = lambda_handler(make_event(unsigned), MagicMock())

    assert result == {"isAuthorized": False, "context": {}}


def test_malformed_token_is_denied():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    with _patched_secret():
        result = lambda_handler(make_event("not-a-jwt"), MagicMock())

    assert result == {"isAuthorized": False, "context": {}}


def test_wrong_secret_is_denied():
    from product_search_service.handlers.lambda_authorizer import lambda_handler

    token = make_token(secret="a-different-secret-entirely")

    with _patched_secret():
        result = lambda_handler(make_event(token), MagicMock())

    assert result == {"isAuthorized": False, "context": {}}


def test_verify_jwt_returns_claims():
    from product_search_service.handlers.lambda_authorizer import verify_jwt

    claims = verify_jwt(make_token(), SECRET)
    assert claims["sub"] == "user-1"
    assert claims["user_type"] == "customer"
