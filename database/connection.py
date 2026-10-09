"""Database connection management using Motor (async MongoDB driver)."""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None
_client_loop = None


def _load_env_fallback():
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_file = os.path.normpath(env_file)
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    idx = line.index("=")
                    key = line[:idx].strip()
                    val = line[idx + 1:].strip()
                    if key not in os.environ:
                        os.environ[key] = val


async def init_database() -> None:
    global _client, _db, _client_loop
    current_loop = asyncio.get_running_loop()

    if _client is not None and _client_loop == current_loop:
        return

    if _client is not None:
        try:
            _client.close()
        except Exception:
            pass
        _client = None
        _db = None

    try:
        from packages.config.settings import get_settings
        settings = get_settings()
        uri = settings.MONGODB_URI
        db_name = settings.MONGODB_DATABASE
        pool_min = settings.MONGODB_MIN_POOL_SIZE
        pool_max = settings.MONGODB_MAX_POOL_SIZE
    except Exception:
        _load_env_fallback()
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGODB_DATABASE", "aegiscode")
        pool_min = int(os.getenv("MONGODB_MIN_POOL_SIZE", "2"))
        pool_max = int(os.getenv("MONGODB_MAX_POOL_SIZE", "20"))

    _client = AsyncIOMotorClient(
        uri,
        minPoolSize=pool_min,
        maxPoolSize=pool_max,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=30000,
    )
    _db = _client[db_name]
    _client_loop = current_loop

    # Non-blocking warm-up ping so the first HTTP request doesn't pay TLS handshake cost
    try:
        await asyncio.wait_for(_db.command("ping"), timeout=3.0)
    except Exception:
        pass


async def close_database() -> None:
    global _client, _db, _client_loop
    if _client:
        try:
            _client.close()
        except Exception:
            pass
        _client = None
        _db = None
        _client_loop = None


async def get_database() -> AsyncIOMotorDatabase:
    global _client, _db, _client_loop
    current_loop = asyncio.get_running_loop()
    if _client is None or _db is None or _client_loop != current_loop:
        await init_database()
    return _db
