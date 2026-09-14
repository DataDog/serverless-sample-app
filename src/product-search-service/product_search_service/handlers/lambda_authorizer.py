from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from functools import lru_cache
from typing import Any

import boto3
from aws_lambda_powertools import Logger
from botocore.config import Config

logger = Logger()

JWT_ALGORITHM = "HS256"


@lru_cache(maxsize=1)
def _get_jwt_secret() -> str:
    """Resolve and cache the shared JWT secret from SSM Parameter Store.

    The parameter name is read from the JWT_SECRET_PARAM_NAME environment
    variable, matching the pattern used by the other services in this repo
    (e.g. product-management-service, loyalty-point-service).
    """
    parameter_name = os.environ["JWT_SECRET_PARAM_NAME"]
    ssm = boto3.client(
        "ssm",
        config=Config(connect_timeout=2, read_timeout=5, retries={"max_attempts": 2}),
    )
    response = ssm.get_parameter(Name=parameter_name, WithDecryption=True)
    return response["Parameter"]["Value"]  # type: ignore[no-any-return]


def _b64url_decode(segment: str) -> bytes:
    """Decode a base64url-encoded JWT segment, tolerating missing padding."""
    padded = segment + "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(padded)


def verify_jwt(token: str, secret: str, now: int | None = None) -> dict[str, Any]:
    """Verify an HS256-signed JWT and return its claims.

    Raises:
        ValueError: If the token is malformed, signed with an unexpected
            algorithm, fails the HMAC signature check, or has expired.
    """
    now = now if now is not None else int(time.time())

    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("malformed token")
    header_b64, payload_b64, signature_b64 = parts

    header = json.loads(_b64url_decode(header_b64))
    if header.get("alg") != JWT_ALGORITHM:
        raise ValueError(f"unexpected signing method: {header.get('alg')}")

    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(expected_signature, _b64url_decode(signature_b64)):
        raise ValueError("signature verification failed")

    claims = json.loads(_b64url_decode(payload_b64))

    exp = claims.get("exp")
    if exp is not None and now >= int(exp):
        raise ValueError("token has expired")

    return claims


def _deny() -> dict[str, Any]:
    """Build a SIMPLE-format Lambda authorizer deny response."""
    return {"isAuthorized": False, "context": {}}


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """HTTP API Lambda authorizer — validate a Bearer JWT against the shared secret.

    Anonymous requests (no/invalid token) are rejected before they can reach
    the product search function, which would otherwise trigger paid Bedrock
    calls for every anonymous caller.
    """
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    auth_header = headers.get("authorization", "")

    if not auth_header.startswith("Bearer "):
        logger.info("Authorization denied: missing or non-Bearer Authorization header")
        return _deny()

    token = auth_header.removeprefix("Bearer ").strip()

    try:
        claims = verify_jwt(token, _get_jwt_secret())
    except ValueError as e:
        logger.info("Authorization denied", reason=str(e))
        return _deny()
    except Exception:
        logger.exception("Authorization failed while resolving JWT secret")
        return _deny()

    logger.info("Authorization allowed", user_id=claims.get("sub"), user_type=claims.get("user_type"))
    return {
        "isAuthorized": True,
        "context": {
            "user_id": str(claims.get("sub", "")),
            "user_type": str(claims.get("user_type", "")),
        },
    }
