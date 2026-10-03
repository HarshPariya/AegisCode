"""Authentication helpers: password hashing, JWT creation & decoding."""
import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from packages.shared.errors import AuthError

# Use bcrypt directly — passlib has a self-test bug with bcrypt >=4.0
try:
    import bcrypt as _bcrypt_lib

    def hash_password(plain: str) -> str:
        salt = _bcrypt_lib.gensalt(rounds=12)
        return _bcrypt_lib.hashpw(plain.encode("utf-8"), salt).decode("utf-8")

    def verify_password(plain: str, hashed: str) -> bool:
        try:
            return _bcrypt_lib.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False

except ImportError:
    # Fallback: SHA-256 HMAC (not bcrypt — only used if bcrypt pkg is missing)
    import hashlib
    import hmac as _hmac
    import base64

    _PEPPER = os.getenv("SECRET_KEY", "aegiscode-dev-secret")

    def hash_password(plain: str) -> str:  # type: ignore[misc]
        salt = base64.b64encode(os.urandom(16)).decode()
        digest = _hmac.new(_PEPPER.encode(), (plain + salt).encode(), hashlib.sha256).hexdigest()
        return f"sha256${salt}${digest}"

    def verify_password(plain: str, hashed: str) -> bool:  # type: ignore[misc]
        try:
            _, salt, digest = hashed.split("$", 2)
            expected = _hmac.new(_PEPPER.encode(), (plain + salt).encode(), hashlib.sha256).hexdigest()
            return _hmac.compare_digest(expected, digest)
        except Exception:
            return False


SECRET_KEY = os.getenv("SECRET_KEY", "aegiscode-dev-secret-key-32-chars-minimum-token-protection")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise AuthError("Invalid or expired access token.")
