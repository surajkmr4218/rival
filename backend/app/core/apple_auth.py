import jwt
import httpx
from jwt.algorithms import RSAAlgorithm
from functools import lru_cache
from time import time

from app.core.config import settings


class AppleAuthError(Exception):
    """Raised when Apple token verification fails."""
    pass


# Cache Apple's public keys for 24 hours
_apple_keys_cache: dict = {"keys": None, "fetched_at": 0}
CACHE_TTL = 60 * 60 * 24  # 24 hours


def get_apple_public_keys() -> dict:
    """
    Fetches Apple's public keys for JWT verification.
    Keys are cached for 24 hours.

    Returns:
        dict: JWKS containing Apple's public keys

    Raises:
        AppleAuthError: If keys cannot be fetched
    """
    now = time()

    if _apple_keys_cache["keys"] and (now - _apple_keys_cache["fetched_at"]) < CACHE_TTL:
        return _apple_keys_cache["keys"]

    try:
        response = httpx.get("https://appleid.apple.com/auth/keys", timeout=10.0)
        response.raise_for_status()
        keys = response.json()

        _apple_keys_cache["keys"] = keys
        _apple_keys_cache["fetched_at"] = now

        return keys
    except httpx.HTTPError as e:
        raise AppleAuthError(f"Failed to fetch Apple public keys: {e}")


def verify_apple_identity_token(identity_token: str) -> dict:
    """
    Verifies an Apple identity token and extracts claims.

    Args:
        identity_token: Base64-encoded JWT from Apple Sign In

    Returns:
        dict: Decoded JWT claims containing:
            - sub: Apple's unique user identifier
            - email: User's email (may be relay address)
            - email_verified: Boolean

    Raises:
        AppleAuthError: If verification fails
    """
    try:
        # Decode header without verification to get key ID
        unverified_header = jwt.get_unverified_header(identity_token)
        kid = unverified_header.get("kid")

        if not kid:
            raise AppleAuthError("Token missing key ID (kid)")

        # Get Apple's public keys
        apple_keys = get_apple_public_keys()

        # Find the key matching our token's kid
        matching_key = None
        for key in apple_keys.get("keys", []):
            if key.get("kid") == kid:
                matching_key = key
                break

        if not matching_key:
            # Key not found, try refreshing cache
            _apple_keys_cache["fetched_at"] = 0
            apple_keys = get_apple_public_keys()

            for key in apple_keys.get("keys", []):
                if key.get("kid") == kid:
                    matching_key = key
                    break

        if not matching_key:
            raise AppleAuthError(f"Public key not found for kid: {kid}")

        # Convert JWK to PEM format
        public_key = RSAAlgorithm.from_jwk(matching_key)

        # Verify and decode the token
        claims = jwt.decode(
            identity_token,
            public_key,
            algorithms=["RS256"],
            audience=settings.APPLE_BUNDLE_ID,
            issuer="https://appleid.apple.com"
        )

        return claims

    except jwt.ExpiredSignatureError:
        raise AppleAuthError("Token has expired")
    except jwt.InvalidAudienceError:
        raise AppleAuthError("Invalid audience - bundle ID mismatch")
    except jwt.InvalidIssuerError:
        raise AppleAuthError("Invalid issuer - not from Apple")
    except jwt.PyJWTError as e:
        raise AppleAuthError(f"Token verification failed: {e}")
